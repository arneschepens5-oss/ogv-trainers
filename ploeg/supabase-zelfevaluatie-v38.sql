-- OGV Trainers / FootballCoachHub · v38 · zelfevaluatie door spelers + eigen vragen per club.
-- De club kiest zelf haar vragen (Beheer > Instellingen > Evaluaties). Dat staat in de clubinstellingen en vraagt geen script.
-- Dit script voegt toe: de antwoorden van spelers (en ouders die meehelpen) bewaren, per ploeg een zelfevaluatie openzetten,
-- en de namen van de evaluatiemomenten van de club tonen op de ouderpagina. Veilig om opnieuw uit te voeren.

/* 1. welke ploegen hebben een zelfevaluatie open, per moment */
create table if not exists public.eval_zelf_open (
  team_id   uuid not null references public.teams(id) on delete cascade,
  moment    integer not null check (moment between 1 and 5),
  opened_at timestamptz not null default now(),
  primary key (team_id, moment));
alter table public.eval_zelf_open enable row level security;
drop policy if exists "zelf open lezen" on public.eval_zelf_open;
create policy "zelf open lezen" on public.eval_zelf_open for select to authenticated using (public.in_my_club(team_id));
drop policy if exists "zelf open beheren" on public.eval_zelf_open;
create policy "zelf open beheren" on public.eval_zelf_open for all to authenticated
  using (public.is_trainer(team_id) or public.is_team_admin(team_id)) with check (public.is_trainer(team_id) or public.is_team_admin(team_id));

/* 2. de antwoorden van de spelers: één rij per speler per moment */
create table if not exists public.eval_zelf (
  team_id    uuid not null references public.teams(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  moment     integer not null check (moment between 1 and 5),
  answers    jsonb not null default '{}',
  by         text not null default 'speler' check (by in ('speler', 'ouder')),
  updated_at timestamptz not null default now(),
  primary key (player_id, moment));
create index if not exists eval_zelf_team on public.eval_zelf(team_id);
alter table public.eval_zelf enable row level security;
/* enkel de trainers van de ploeg (en beheerders van de club) lezen de antwoorden; het platform ziet ze niet */
drop policy if exists "zelfevaluatie ploeg" on public.eval_zelf;
create policy "zelfevaluatie ploeg" on public.eval_zelf for all to authenticated
  using (public.is_trainer(team_id) or public.is_team_admin(team_id)) with check (public.is_trainer(team_id) or public.is_team_admin(team_id));
grant select, insert, update, delete on public.eval_zelf, public.eval_zelf_open to authenticated;

/* 3. de trainer zet de zelfevaluatie voor een moment open of dicht */
create or replace function public.set_eval_zelf(t uuid, m integer, aan boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_trainer(t) or public.is_team_admin(t)) then raise exception 'Alleen trainers van deze ploeg.'; end if;
  if m not between 1 and 5 then return false; end if;
  if aan then insert into public.eval_zelf_open(team_id, moment) values (t, m) on conflict do nothing;
  else delete from public.eval_zelf_open where team_id = t and moment = m; end if;
  return true;
end $$;
revoke all on function public.set_eval_zelf(uuid, integer, boolean) from public, anon;
grant execute on function public.set_eval_zelf(uuid, integer, boolean) to authenticated;

/* 4. speler of ouder (via de persoonlijke link): vragen van de club, open momenten en eigen antwoorden */
create or replace function public.parent_zelf(tok uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare p public.players%rowtype; s jsonb; self jsonb;
begin
  select * into p from public.players where (parent_token = tok or player_token = tok) and active is not false;
  if not found then return null; end if;
  select c.settings into s from public.teams t join public.clubs c on c.id = t.club_id where t.id = p.team_id;
  self := s->'eval'->'self';
  if coalesce((self->>'on')::boolean, false) is not true then return json_build_object('on', false); end if;
  /* enkel de vragen en de namen van de momenten, niets anders uit de clubinstellingen */
  return json_build_object('on', true, 'self', self,
    'moments', (select json_agg(m->>'naam') from jsonb_array_elements(coalesce(s->'eval'->'moments', '[]'::jsonb)) m),
    'open', coalesce((select json_agg(o.moment order by o.moment) from public.eval_zelf_open o where o.team_id = p.team_id), '[]'::json),
    'mine', coalesce((select json_agg(json_build_object('moment', z.moment, 'answers', z.answers, 'by', z.by, 'updated_at', z.updated_at) order by z.moment)
                      from public.eval_zelf z where z.player_id = p.id), '[]'::json));
end $$;

/* 5. antwoorden bewaren: enkel als de club het aanzette en de trainer dit moment opende; cijfers 1 tot 5 en korte teksten */
create or replace function public.parent_zelf_save(tok uuid, m integer, answers jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare p public.players%rowtype; s jsonb; k text; v jsonb; n integer := 0; clean jsonb := '{}'::jsonb; txt text;
begin
  select * into p from public.players where (parent_token = tok or player_token = tok) and active is not false;
  if not found then raise exception 'Deze link werkt niet meer.'; end if;
  if m is null or m not between 1 and 5 then raise exception 'Ongeldig moment.'; end if;
  if jsonb_typeof(answers) is distinct from 'object' then raise exception 'Ongeldige antwoorden.'; end if;
  select c.settings into s from public.teams t join public.clubs c on c.id = t.club_id where t.id = p.team_id;
  if coalesce((s->'eval'->'self'->>'on')::boolean, false) is not true
     or not exists (select 1 from public.eval_zelf_open o where o.team_id = p.team_id and o.moment = m) then
    raise exception 'De zelfevaluatie is niet open.'; end if;
  for k, v in select * from jsonb_each(answers) loop
    n := n + 1; if n > 60 then raise exception 'Te veel antwoorden.'; end if;
    if k !~ '^[a-z0-9_-]{1,40}$' then continue; end if;
    if jsonb_typeof(v) = 'number' then
      if (v #>> '{}')::numeric between 1 and 5 then clean := clean || jsonb_build_object(k, round((v #>> '{}')::numeric)); end if;
    elsif jsonb_typeof(v) = 'string' then
      txt := left(trim(v #>> '{}'), 600); if txt <> '' then clean := clean || jsonb_build_object(k, txt); end if;
    end if;
  end loop;
  insert into public.eval_zelf(team_id, player_id, moment, answers, by, updated_at)
    values (p.team_id, p.id, m, clean, case when p.player_token = tok then 'speler' else 'ouder' end, now())
    on conflict (player_id, moment) do update set answers = excluded.answers, by = excluded.by, updated_at = now();
  return true;
end $$;
revoke all on function public.parent_zelf(uuid), public.parent_zelf_save(uuid, integer, jsonb) from public;
grant execute on function public.parent_zelf(uuid), public.parent_zelf_save(uuid, integer, jsonb) to anon, authenticated;

/* 6. de gepubliceerde evaluaties voor ouders kennen nu ook de namen van de momenten van de club (niet meer de vaste vijf) */
create or replace function public.parent_evaluaties(tok uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare p public.players%rowtype; s jsonb;
begin
  select * into p from public.players where (parent_token = tok or player_token = tok) and active is not false;
  if not found then return null; end if;
  select c.settings into s from public.teams t join public.clubs c on c.id = t.club_id where t.id = p.team_id;
  /* Alleen scores per onderdeel, sterktes, werkpunten en doelen.
     NIET: privénotitie (comment), niveau t.o.v. de ploeg, advies volgend seizoen, oudergesprek. */
  return json_build_object(
    'criteria', (select t.criteria from public.teams t where t.id = p.team_id),
    'moments', (select json_agg(m->>'naam') from jsonb_array_elements(coalesce(s->'eval'->'moments', '[]'::jsonb)) m),
    'evals', coalesce((select json_agg(json_build_object('moment', ev.moment, 'date', ev.date, 'scores', ev.scores,
                'strengths', ev.details->>'strengths', 'workpoints', ev.details->>'workpoints', 'goals', ev.details->>'goals')
              order by ev.moment)
      from public.evaluations ev
      where ev.player_id = p.id and ev.team_id = p.team_id
        and ev.moment in (select pub.moment from public.eval_publicaties pub where pub.team_id = p.team_id)), '[]'::json));
end $$;
revoke all on function public.parent_evaluaties(uuid) from public;
grant execute on function public.parent_evaluaties(uuid) to anon, authenticated;

/* 7. de back-up en het exporteren van de club nemen de zelfevaluaties mee */
create or replace function public.club_backup() returns json language plpgsql stable security definer set search_path to 'public' as $$
declare c uuid := public.my_club();
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  return json_build_object('made', now(), 'version', 16, 'club', (select row_to_json(x) from public.clubs x where x.id = c),
    'teams', (select coalesce(json_agg(t), '[]') from public.teams t where t.club_id = c),
    'team_trainers', (select coalesce(json_agg(t), '[]') from public.team_trainers t where public.in_my_club(t.team_id)),
    'players', (select coalesce(json_agg(t), '[]') from public.players t where public.in_my_club(t.team_id)),
    'events', (select coalesce(json_agg(t), '[]') from public.events t where public.in_my_club(t.team_id)),
    'attendance', (select coalesce(json_agg(t), '[]') from public.attendance t where public.in_my_club(t.team_id)),
    'evaluations', (select coalesce(json_agg(t), '[]') from public.evaluations t where public.in_my_club(t.team_id)),
    'eval_zelf', (select coalesce(json_agg(t), '[]') from public.eval_zelf t where public.in_my_club(t.team_id)),
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

/* controle: de twee tabellen bestaan en hebben rijbeveiliging */
select relname, relrowsecurity as beveiligd from pg_class where relname in ('eval_zelf', 'eval_zelf_open') order by 1;
