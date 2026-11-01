-- Animatiebord: tabel voor de borden van elke trainer.
-- Elke trainer ziet en wijzigt alleen zijn eigen borden (Row Level Security).
create table if not exists public.boards (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  name       text not null default '',
  format     text,
  category   text,
  steps      integer not null default 1,
  thumb      text,
  tactic     jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint bord_niet_te_groot check (octet_length(tactic::text) < 2000000)
);

alter table public.boards enable row level security;

drop policy if exists "eigen borden lezen" on public.boards;
drop policy if exists "eigen borden toevoegen" on public.boards;
drop policy if exists "eigen borden wijzigen" on public.boards;
drop policy if exists "eigen borden verwijderen" on public.boards;

create policy "eigen borden lezen" on public.boards
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "eigen borden toevoegen" on public.boards
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "eigen borden wijzigen" on public.boards
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "eigen borden verwijderen" on public.boards
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Ingelogde trainers mogen de tabel gebruiken (RLS beperkt tot eigen borden); anoniem niets.
grant select, insert, update, delete on public.boards to authenticated;
