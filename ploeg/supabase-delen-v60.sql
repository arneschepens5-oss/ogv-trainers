-- v60: trainingen en oefeningen delen via een link (alleen lezen, zonder account)
create table if not exists public.shared_items (
  token text primary key check (length(token) >= 16),
  item_id text not null,
  kind text not null check (kind in ('training', 'oefening')),
  title text,
  payload jsonb not null,
  club_name text,
  created_by uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists shared_items_owner_item on public.shared_items (created_by, item_id);
alter table public.shared_items enable row level security;
drop policy if exists shared_items_own on public.shared_items;
create policy shared_items_own on public.shared_items for all to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

create or replace function public.get_shared(t text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('kind', kind, 'title', title, 'payload', payload, 'club', club_name, 'at', updated_at)
  from shared_items where token = t
$$;
revoke all on function public.get_shared(text) from public;
grant execute on function public.get_shared(text) to anon, authenticated;
grant select, insert, update, delete on public.shared_items to authenticated;
