alter table public.lists
  add column if not exists updated_at timestamptz;

update public.lists l
set updated_at = coalesce(
  (select max(i.updated_at) from public.items i where i.list_id = l.id),
  l.created_at,
  now()
)
where l.updated_at is null;

alter table public.lists
  alter column updated_at set default now(),
  alter column updated_at set not null;

drop trigger if exists lists_updated_at on public.lists;
create trigger lists_updated_at
  before update on public.lists
  for each row execute function public.update_updated_at();

create or replace function public.touch_list_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.lists set updated_at = now() where id = old.list_id;
    return old;
  end if;

  update public.lists set updated_at = now() where id = new.list_id;

  if tg_op = 'UPDATE' and old.list_id is distinct from new.list_id then
    update public.lists set updated_at = now() where id = old.list_id;
  end if;

  return new;
end;
$$;

drop trigger if exists items_touch_list_updated_at on public.items;
create trigger items_touch_list_updated_at
  after insert or update or delete on public.items
  for each row execute function public.touch_list_updated_at();

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
    l.updated_at as last_activity
  from public.lists l
  left join public.items i on i.list_id = l.id
  where public.is_household_member(l.household_id)
  group by l.id, l.name, l.emoji, l.created_at, l.updated_at, l.household_id
  order by l.updated_at desc, l.name asc;
$$;
