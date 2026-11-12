-- =====================================================================
-- OGV Trainers / Coachbord  ·  v29  ·  MEERDERE CLUBS IN ÉÉN APP
-- Elke club ziet alleen haar eigen ploegen, spelers, kalender, documenten,
-- scouting, contacten, berichten en gedeelde trainingen.
-- Alle bestaande gegevens komen onder de club "KVV OG Vorselaar": voor OGV verandert er niets.
-- Veilig om opnieuw uit te voeren. Voer uit in Supabase > SQL Editor > New query.
-- =====================================================================
begin;

-- ---------- 1. clubs ----------
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short text,
  slug text unique,
  settings jsonb not null default '{}'::jsonb,   -- logo, kleuren, terreinen, regels veldindeling, bondsnummer ...
  created_at timestamptz not null default now()
);
alter table public.clubs enable row level security;
insert into public.clubs(id, name, short, slug)
values ('00000000-0000-4000-8000-000000000001', 'KVV OG Vorselaar', 'OGV', 'og-vorselaar')
on conflict (id) do nothing;

-- beheerders van het platform zelf (wie nieuwe clubs mag aanmaken); vul je jezelf in met het aparte regeltje uit de uitleg
create table if not exists public.platform_admins (user_id uuid primary key references auth.users on delete cascade);
alter table public.platform_admins enable row level security;

-- ---------- 2. club_id op elke tabel die bij een club hoort ----------
alter table public.club_members add column if not exists club_id uuid references public.clubs(id) on delete cascade;
update public.club_members set club_id = '00000000-0000-4000-8000-000000000001' where club_id is null;
alter table public.club_members alter column club_id set not null;
create index if not exists club_members_club on public.club_members(club_id);

create or replace function public.my_club() returns uuid language sql stable security definer set search_path to 'public' as $$
  select club_id from public.club_members where user_id = auth.uid();
$$;
create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

do $$
declare t text;
begin
  foreach t in array array['teams','club_contacts','club_docs','club_settings','scouting','trainer_items','messages','feedback'] loop
    execute format('alter table public.%I add column if not exists club_id uuid references public.clubs(id) on delete cascade', t);
    execute format('update public.%I set club_id = %L where club_id is null', t, '00000000-0000-4000-8000-000000000001');
    execute format('alter table public.%I alter column club_id set default public.my_club()', t);
    execute format('create index if not exists %I on public.%I(club_id)', t || '_club', t);
  end loop;
end $$;
/* hoort deze ploeg bij mijn club */
create or replace function public.in_my_club(t uuid) returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.teams where id = t and club_id = public.my_club());
$$;
-- verplicht waar het altijd bij een club hoort (trainer_items en feedback kunnen van iemand zonder club komen)
alter table public.teams alter column club_id set not null;
alter table public.club_contacts alter column club_id set not null;
alter table public.club_docs alter column club_id set not null;
alter table public.club_settings alter column club_id set not null;
alter table public.scouting alter column club_id set not null;
alter table public.messages alter column club_id set not null;

-- documenten en instellingen: sleutel per club
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'club_docs_pkey' and pg_get_constraintdef(oid) = 'PRIMARY KEY (key)') then
    alter table public.club_docs drop constraint club_docs_pkey; alter table public.club_docs add primary key (club_id, key); end if;
  if exists (select 1 from pg_constraint where conname = 'club_settings_pkey' and pg_get_constraintdef(oid) = 'PRIMARY KEY (key)') then
    alter table public.club_settings drop constraint club_settings_pkey; alter table public.club_settings add primary key (club_id, key); end if;
end $$;

-- ---------- 3. hulpfuncties: alles binnen de eigen club ----------
create or replace function public.is_trainer(t uuid) returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.team_trainers where team_id = t and user_id = auth.uid())
      or (public.in_my_club(t) and exists (select 1 from public.club_members where user_id = auth.uid() and (all_teams or t = any(team_access))));
$$;
create or replace function public.is_coach() returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.is_admin()
      or exists (select 1 from public.team_trainers where user_id = auth.uid())
      or exists (select 1 from public.club_members where user_id = auth.uid() and (all_teams or coalesce(array_length(team_access, 1), 0) > 0));
$$;
/* beheerder van de club waar deze ploeg bij hoort */
create or replace function public.is_team_admin(t uuid) returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.is_admin() and public.in_my_club(t);
$$;
create or replace function public.add_creator() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is not null then
    insert into public.team_trainers(team_id, user_id, email) values (new.id, auth.uid(), auth.jwt()->>'email') on conflict do nothing;
  end if;
  return new;
end $$;

-- ---------- 4. toegangsregels opnieuw, met de club erbij ----------
alter table public.clubs enable row level security;
drop policy if exists "eigen club lezen" on public.clubs;
create policy "eigen club lezen" on public.clubs for select to authenticated using (id = public.my_club() or public.is_platform_admin());
drop policy if exists "eigen club wijzigen" on public.clubs;
create policy "eigen club wijzigen" on public.clubs for update to authenticated using (id = public.my_club() and public.is_admin()) with check (id = public.my_club() and public.is_admin());
grant select, update on public.clubs to authenticated;

drop policy if exists "beheer aanwezigheden" on public.attendance;
create policy "beheer aanwezigheden" on public.attendance for all to authenticated using (public.is_team_admin(team_id)) with check (public.is_team_admin(team_id));
drop policy if exists "beoordelingen club" on public.attendance;
create policy "beoordelingen club" on public.attendance for select to authenticated using (public.is_coach() and public.in_my_club(team_id)
  and exists (select 1 from public.events e where e.id = attendance.event_id and e.type = 'wedstrijd'));

drop policy if exists "contacten beheren" on public.club_contacts;
create policy "contacten beheren" on public.club_contacts for all to authenticated using (public.is_admin() and club_id = public.my_club()) with check (public.is_admin() and club_id = public.my_club());
drop policy if exists "contacten lezen" on public.club_contacts;
create policy "contacten lezen" on public.club_contacts for select to authenticated using (club_id = public.my_club());

drop policy if exists "clubdocs" on public.club_docs;
create policy "clubdocs" on public.club_docs for all to authenticated using (club_id = public.my_club()) with check (club_id = public.my_club());

drop policy if exists "eval publicaties beheren" on public.eval_publicaties;
create policy "eval publicaties beheren" on public.eval_publicaties for all to authenticated using (public.is_trainer(team_id) or public.is_team_admin(team_id)) with check (public.is_trainer(team_id) or public.is_team_admin(team_id));
drop policy if exists "eval publicaties lezen" on public.eval_publicaties;
create policy "eval publicaties lezen" on public.eval_publicaties for select to authenticated using (public.in_my_club(team_id));

drop policy if exists "beheer kalender" on public.events;
create policy "beheer kalender" on public.events for all to authenticated using (public.is_team_admin(team_id)) with check (public.is_team_admin(team_id));
drop policy if exists "uitslagen club" on public.events;
create policy "uitslagen club" on public.events for select to authenticated using (type = 'wedstrijd' and public.in_my_club(team_id));

drop policy if exists "feedback beheren" on public.feedback;
create policy "feedback beheren" on public.feedback for all to authenticated using ((public.is_admin() and club_id = public.my_club()) or public.is_platform_admin()) with check ((public.is_admin() and club_id = public.my_club()) or public.is_platform_admin());

drop policy if exists "berichten lezen" on public.messages;
create policy "berichten lezen" on public.messages for select to authenticated using (club_id = public.my_club() and (team_id is null or public.is_trainer(team_id) or public.is_admin()));
drop policy if exists "berichten schrijven" on public.messages;
create policy "berichten schrijven" on public.messages for all to authenticated
  using (club_id = public.my_club() and ((team_id is null and public.is_admin()) or (team_id is not null and (public.is_trainer(team_id) or public.is_team_admin(team_id)))))
  with check (club_id = public.my_club() and ((team_id is null and public.is_admin()) or (team_id is not null and (public.is_trainer(team_id) or public.is_team_admin(team_id)))));

drop policy if exists "beheer spelers lezen" on public.players;
create policy "beheer spelers lezen" on public.players for select to authenticated using (public.is_team_admin(team_id));
drop policy if exists "beheer spelers toevoegen" on public.players;
create policy "beheer spelers toevoegen" on public.players for insert to authenticated with check (public.is_team_admin(team_id));
drop policy if exists "beheer spelers wijzigen" on public.players;
create policy "beheer spelers wijzigen" on public.players for update to authenticated using (public.is_team_admin(team_id)) with check (public.is_team_admin(team_id));

drop policy if exists "scouting lezen" on public.scouting;
create policy "scouting lezen" on public.scouting for select to authenticated using (public.heeft_recht('scouting') and club_id = public.my_club());
drop policy if exists "scouting toevoegen" on public.scouting;
create policy "scouting toevoegen" on public.scouting for insert to authenticated with check (public.heeft_recht('scouting') and club_id = public.my_club());
drop policy if exists "scouting verwijderen" on public.scouting;
create policy "scouting verwijderen" on public.scouting for delete to authenticated using (public.heeft_recht('scouting') and club_id = public.my_club()
  and (created_by = (select auth.uid()) or created_by is null or public.is_admin()));
drop policy if exists "scouting wijzigen" on public.scouting;
create policy "scouting wijzigen" on public.scouting for update to authenticated using (public.heeft_recht('scouting') and club_id = public.my_club()) with check (public.heeft_recht('scouting') and club_id = public.my_club());

drop policy if exists "trainer verwijderen" on public.team_trainers;
create policy "trainer verwijderen" on public.team_trainers for delete to authenticated using (public.is_team_admin(team_id));

drop policy if exists "beheer ploeg wijzigen" on public.teams;
create policy "beheer ploeg wijzigen" on public.teams for update to authenticated using (public.is_admin() and club_id = public.my_club()) with check (public.is_admin() and club_id = public.my_club());
drop policy if exists "ploeg lezen" on public.teams;
create policy "ploeg lezen" on public.teams for select to authenticated using (club_id = public.my_club() or public.is_trainer(id));
drop policy if exists "ploeg maken" on public.teams;
create policy "ploeg maken" on public.teams for insert to authenticated with check (public.is_admin() and club_id = public.my_club());
drop policy if exists "ploeg verwijderen" on public.teams;
create policy "ploeg verwijderen" on public.teams for delete to authenticated using (public.is_admin() and club_id = public.my_club());
drop policy if exists "ploeg wijzigen" on public.teams;
create policy "ploeg wijzigen" on public.teams for update to authenticated using (public.is_trainer(id)) with check (public.is_trainer(id) and club_id = public.my_club());

drop policy if exists "gedeelde items lezen" on public.trainer_items;
create policy "gedeelde items lezen" on public.trainer_items for select to authenticated using (shared and club_id = public.my_club());

drop policy if exists "gedeelde afbeeldingen lezen" on storage.objects;
create policy "gedeelde afbeeldingen lezen" on storage.objects for select to authenticated using (bucket_id = 'trainer-files' and exists (
  select 1 from public.trainer_items t where t.shared and t.club_id = public.my_club()
    and ((t.data->>'img_path') = objects.name or (t.data->'items') @> jsonb_build_array(jsonb_build_object('img_path', objects.name)))));

-- ---------- 5. functies van de app, nu per club ----------
create or replace function public.club_status() returns json language sql stable security definer set search_path to 'public' as $$
  select json_build_object('member', public.is_member(), 'admin', public.is_admin(), 'platform', public.is_platform_admin(),
    'all_teams', coalesce((select all_teams from public.club_members where user_id = auth.uid()), false),
    'team_access', coalesce((select to_json(team_access) from public.club_members where user_id = auth.uid()), '[]'::json),
    'functie', (select functie from public.club_members where user_id = auth.uid()),
    'rechten', coalesce((select to_json(rechten) from public.club_members where user_id = auth.uid()), '[]'::json),
    'club', (select json_build_object('id', c.id, 'name', c.name, 'short', c.short, 'slug', c.slug, 'settings', c.settings) from public.clubs c where c.id = public.my_club()));
$$;

create or replace function public.add_trainer(t uuid, mail text) returns text language plpgsql security definer set search_path to 'public' as $$
declare u uuid; other uuid;
begin
  if not public.is_team_admin(t) then raise exception 'Alleen de beheerder van deze club kan trainers aan een ploeg koppelen.'; end if;
  select id into u from auth.users where lower(email) = lower(trim(mail));
  if u is null then return 'geen_account'; end if;
  select club_id into other from public.club_members where user_id = u;
  if other is not null and other <> public.my_club() then raise exception 'Deze persoon is al lid van een andere club.'; end if;
  insert into public.club_members(user_id, email, club_id) values (u, lower(trim(mail)), public.my_club()) on conflict do nothing;
  insert into public.team_trainers(team_id, user_id, email) values (t, u, lower(trim(mail))) on conflict do nothing;
  return 'ok';
end $$;

create or replace function public.admin_set_trainer(t uuid, uid uuid, on_team boolean) returns void language plpgsql security definer set search_path to 'public' as $$
declare mail text; other uuid;
begin
  if not public.is_team_admin(t) then raise exception 'Alleen voor beheerders van de club.'; end if;
  if on_team then
    select email into mail from auth.users where id = uid;
    if mail is null then raise exception 'Dit account bestaat niet.'; end if;
    select club_id into other from public.club_members where user_id = uid;
    if other is not null and other <> public.my_club() then raise exception 'Deze persoon is al lid van een andere club.'; end if;
    insert into public.team_trainers(team_id, user_id, email) values (t, uid, lower(mail)) on conflict do nothing;
    insert into public.club_members(user_id, email, club_id) values (uid, mail, public.my_club()) on conflict do nothing;
  else
    delete from public.team_trainers where team_id = t and user_id = uid;
  end if;
end $$;

create or replace function public.admin_move_trainer(uid uuid, from_t uuid, to_t uuid) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_team_admin(to_t) then raise exception 'Alleen voor beheerders van de club.'; end if;
  perform public.admin_set_trainer(to_t, uid, true);
  if from_t is not null and from_t <> to_t and public.in_my_club(from_t) then delete from public.team_trainers where team_id = from_t and user_id = uid; end if;
end $$;

create or replace function public.admin_teams() returns json language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  return coalesce((select json_agg(json_build_object('id', t.id, 'name', t.name, 'category', t.category, 'season', t.season,
      'trainers', coalesce((select json_agg(json_build_object('user_id', tt.user_id, 'email', coalesce(u.email, tt.email), 'name', nullif(trim(u.raw_user_meta_data->>'full_name'), ''))
          order by coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), u.email, tt.email))
        from public.team_trainers tt left join auth.users u on u.id = tt.user_id where tt.team_id = t.id), '[]'::json))
    order by t.season desc nulls last, t.name) from public.teams t where t.club_id = public.my_club()), '[]'::json);
end $$;

create or replace function public.club_admin_info() returns json language plpgsql stable security definer set search_path to 'public' as $$
declare c uuid := public.my_club();
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  return json_build_object(
    'code', (select value from public.club_settings where club_id = c and key = 'invite_code'),
    'members', coalesce((select json_agg(json_build_object('user_id', m.user_id, 'email', m.email, 'role', m.role, 'created_at', m.created_at,
        'name', nullif(trim(u.raw_user_meta_data->>'full_name'), ''), 'all_teams', m.all_teams, 'functie', m.functie, 'team_access', m.team_access, 'rechten', m.rechten,
        'teams', (select string_agg(t.name, ', ' order by t.name) from public.team_trainers tt join public.teams t on t.id = tt.team_id where tt.user_id = m.user_id and t.club_id = c))
        order by m.role, coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), m.email)) from public.club_members m left join auth.users u on u.id = m.user_id where m.club_id = c), '[]'::json),
    /* wachtenden (account zonder club): enkel zichtbaar voor wie het platform beheert, zodat clubs elkaars aanmeldingen niet zien */
    'waiting', case when public.is_platform_admin() then coalesce((select json_agg(json_build_object('user_id', u.id, 'email', u.email, 'created_at', u.created_at, 'name', nullif(trim(u.raw_user_meta_data->>'full_name'), '')) order by u.created_at desc)
        from auth.users u where not exists (select 1 from public.club_members m where m.user_id = u.id)), '[]'::json) else '[]'::json end);
end $$;

create or replace function public.club_backup() returns json language plpgsql stable security definer set search_path to 'public' as $$
declare c uuid := public.my_club();
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  return json_build_object('made', now(), 'version', 15, 'club', (select row_to_json(x) from public.clubs x where x.id = c),
    'teams', (select coalesce(json_agg(t), '[]') from public.teams t where t.club_id = c),
    'team_trainers', (select coalesce(json_agg(t), '[]') from public.team_trainers t where public.in_my_club(t.team_id)),
    'players', (select coalesce(json_agg(t), '[]') from public.players t where public.in_my_club(t.team_id)),
    'events', (select coalesce(json_agg(t), '[]') from public.events t where public.in_my_club(t.team_id)),
    'attendance', (select coalesce(json_agg(t), '[]') from public.attendance t where public.in_my_club(t.team_id)),
    'evaluations', (select coalesce(json_agg(t), '[]') from public.evaluations t where public.in_my_club(t.team_id)),
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

create or replace function public.club_dashboard(since date) returns json language plpgsql stable security definer set search_path to 'public' as $$
declare me public.club_members%rowtype;
begin
  select * into me from public.club_members where user_id = auth.uid();
  if not found or not (me.role = 'admin' or me.all_teams or cardinality(me.team_access) > 0) then raise exception 'Alleen voor beheerders en coördinatoren.'; end if;
  return coalesce((select json_agg(x order by x->>'name') from (
    select json_build_object('id', t.id, 'name', t.name, 'category', t.category, 'format', t.format,
      'trainers', (select count(*) from public.team_trainers tt where tt.team_id = t.id),
      'players', (select count(*) from public.players pl where pl.team_id = t.id and pl.active),
      'trainings', (select count(*) from public.events e where e.team_id = t.id and e.type = 'training' and not e.cancelled and e.date between since and current_date),
      'trainings_att', (select count(*) from public.events e where e.team_id = t.id and e.type = 'training' and e.date between since and current_date and exists (select 1 from public.attendance a where a.event_id = e.id)),
      'trainings_plan', (select count(*) from public.events e where e.team_id = t.id and e.type = 'training' and e.date between since and current_date and e.plan is not null and e.plan::text not in ('null', '{}', '[]')),
      'att_pct', (select round(100.0 * count(*) filter (where a.status in ('aanwezig', 'te laat')) / nullif(count(*), 0)) from public.attendance a join public.events e on e.id = a.event_id where e.team_id = t.id and e.type = 'training' and e.date between since and current_date),
      'matches', (select count(*) from public.events e where e.team_id = t.id and e.type = 'wedstrijd' and e.date between since and current_date),
      'matches_report', (select count(*) from public.events e where e.team_id = t.id and e.type = 'wedstrijd' and e.date between since and current_date and e.score_for is not null),
      'evals', (select json_object_agg(m, n) from (select ev.moment m, count(*) n from public.evaluations ev join public.players pl on pl.id = ev.player_id where pl.team_id = t.id group by ev.moment) q),
      'next', (select min(e.date) from public.events e where e.team_id = t.id and e.date >= current_date)) x
    from public.teams t
    where t.club_id = me.club_id and (me.role = 'admin' or me.all_teams or t.id = any(me.team_access))) s), '[]'::json);
end $$;

create or replace function public.club_fields(d1 date, d2 date) returns json language sql stable security definer set search_path to 'public' as $$
  select case when not public.is_member() then '[]'::json else coalesce((select json_agg(json_build_object('id', e.id, 'team_id', e.team_id, 'team', t.name, 'type', e.type,
      'date', e.date, 'start', to_char(e.start_time, 'HH24:MI'), 'end', to_char(e.end_time, 'HH24:MI'), 'location', e.location, 'part', e.field_part, 'opponent', e.opponent,
      'kk_home', e.kk_home, 'kk_away', e.kk_away, 'referee', e.referee,
      'format', t.format, 'cancelled', e.cancelled or coalesce(e.rbfa_state, '') = 'afgelast') order by e.date, e.start_time)
    from public.events e join public.teams t on t.id = e.team_id
    where t.club_id = public.my_club() and e.date between d1 and least(d2, d1 + 400) and (e.type = 'training' or e.home is not false)), '[]'::json) end;
$$;

create or replace function public.club_set_access(uid uuid, alle boolean, fn text) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  update public.club_members set all_teams = coalesce(alle, false), functie = nullif(trim(coalesce(fn, '')), '') where user_id = uid and club_id = public.my_club();
end $$;

create or replace function public.club_set_rechten(uid uuid, r text[]) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  update public.club_members
     set rechten = coalesce((select array_agg(distinct x) from unnest(coalesce(r, '{}')) x where x in ('scouting', 'terreinen')), '{}')
   where user_id = uid and club_id = public.my_club();
end $$;

create or replace function public.club_set_team_access(uid uuid, teams uuid[]) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  update public.club_members set team_access = coalesce((select array_agg(x) from unnest(coalesce(teams, '{}')) x where public.in_my_club(x)), '{}')
   where user_id = uid and club_id = public.my_club();
end $$;

create or replace function public.club_set_member(uid uuid, r text) returns void language plpgsql security definer set search_path to 'public' as $$
declare other uuid;
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  if uid = auth.uid() and coalesce(r, '') <> 'admin' then raise exception 'Je kan jezelf niet verwijderen of je beheerrechten afnemen.'; end if;
  select club_id into other from public.club_members where user_id = uid;
  if other is not null and other <> public.my_club() then raise exception 'Deze persoon is lid van een andere club.'; end if;
  if r is null then
    delete from public.team_trainers where user_id = uid and public.in_my_club(team_id);
    delete from public.club_members where user_id = uid and club_id = public.my_club();
  else
    insert into public.club_members(user_id, email, role, club_id) values (uid, (select email from auth.users where id = uid), r, public.my_club())
    on conflict (user_id) do update set role = excluded.role where public.club_members.club_id = public.my_club();
  end if;
end $$;

create or replace function public.club_set_code(code text) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  if length(trim(coalesce(code, ''))) < 6 then raise exception 'De clubcode moet minstens 6 tekens hebben.'; end if;
  if exists (select 1 from public.club_settings where key = 'invite_code' and upper(value) = upper(trim(code)) and club_id <> public.my_club()) then
    raise exception 'Deze code is al in gebruik. Kies een andere.'; end if;
  insert into public.club_settings(club_id, key, value) values (public.my_club(), 'invite_code', upper(trim(code)))
  on conflict (club_id, key) do update set value = excluded.value;
end $$;

/* lid worden met de uitnodigingscode: de code bepaalt de club */
create or replace function public.join_club(code text) returns boolean language plpgsql security definer set search_path to 'public' as $$
declare c uuid;
begin
  if auth.uid() is null then return false; end if;
  select club_id into c from public.club_settings where key = 'invite_code' and upper(trim(value)) = upper(trim(coalesce(code, ''))) limit 1;
  if c is null then return false; end if;
  if exists (select 1 from public.club_members where user_id = auth.uid()) then return (select club_id = c from public.club_members where user_id = auth.uid()); end if;
  insert into public.club_members(user_id, email, club_id) values (auth.uid(), (select email from auth.users where id = auth.uid()), c) on conflict do nothing;
  return true;
end $$;

create or replace function public.join_on_signup() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare c uuid;
begin
  select club_id into c from public.club_settings where key = 'invite_code'
     and upper(trim(value)) = upper(trim(coalesce(new.raw_user_meta_data->>'invite', ''))) limit 1;
  if c is not null then
    insert into public.club_members(user_id, email, club_id) values (new.id, new.email, c) on conflict do nothing;
  end if;
  return new;
end $$;

create or replace function public.set_eval_publicatie(t uuid, m integer, aan boolean) returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if not (public.is_trainer(t) or public.is_team_admin(t)) then raise exception 'Alleen trainers van deze ploeg of de beheerder.'; end if;
  if m not between 1 and 5 then return false; end if;
  if aan then insert into public.eval_publicaties(team_id, moment) values (t, m) on conflict do nothing;
  else delete from public.eval_publicaties where team_id = t and moment = m; end if;
  return true;
end $$;

create or replace function public.zet_terreininfo(ev uuid, p jsonb) returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.heeft_recht('terreinen') then raise exception 'Je hebt geen recht om de terreinen in te delen. Vraag het aan de beheerder.'; end if;
  update public.events set
    location   = case when p ? 'location'   then nullif(p->>'location', '')        else location end,
    rbfa_loc   = case when p ? 'location'   then false                              else rbfa_loc end,
    start_time = case when p ? 'start_time' then nullif(p->>'start_time', '')::time else start_time end,
    end_time   = case when p ? 'end_time'   then nullif(p->>'end_time', '')::time   else end_time end,
    field_part = case when p ? 'field_part' then nullif(p->>'field_part', '')       else field_part end,
    kk_home    = case when p ? 'kk_home'    then nullif(p->>'kk_home', '')          else kk_home end,
    kk_away    = case when p ? 'kk_away'    then nullif(p->>'kk_away', '')          else kk_away end,
    referee    = case when p ? 'referee'    then nullif(p->>'referee', '')          else referee end
  where id = ev and public.in_my_club(team_id);
  return found;
end $$;

/* clubinstellingen (naam, logo, terreinen ...) door de beheerder van de club */
create or replace function public.club_save_settings(nm text, sh text, s jsonb) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  update public.clubs set name = coalesce(nullif(trim(nm), ''), name), short = coalesce(nullif(trim(sh), ''), short),
    settings = coalesce(s, settings) where id = public.my_club();
end $$;

/* nieuwe club aanmaken (enkel voor wie het platform beheert) */
create or replace function public.create_club(nm text, sh text, admin_mail text) returns json language plpgsql security definer set search_path to 'public' as $$
declare c uuid; code text; u uuid; other uuid; sl text;
begin
  if not public.is_platform_admin() then raise exception 'Alleen voor de beheerder van het platform.'; end if;
  if coalesce(trim(nm), '') = '' then raise exception 'Geef de club een naam.'; end if;
  sl := trim(both '-' from regexp_replace(lower(nm), '[^a-z0-9]+', '-', 'g'));
  if exists (select 1 from public.clubs x where x.slug = sl) then sl := sl || '-' || substr(md5(random()::text), 1, 4); end if;
  insert into public.clubs(name, short, slug) values (trim(nm), nullif(trim(coalesce(sh, '')), ''), sl) returning id into c;
  loop
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (select 1 from public.club_settings where key = 'invite_code' and value = code);
  end loop;
  insert into public.club_settings(club_id, key, value) values (c, 'invite_code', code);
  select id into u from auth.users where lower(email) = lower(trim(coalesce(admin_mail, '')));
  if u is not null then
    select club_id into other from public.club_members where user_id = u;
    if other is null then insert into public.club_members(user_id, email, role, club_id) values (u, lower(trim(admin_mail)), 'admin', c);
    else u := null; end if;
  end if;
  insert into public.club_settings(club_id, key, value) values (c, 'pending_admin', lower(trim(coalesce(admin_mail, '')))) on conflict do nothing;
  return json_build_object('id', c, 'name', trim(nm), 'code', code, 'admin', u is not null);
end $$;

/* beheerder die zich pas na het aanmaken van de club registreert: wordt automatisch beheerder als zijn e-mail klopt */
create or replace function public.claim_club_admin() returns boolean language plpgsql security definer set search_path to 'public' as $$
declare c uuid; mail text;
begin
  if auth.uid() is null or exists (select 1 from public.club_members where user_id = auth.uid()) then return false; end if;
  select lower(email) into mail from auth.users where id = auth.uid();
  select club_id into c from public.club_settings where key = 'pending_admin' and value = mail limit 1;
  if c is null then return false; end if;
  insert into public.club_members(user_id, email, role, club_id) values (auth.uid(), mail, 'admin', c);
  delete from public.club_settings where club_id = c and key = 'pending_admin';
  return true;
end $$;

create or replace function public.platform_clubs() returns json language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_platform_admin() then raise exception 'Alleen voor de beheerder van het platform.'; end if;
  return coalesce((select json_agg(json_build_object('id', c.id, 'name', c.name, 'short', c.short, 'created_at', c.created_at,
      'code', (select value from public.club_settings s where s.club_id = c.id and s.key = 'invite_code'),
      'pending_admin', (select value from public.club_settings s where s.club_id = c.id and s.key = 'pending_admin'),
      'members', (select count(*) from public.club_members m where m.club_id = c.id),
      'teams', (select count(*) from public.teams t where t.club_id = c.id)) order by c.created_at) from public.clubs c), '[]'::json);
end $$;

-- ouderpagina: berichten van de eigen club (niet van alle clubs)
do $$
declare d text;
begin
  select pg_get_functiondef('public.parent_view(uuid)'::regprocedure) into d;
  if position('m.team_id is null or m.team_id = p.team_id' in d) > 0 then
    d := replace(d, 'm.team_id is null or m.team_id = p.team_id',
      'm.team_id = p.team_id or (m.team_id is null and m.club_id = (select tt.club_id from public.teams tt where tt.id = p.team_id))');
    execute d;
  end if;
  /* naam en logo van de club mee voor de ouderpagina */
  select pg_get_functiondef('public.parent_view(uuid)'::regprocedure) into d;
  if position($q$json_build_object('v', 18,$q$ in d) > 0 and position($q$'club', (select$q$ in d) = 0 then
    d := replace(d, $q$json_build_object('v', 18,$q$, $q$json_build_object('v', 18, 'club', (select json_build_object('name', c.name, 'short', c.short, 'full', c.settings->>'full', 'logo', c.settings->>'logo') from public.clubs c join public.teams tt on tt.club_id = c.id where tt.id = p.team_id),$q$);
    execute d;
  end if;
end $$;

grant execute on function public.my_club(), public.is_platform_admin(), public.in_my_club(uuid), public.is_team_admin(uuid),
  public.club_save_settings(text, text, jsonb), public.create_club(text, text, text), public.claim_club_admin(), public.platform_clubs() to authenticated;
revoke execute on function public.create_club(text, text, text), public.platform_clubs(), public.claim_club_admin() from anon;

commit;
