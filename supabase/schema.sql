-- NK Lists - Supabase database schema
-- For existing projects, apply files in supabase/migrations instead of pasting
-- this full schema into production.

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

create table public.households (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamptz default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz default now(),
  primary key (household_id, user_id)
);

create table public.lists (
  id uuid default gen_random_uuid() primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  emoji text,
  created_at timestamptz default now()
);

create table public.items (
  id uuid default gen_random_uuid() primary key,
  list_id uuid references public.lists(id) on delete cascade,
  name text not null,
  checked boolean default false,
  category text default 'Other',
  added_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.item_history (
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  last_used timestamptz default now(),
  use_count integer default 1,
  is_recurring boolean default false,
  primary key (household_id, name)
);

create table public.household_categories (
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

create index items_list_id_idx on public.items (list_id);
create index lists_household_id_idx on public.lists (household_id);
create index item_history_household_id_idx on public.item_history (household_id);
create index household_members_user_id_idx on public.household_members (user_id);
create unique index household_categories_household_name_idx on public.household_categories (household_id, lower(name));
create index household_categories_household_position_idx on public.household_categories (household_id, position);

-- ─────────────────────────────────────────────────────────────
-- Household authorization helpers
-- ─────────────────────────────────────────────────────────────

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = auth.uid()
  );
$$;

create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select hm.household_id
  from public.household_members hm
  where hm.user_id = auth.uid()
  order by hm.created_at
  limit 1;
$$;

-- ─────────────────────────────────────────────────────────────
-- Item timestamps and history
-- ─────────────────────────────────────────────────────────────

create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger items_updated_at
  before update on public.items
  for each row execute function public.update_updated_at();

create trigger household_categories_updated_at
  before update on public.household_categories
  for each row execute function public.update_updated_at();

drop function if exists public.upsert_item_history(text);

create or replace function public.upsert_item_history(
  item_name text,
  target_household_id uuid default public.current_household_id()
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if target_household_id is null or not public.is_household_member(target_household_id) then
    raise exception 'Not authorized for household item history';
  end if;

  insert into public.item_history (household_id, name, last_used, use_count)
  values (target_household_id, item_name, now(), 1)
  on conflict (household_id, name) do update
  set last_used = now(), use_count = public.item_history.use_count + 1;
end;
$$;

create or replace function public.get_list_summaries()
returns table (
  id uuid,
  name text,
  emoji text,
  created_at timestamptz,
  household_id uuid,
  item_count bigint,
  unchecked_count bigint,
  last_activity timestamptz
)
language sql
stable
set search_path = public
as $$
  select
    l.id,
    l.name,
    l.emoji,
    l.created_at,
    l.household_id,
    count(i.id) as item_count,
    count(i.id) filter (where coalesce(i.checked, false) = false) as unchecked_count,
    max(i.updated_at) as last_activity
  from public.lists l
  left join public.items i on i.list_id = l.id
  where public.is_household_member(l.household_id)
  group by l.id, l.name, l.emoji, l.created_at, l.household_id
  order by max(i.updated_at) desc nulls last, l.name asc;
$$;

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

-- ─────────────────────────────────────────────────────────────
-- Realtime
-- ─────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.items;
alter publication supabase_realtime add table public.lists;

-- ─────────────────────────────────────────────────────────────
-- Row-level security
-- ─────────────────────────────────────────────────────────────

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.lists enable row level security;
alter table public.items enable row level security;
alter table public.item_history enable row level security;
alter table public.household_categories enable row level security;

grant select, insert, update, delete on public.household_categories to authenticated;
grant execute on function public.rename_household_category(uuid, text, text, text[], integer) to authenticated;
grant execute on function public.delete_household_category(uuid, text) to authenticated;

create policy "households - members can read"
  on public.households for select
  to authenticated
  using (public.is_household_member(id));

create policy "household_members - members can read household"
  on public.household_members for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "lists - household members full access"
  on public.lists for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "items - household members full access"
  on public.items for all
  to authenticated
  using (
    exists (
      select 1 from public.lists l
      where l.id = items.list_id
        and public.is_household_member(l.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.lists l
      where l.id = items.list_id
        and public.is_household_member(l.household_id)
    )
  );

create policy "item_history - household members full access"
  on public.item_history for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "household_categories - household members full access"
  on public.household_categories for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
