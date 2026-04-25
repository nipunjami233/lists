-- NK Lists - Supabase database schema
-- Run this in your Supabase SQL Editor after creating a new project.
--
-- Authentication: relies on Supabase Auth (email/password by default).
-- Authorization: row-level security limits all access to authenticated users only.
-- Data sharing model: any authenticated user in this project can see all lists
-- and items - intended for a small household where everyone is trusted.
-- For per-user ownership, add user_id columns and tighter policies.

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

create table lists (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  emoji text,
  created_at timestamptz default now()
);

create table items (
  id uuid default gen_random_uuid() primary key,
  list_id uuid references lists(id) on delete cascade,
  name text not null,
  checked boolean default false,
  category text default 'Other',
  added_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table item_history (
  name text primary key,
  last_used timestamptz default now(),
  use_count integer default 1,
  is_recurring boolean default false
);

-- ─────────────────────────────────────────────────────────────
-- Auto-update items.updated_at on every UPDATE (used for offline conflict resolution)
-- ─────────────────────────────────────────────────────────────

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger items_updated_at
  before update on items
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Item history upsert (used by autocomplete + recurring items)
-- ─────────────────────────────────────────────────────────────

create or replace function upsert_item_history(item_name text)
returns void as $$
begin
  insert into item_history (name, last_used, use_count)
  values (item_name, now(), 1)
  on conflict (name) do update
  set last_used = now(), use_count = item_history.use_count + 1;
end;
$$ language plpgsql;

-- ─────────────────────────────────────────────────────────────
-- Realtime: enable for the items + lists tables
-- ─────────────────────────────────────────────────────────────

alter publication supabase_realtime add table items;
alter publication supabase_realtime add table lists;

-- ─────────────────────────────────────────────────────────────
-- Row-level security
-- Only authenticated users can read or write. The anon role (used for the
-- public site before login) cannot touch any data.
-- ─────────────────────────────────────────────────────────────

alter table lists enable row level security;
alter table items enable row level security;
alter table item_history enable row level security;

-- Lists: any authenticated user can do anything
create policy "lists - authenticated users full access"
  on lists for all
  to authenticated
  using (true)
  with check (true);

-- Items: any authenticated user can do anything
create policy "items - authenticated users full access"
  on items for all
  to authenticated
  using (true)
  with check (true);

-- Item history: any authenticated user can do anything
create policy "item_history - authenticated users full access"
  on item_history for all
  to authenticated
  using (true)
  with check (true);
