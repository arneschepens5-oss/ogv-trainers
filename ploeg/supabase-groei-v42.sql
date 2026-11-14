-- v42 (bevat ook v41): maturiteit, clubtotalen en lengte/gewicht per speler. Veilig om opnieuw uit te voeren.
alter table public.players add column if not exists maturity text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'players_maturity_chk') then
    alter table public.players add constraint players_maturity_chk check (maturity is null or maturity in ('vroeg','normaal','laat'));
  end if;
end $$;

-- Per ploeg: aantal actieve spelers per geboortekwartaal, jaarhelft en maturiteit. Geen namen.
create or replace function public.club_spelersprofiel() returns json language plpgsql stable security definer set search_path to 'public' as $$
declare me public.club_members%rowtype;
begin
  select * into me from public.club_members where user_id = auth.uid() and club_id = public.my_club();
  if not found or not (me.role = 'admin' or me.all_teams or cardinality(me.team_access) > 0) then raise exception 'Alleen voor beheerders en coördinatoren.'; end if;
  return coalesce((select json_agg(x order by x->>'name') from (
    select json_build_object('id', t.id, 'name', t.name, 'category', t.category,
      'players', (select count(*) from public.players p where p.team_id = t.id and p.active),
      'nobirth', (select count(*) from public.players p where p.team_id = t.id and p.active and p.birthdate is null),
      'q1', (select count(*) from public.players p where p.team_id = t.id and p.active and extract(month from p.birthdate) between 1 and 3),
      'q2', (select count(*) from public.players p where p.team_id = t.id and p.active and extract(month from p.birthdate) between 4 and 6),
      'q3', (select count(*) from public.players p where p.team_id = t.id and p.active and extract(month from p.birthdate) between 7 and 9),
      'q4', (select count(*) from public.players p where p.team_id = t.id and p.active and extract(month from p.birthdate) between 10 and 12),
      'vroeg', (select count(*) from public.players p where p.team_id = t.id and p.active and p.maturity = 'vroeg'),
      'normaal', (select count(*) from public.players p where p.team_id = t.id and p.active and p.maturity = 'normaal'),
      'laat', (select count(*) from public.players p where p.team_id = t.id and p.active and p.maturity = 'laat')) x
    from public.teams t
    where t.club_id = me.club_id and (me.role = 'admin' or me.all_teams or t.id = any(me.team_access))) s), '[]'::json);
end $$;
revoke all on function public.club_spelersprofiel() from public, anon;
grant execute on function public.club_spelersprofiel() to authenticated;

-- Meten en wegen: lengte en gewicht per speler doorheen de jaren. Enkel voor de trainers van de ploeg.
create table if not exists public.player_measures (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  date       date not null default current_date,
  height_cm  numeric(5,1) check (height_cm is null or height_cm between 40 and 230),
  weight_kg  numeric(5,1) check (weight_kg is null or weight_kg between 5 and 200),
  note       text check (note is null or length(note) <= 300),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  check (height_cm is not null or weight_kg is not null));
create index if not exists player_measures_player on public.player_measures(player_id, date);
alter table public.player_measures enable row level security;
drop policy if exists "metingen ploeg" on public.player_measures;
create policy "metingen ploeg" on public.player_measures for all to authenticated
  using (public.is_trainer(team_id) or public.is_team_admin(team_id)) with check (public.is_trainer(team_id) or public.is_team_admin(team_id));
grant select, insert, update, delete on public.player_measures to authenticated;
