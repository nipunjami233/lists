-- NK Lists household access model.
-- Preview and verify before applying to production.

create table if not exists public.households (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz default now(),
  primary key (household_id, user_id)
);

alter table public.lists
  add column if not exists household_id uuid references public.households(id) on delete cascade;

alter table public.item_history
  add column if not exists household_id uuid references public.households(id) on delete cascade;

do $$
declare
  nk_household_id uuid;
begin
  select id into nk_household_id
  from public.households
  where name = 'NK Household'
  order by created_at
  limit 1;

  if nk_household_id is null then
    insert into public.households (name)
    values ('NK Household')
    returning id into nk_household_id;
  end if;

  update public.lists
  set household_id = nk_household_id
  where household_id is null;

  update public.item_history
  set household_id = nk_household_id
  where household_id is null;

  insert into public.household_members (household_id, user_id, role)
  select nk_household_id, users.id, 'owner'
  from auth.users
  on conflict (household_id, user_id) do nothing;
end $$;

alter table public.lists
  alter column household_id set not null;

alter table public.item_history
  alter column household_id set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'item_history_pkey'
      and conrelid = 'public.item_history'::regclass
  ) then
    alter table public.item_history drop constraint item_history_pkey;
  end if;
end $$;

alter table public.item_history
  add constraint item_history_pkey primary key (household_id, name);

create index if not exists items_list_id_idx on public.items (list_id);
create index if not exists lists_household_id_idx on public.lists (household_id);
create index if not exists item_history_household_id_idx on public.item_history (household_id);
create index if not exists household_members_user_id_idx on public.household_members (user_id);

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

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.lists enable row level security;
alter table public.items enable row level security;
alter table public.item_history enable row level security;

drop policy if exists "lists - authenticated users full access" on public.lists;
drop policy if exists "items - authenticated users full access" on public.items;
drop policy if exists "item_history - authenticated users full access" on public.item_history;

drop policy if exists "households - members can read" on public.households;
create policy "households - members can read"
  on public.households for select
  to authenticated
  using (public.is_household_member(id));

drop policy if exists "household_members - members can read household" on public.household_members;
create policy "household_members - members can read household"
  on public.household_members for select
  to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "lists - household members full access" on public.lists;
create policy "lists - household members full access"
  on public.lists for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "items - household members full access" on public.items;
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

drop policy if exists "item_history - household members full access" on public.item_history;
create policy "item_history - household members full access"
  on public.item_history for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
