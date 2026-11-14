-- OGV Trainers / FootballCoachHub · v40 · trainersdossier (profiel per trainer) en interne scouting per speler.
-- Bewust NIET opgeslagen: rijksregisternummer, identiteitskaart- of rekeningnummer. Veilig om opnieuw uit te voeren.

/* 1. profiel van een trainer: zichtbaar voor alle trainers van dezelfde club; wijzigen kan de trainer zelf of een beheerder */
create table if not exists public.trainer_profiles (
  user_id    uuid primary key,
  club_id    uuid not null references public.clubs(id) on delete cascade,
  email      text,
  name       text,
  role       text,
  phone      text,
  diplomas   text,
  bio        text,
  photo      text,
  updated_at timestamptz not null default now());
create index if not exists trainer_profiles_club on public.trainer_profiles(club_id);
alter table public.trainer_profiles enable row level security;
drop policy if exists "trainerprofiel lezen" on public.trainer_profiles;
drop policy if exists "trainerprofiel toevoegen" on public.trainer_profiles;
drop policy if exists "trainerprofiel wijzigen" on public.trainer_profiles;
drop policy if exists "trainerprofiel verwijderen" on public.trainer_profiles;
create policy "trainerprofiel lezen" on public.trainer_profiles for select to authenticated using (club_id = public.my_club());
create policy "trainerprofiel toevoegen" on public.trainer_profiles for insert to authenticated
  with check (club_id = public.my_club() and (user_id = auth.uid() or public.is_admin()));
create policy "trainerprofiel wijzigen" on public.trainer_profiles for update to authenticated
  using (club_id = public.my_club() and (user_id = auth.uid() or public.is_admin()))
  with check (club_id = public.my_club() and (user_id = auth.uid() or public.is_admin()));
create policy "trainerprofiel verwijderen" on public.trainer_profiles for delete to authenticated
  using (club_id = public.my_club() and (user_id = auth.uid() or public.is_admin()));
grant select, insert, update, delete on public.trainer_profiles to authenticated;

/* foto van een trainer: pad = trainers/<club-id>/<user-id>-xxxx.jpg in dezelfde privé map als de spelersfoto's */
create or replace function public.foto_trainer_club(pad text) returns uuid language sql immutable as $$
  select case when split_part(pad, '/', 1) = 'trainers' and split_part(pad, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then split_part(pad, '/', 2)::uuid end $$;
revoke all on function public.foto_trainer_club(text) from public;
grant execute on function public.foto_trainer_club(text) to authenticated;
drop policy if exists "trainersfoto lezen" on storage.objects;
drop policy if exists "trainersfoto toevoegen" on storage.objects;
drop policy if exists "trainersfoto wijzigen" on storage.objects;
drop policy if exists "trainersfoto verwijderen" on storage.objects;
create policy "trainersfoto lezen" on storage.objects for select to authenticated
  using (bucket_id = 'player-photos' and public.foto_trainer_club(name) is not null and public.foto_trainer_club(name) = public.my_club());
create policy "trainersfoto toevoegen" on storage.objects for insert to authenticated
  with check (bucket_id = 'player-photos' and public.foto_trainer_club(name) = public.my_club() and (split_part(name, '/', 3) like auth.uid()::text || '-%' or public.is_admin()));
create policy "trainersfoto wijzigen" on storage.objects for update to authenticated
  using (bucket_id = 'player-photos' and public.foto_trainer_club(name) = public.my_club() and (split_part(name, '/', 3) like auth.uid()::text || '-%' or public.is_admin()));
create policy "trainersfoto verwijderen" on storage.objects for delete to authenticated
  using (bucket_id = 'player-photos' and public.foto_trainer_club(name) = public.my_club() and (split_part(name, '/', 3) like auth.uid()::text || '-%' or public.is_admin()));

/* 2a. scoutingprofiel van een eigen speler (posities, 5 scores, potentieel, sterktes, ...): gewoon een extra veld op de speler,
   dus ook enkel zichtbaar voor de trainers van de ploeg */
alter table public.players add column if not exists scout jsonb;

/* 2b. interne scouting per speler van de eigen club: enkel de trainers van de ploeg, nooit zichtbaar voor ouders of spelers */
create table if not exists public.player_scout (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  date       date not null default current_date,
  title      text,
  notes      text,
  strengths  text,
  workpoints text,
  scores     jsonb not null default '{}',
  by_name    text,
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now());
create index if not exists player_scout_player on public.player_scout(player_id);
alter table public.player_scout enable row level security;
drop policy if exists "interne scouting ploeg" on public.player_scout;
create policy "interne scouting ploeg" on public.player_scout for all to authenticated
  using (public.is_trainer(team_id) or public.is_team_admin(team_id)) with check (public.is_trainer(team_id) or public.is_team_admin(team_id));
grant select, insert, update, delete on public.player_scout to authenticated;

/* 3. de back-up van de club neemt de scoutingrapporten en trainersprofielen mee */
create or replace function public.club_backup() returns json language plpgsql stable security definer set search_path to 'public' as $$
declare c uuid := public.my_club();
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  return json_build_object('made', now(), 'version', 17, 'club', (select row_to_json(x) from public.clubs x where x.id = c),
    'teams', (select coalesce(json_agg(t), '[]') from public.teams t where t.club_id = c),
    'team_trainers', (select coalesce(json_agg(t), '[]') from public.team_trainers t where public.in_my_club(t.team_id)),
    'trainer_profiles', (select coalesce(json_agg(t), '[]') from public.trainer_profiles t where t.club_id = c),
    'players', (select coalesce(json_agg(t), '[]') from public.players t where public.in_my_club(t.team_id)),
    'events', (select coalesce(json_agg(t), '[]') from public.events t where public.in_my_club(t.team_id)),
    'attendance', (select coalesce(json_agg(t), '[]') from public.attendance t where public.in_my_club(t.team_id)),
    'evaluations', (select coalesce(json_agg(t), '[]') from public.evaluations t where public.in_my_club(t.team_id)),
    'eval_zelf', (select coalesce(json_agg(t), '[]') from public.eval_zelf t where public.in_my_club(t.team_id)),
    'player_scout', (select coalesce(json_agg(t), '[]') from public.player_scout t where public.in_my_club(t.team_id)),
    'goals', (select coalesce(json_agg(t), '[]') from public.goals t where public.in_my_club(t.team_id)),
    'rsvp', (select coalesce(json_agg(t), '[]') from public.rsvp t where public.in_my_club(t.team_id)),
    'scouting', (select coalesce(json_agg(t), '[]') from public.scouting t where t.club_id = c),
    'trainer_items', (select coalesce(json_agg(t), '[]') from public.trainer_items t where t.club_id = c),
    'club_docs', (select coalesce(json_agg(t), '[]') from public.club_docs t where t.club_id = c),
    'club_members', (select coalesce(json_agg(t), '[]') from public.club_members t where t.club_id = c),
    'club_contacts', (select coalesce(json_agg(t), '[]') from public.club_contacts t where t.club_id = c),
    'messages', (select coalesce(json_agg(t), '[]') from public.messages t where t.club_id = c),
    'feedback', (select coalesce(json_agg(t), '[]') from public.feedback t where t.club_id = c));
end $$;
revoke all on function public.club_backup() from public, anon;
grant execute on function public.club_backup() to authenticated;

select relname, relrowsecurity as beveiligd from pg_class where relname in ('trainer_profiles', 'player_scout') order by 1;
