-- Household-managed categories for NK Lists.
-- Keeps the original defaults but lets each household edit names, colors, order,
-- and auto-categorization keywords from the app.

create table if not exists public.household_categories (
  id uuid default gen_random_uuid() primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  color text not null default 'gray' check (
    color in ('green', 'blue', 'red', 'amber', 'cyan', 'purple', 'orange', 'gray', 'rose', 'pink', 'emerald', 'teal', 'indigo')
  ),
  keywords text[] not null default '{}',
  position integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists household_categories_household_name_idx
  on public.household_categories (household_id, lower(name));

create index if not exists household_categories_household_position_idx
  on public.household_categories (household_id, position);

drop trigger if exists household_categories_updated_at on public.household_categories;
create trigger household_categories_updated_at
  before update on public.household_categories
  for each row execute function public.update_updated_at();

alter table public.household_categories enable row level security;

grant select, insert, update, delete on public.household_categories to authenticated;

drop policy if exists "household_categories - household members full access" on public.household_categories;
create policy "household_categories - household members full access"
  on public.household_categories for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

insert into public.household_categories (household_id, name, color, keywords, position)
select
  h.id,
  defaults.name,
  defaults.color,
  defaults.keywords,
  defaults.position
from public.households h
cross join (
  values
    ('Produce', 'green', array['apple', 'banana', 'grape', 'berry', 'mango', 'watermelon', 'strawberry', 'pineapple', 'lemon', 'lime', 'orange', 'fruit', 'carrot', 'onion', 'tomato', 'lettuce', 'spinach', 'kale', 'broccoli', 'cucumber', 'pepper', 'cilantro', 'mint', 'ginger', 'garlic', 'veggie', 'vegetable', 'potato', 'celery', 'zucchini', 'avocado', 'peach', 'plum', 'cherry', 'blueberry', 'pesalu', 'green chili', 'mushroom']::text[], 0),
    ('Dairy', 'blue', array['milk', 'cheese', 'yogurt', 'butter', 'cream', 'egg', 'paneer', 'ghee', 'curd', 'mozzarella', 'parmesan']::text[], 1),
    ('Meat & Fish', 'red', array['chicken', 'beef', 'pork', 'fish', 'shrimp', 'lamb', 'turkey', 'meat', 'salmon', 'tuna', 'crab', 'prawn', 'sausage']::text[], 2),
    ('Bakery & Grains', 'amber', array['bread', 'cake', 'cupcake', 'muffin', 'bagel', 'tortilla', 'pasta', 'rice', 'cereal', 'flour', 'oat', 'grain', 'roti', 'naan', 'bun', 'roll', 'crouton']::text[], 3),
    ('Frozen', 'cyan', array['frozen', 'ice cream']::text[], 4),
    ('Drinks', 'purple', array['beer', 'wine', 'juice', 'soda', 'water', 'coffee', 'tea', 'drink', 'beverage', 'kombucha', 'lemonade']::text[], 5),
    ('Snacks', 'orange', array['candy', 'chocolate', 'cookie', 'chip', 'snack', 'nut', 'peanut', 'cracker', 'pretzel', 'popcorn', 'toblerone', 'coconut', 'stevia', 'sugar']::text[], 6),
    ('Household', 'gray', array['soap', 'shampoo', 'detergent', 'cleaning', 'tissue', 'paper', 'wipe', 'pad', 'tampon', 'toothpaste', 'body wash', 'aveeno', 'bengay', 'mulch', 'soil', 'salt', 'bleach', 'sponge', 'trash', 'bag', 'foil', 'wrap', 'plate', 'cup', 'fork', 'spoon', 'napkin', 'box', 'gift']::text[], 7),
    ('Other', 'gray', array[]::text[], 8)
) as defaults(name, color, keywords, position)
where not exists (
  select 1
  from public.household_categories hc
  where hc.household_id = h.id
    and lower(hc.name) = lower(defaults.name)
);

create or replace function public.rename_household_category(
  category_id uuid,
  new_name text,
  new_color text,
  new_keywords text[],
  new_position integer
)
returns void
language plpgsql
set search_path = public
as $$
declare
  target_household_id uuid;
  old_name text;
  clean_name text;
begin
  clean_name := trim(regexp_replace(coalesce(new_name, ''), '\s+', ' ', 'g'));

  if clean_name = '' then
    raise exception 'Category name is required';
  end if;

  select household_id, name
  into target_household_id, old_name
  from public.household_categories
  where id = category_id
    and public.is_household_member(household_id)
  for update;

  if target_household_id is null then
    raise exception 'Category not found or not authorized';
  end if;

  update public.household_categories
  set
    name = clean_name,
    color = new_color,
    keywords = coalesce(new_keywords, '{}'),
    position = coalesce(new_position, position)
  where id = category_id;

  if old_name <> clean_name then
    update public.items i
    set category = clean_name
    where i.category = old_name
      and exists (
        select 1
        from public.lists l
        where l.id = i.list_id
          and l.household_id = target_household_id
      );
  end if;
end;
$$;

create or replace function public.delete_household_category(
  category_id uuid,
  fallback_name text default 'Other'
)
returns void
language plpgsql
set search_path = public
as $$
declare
  target_household_id uuid;
  old_name text;
begin
  select household_id, name
  into target_household_id, old_name
  from public.household_categories
  where id = category_id
    and public.is_household_member(household_id)
  for update;

  if target_household_id is null then
    raise exception 'Category not found or not authorized';
  end if;

  if old_name = 'Other' then
    raise exception 'Other cannot be deleted';
  end if;

  update public.items i
  set category = coalesce(nullif(trim(fallback_name), ''), 'Other')
  where i.category = old_name
    and exists (
      select 1
      from public.lists l
      where l.id = i.list_id
        and l.household_id = target_household_id
    );

  delete from public.household_categories
  where id = category_id;
end;
$$;

grant execute on function public.rename_household_category(uuid, text, text, text[], integer) to authenticated;
grant execute on function public.delete_household_category(uuid, text) to authenticated;
