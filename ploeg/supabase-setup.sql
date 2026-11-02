-- OGV Ploegapp: ploegen, spelers, kalender, aanwezigheden, verslagen, evaluaties en doelen.
-- Plak dit volledig in Supabase → SQL Editor → New query → Run. Je mag het opnieuw uitvoeren; het overschrijft niets.
-- Toegang: een trainer ziet alleen de ploegen waar hij als trainer aan gekoppeld is (Row Level Security).

create extension if not exists pgcrypto;

-- ---------- tabellen ----------
create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  category   text,                      -- bv. U9
  format     text,                      -- 5v5 / 8v8 / 11v11
  season     text,                      -- bv. 2026-2027
  criteria   jsonb not null default '["Techniek (controle over de bal)","Afwerking","Conditie","Coaching","Bijdrage aan de ploeg","Potentieel"]',
  worktags   jsonb not null default '["Zelfvertrouwen & durven","Zichtbaarheid & betrokkenheid","Te veel dribbelen","Afwerking","Positiespel","Rust & tijd aan de bal","Techniek & passing","Coaching & praten","Mentaliteit & focus","Duelkracht","Verdedigen"]',
  created_at timestamptz not null default now()
);

create table if not exists public.team_trainers (
  team_id  uuid not null references public.teams(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  email    text,
  added_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.players (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references public.teams(id) on delete cascade,
  first_name     text not null,
  last_name      text not null default '',
  birthdate      date,
  number         integer,
  position       text,
  foot           text,
  parent_contact text,
  notes          text,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams(id) on delete cascade,
  type          text not null check (type in ('training','wedstrijd')),
  date          date not null,
  start_time    time,
  end_time      time,
  location      text,
  opponent      text,
  home          boolean,
  theme         text,                   -- bv. 1A Opbouw van achteruit
  score_for     integer,
  score_against integer,
  report_good   text,
  report_better text,
  report_notes  text,
  created_at    timestamptz not null default now()
);

create table if not exists public.attendance (
  event_id uuid not null references public.events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  team_id  uuid not null references public.teams(id) on delete cascade,
  status   text not null default 'aanwezig' check (status in ('aanwezig','afwezig','verwittigd','geblesseerd','te laat')),
  role     text check (role in ('basis','wissel')),
  minutes  integer,
  goals    integer,
  assists  integer,
  rating   integer check (rating between 1 and 10),
  tags     jsonb not null default '[]',
  note     text,
  primary key (event_id, player_id)
);

create table if not exists public.evaluations (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  moment     integer not null check (moment between 1 and 4),
  date       date,
  scores     jsonb not null default '{}',
  comment    text,
  unique (player_id, moment)
);

create table if not exists public.goals (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  text       text not null,
  area       text,                      -- Techniek / Tactiek / Fysiek / Mentaal
  term       text,                      -- kort / middellang / lang
  status     text not null default 'bezig' check (status in ('bezig','gehaald','gestopt')),
  created_at timestamptz not null default now()
);

create index if not exists players_team on public.players(team_id);
create index if not exists events_team_date on public.events(team_id, date);
create index if not exists attendance_team on public.attendance(team_id);
create index if not exists evaluations_team on public.evaluations(team_id);
create index if not exists goals_team on public.goals(team_id);

-- ---------- toegangscontrole ----------
create or replace function public.is_trainer(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_trainers where team_id = t and user_id = auth.uid());
$$;

-- wie een ploeg aanmaakt, wordt er automatisch trainer van
create or replace function public.add_creator() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.team_trainers(team_id, user_id, email) values (new.id, auth.uid(), auth.jwt()->>'email')
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists teams_add_creator on public.teams;
create trigger teams_add_creator after insert on public.teams for each row execute function public.add_creator();

-- een co-trainer toevoegen op e-mailadres (zijn account moet al bestaan)
create or replace function public.add_trainer(t uuid, mail text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_trainer(t) then raise exception 'Je bent geen trainer van deze ploeg.'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(mail));
  if uid is null then return 'geen_account'; end if;
  insert into public.team_trainers(team_id, user_id, email) values (t, uid, lower(trim(mail))) on conflict do nothing;
  return 'ok';
end $$;

alter table public.teams         enable row level security;
alter table public.team_trainers enable row level security;
alter table public.players       enable row level security;
alter table public.events        enable row level security;
alter table public.attendance    enable row level security;
alter table public.evaluations   enable row level security;
alter table public.goals         enable row level security;

drop policy if exists "ploeg lezen" on public.teams;
drop policy if exists "ploeg maken" on public.teams;
drop policy if exists "ploeg wijzigen" on public.teams;
drop policy if exists "ploeg verwijderen" on public.teams;
create policy "ploeg lezen"      on public.teams for select to authenticated using (public.is_trainer(id));
create policy "ploeg maken"      on public.teams for insert to authenticated with check (true);
create policy "ploeg wijzigen"   on public.teams for update to authenticated using (public.is_trainer(id)) with check (public.is_trainer(id));
create policy "ploeg verwijderen" on public.teams for delete to authenticated using (public.is_trainer(id));

drop policy if exists "trainers lezen" on public.team_trainers;
drop policy if exists "trainer verwijderen" on public.team_trainers;
create policy "trainers lezen"      on public.team_trainers for select to authenticated using (public.is_trainer(team_id));
create policy "trainer verwijderen" on public.team_trainers for delete to authenticated using (public.is_trainer(team_id));

do $$
declare t text;
begin
  foreach t in array array['players','events','attendance','evaluations','goals'] loop
    execute format('drop policy if exists "ploegdata" on public.%I', t);
    execute format('create policy "ploegdata" on public.%I for all to authenticated using (public.is_trainer(team_id)) with check (public.is_trainer(team_id))', t);
  end loop;
end $$;

grant select, insert, update, delete on public.teams, public.team_trainers, public.players, public.events,
  public.attendance, public.evaluations, public.goals to authenticated;
grant execute on function public.is_trainer(uuid), public.add_trainer(uuid, text) to authenticated;
revoke all on function public.add_trainer(uuid, text) from anon;

-- =====================================================================
-- Versie 2: één platform. Uitgebreid wedstrijdverslag, live coachen,
-- club-uitslagen voor alle trainers, trainingsplan, scouting en mixschema.
-- =====================================================================
alter table public.teams      add column if not exists share_ratings  boolean not null default false;
alter table public.teams      add column if not exists periods        integer;
alter table public.teams      add column if not exists period_minutes integer;
alter table public.events     add column if not exists report jsonb not null default '{}';
alter table public.events     add column if not exists live   jsonb;
alter table public.events     add column if not exists plan   jsonb;
alter table public.events     add column if not exists lineup jsonb;
alter table public.attendance add column if not exists position    text;
alter table public.attendance add column if not exists scores      jsonb not null default '{}';
alter table public.attendance add column if not exists strengths   jsonb not null default '[]';
alter table public.attendance add column if not exists player_name text;

-- Alle trainers zien de namen van alle ploegen, en alle wedstrijden met uitslag en verslag.
drop policy if exists "ploeg lezen" on public.teams;
create policy "ploeg lezen" on public.teams for select to authenticated using (true);
drop policy if exists "uitslagen club" on public.events;
create policy "uitslagen club" on public.events for select to authenticated using (type = 'wedstrijd');

-- Spelersbeoordelingen van een wedstrijd: alleen zichtbaar voor andere trainers als de ploeg dat aanzet.
create or replace function public.shares_ratings(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select share_ratings from public.teams where id = t), false);
$$;
drop policy if exists "beoordelingen club" on public.attendance;
create policy "beoordelingen club" on public.attendance for select to authenticated
  using (public.shares_ratings(team_id) and exists (select 1 from public.events e where e.id = event_id and e.type = 'wedstrijd'));
grant execute on function public.shares_ratings(uuid) to authenticated;

-- Scouting: één gedeelde database voor alle trainers. Verwijderen kan alleen wie de speler toevoegde.
create table if not exists public.scouting (
  id         text primary key,
  data       jsonb not null,
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
alter table public.scouting enable row level security;
drop policy if exists "scouting lezen" on public.scouting;
drop policy if exists "scouting toevoegen" on public.scouting;
drop policy if exists "scouting wijzigen" on public.scouting;
drop policy if exists "scouting verwijderen" on public.scouting;
create policy "scouting lezen"       on public.scouting for select to authenticated using (true);
create policy "scouting toevoegen"   on public.scouting for insert to authenticated with check (true);
create policy "scouting wijzigen"    on public.scouting for update to authenticated using (true) with check (true);
create policy "scouting verwijderen" on public.scouting for delete to authenticated using (created_by = auth.uid() or created_by is null);
grant select, insert, update, delete on public.scouting to authenticated;

-- Clubdocumenten (bv. de namen in het mixschema): leesbaar en aanpasbaar voor alle trainers.
create table if not exists public.club_docs (
  key        text primary key,
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.club_docs enable row level security;
drop policy if exists "clubdocs" on public.club_docs;
create policy "clubdocs" on public.club_docs for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.club_docs to authenticated;

-- =====================================================================
-- Versie 3: persoonlijke opslag per trainer.
-- Documenten, spelprincipes, oefeningen, mixschema's en videoprojecten: alleen zichtbaar voor de trainer zelf.
-- =====================================================================
create table if not exists public.trainer_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('document','principe','oefening','mixschema','videoproject','training')),
  title      text not null default '',
  folder     text,
  data       jsonb not null default '{}',
  file_path  text,
  file_name  text,
  file_type  text,
  file_size  bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trainer_items_user on public.trainer_items(user_id, kind);
alter table public.trainer_items enable row level security;
drop policy if exists "eigen items" on public.trainer_items;
create policy "eigen items" on public.trainer_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.trainer_items to authenticated;

-- Bestanden: privé map per trainer (map = zijn gebruikers-id), maximaal 50 MB per bestand.
insert into storage.buckets (id, name, public, file_size_limit)
values ('trainer-files', 'trainer-files', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;
drop policy if exists "eigen bestanden lezen" on storage.objects;
drop policy if exists "eigen bestanden toevoegen" on storage.objects;
drop policy if exists "eigen bestanden wijzigen" on storage.objects;
drop policy if exists "eigen bestanden verwijderen" on storage.objects;
create policy "eigen bestanden lezen" on storage.objects for select to authenticated
  using (bucket_id = 'trainer-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "eigen bestanden toevoegen" on storage.objects for insert to authenticated
  with check (bucket_id = 'trainer-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "eigen bestanden wijzigen" on storage.objects for update to authenticated
  using (bucket_id = 'trainer-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "eigen bestanden verwijderen" on storage.objects for delete to authenticated
  using (bucket_id = 'trainer-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- Versie 4: wedstrijden automatisch overnemen van RBFA en link naar het officiële wedstrijdblad.
-- =====================================================================
alter table public.teams  add column if not exists rbfa_team_id   text;
alter table public.teams  add column if not exists rbfa_synced_at timestamptz;
alter table public.teams  add column if not exists sheet_url      text;
alter table public.events add column if not exists rbfa_id        text;
alter table public.events add column if not exists rbfa_state     text;
alter table public.events add column if not exists rbfa_loc       boolean;
alter table public.events add column if not exists sheet_url      text;
create unique index if not exists events_rbfa on public.events(team_id, rbfa_id) where rbfa_id is not null;

-- =====================================================================
-- Versie 5: clubtoegang met clubcode, ouders bevestigen aanwezigheid, nieuw seizoen.
-- =====================================================================
-- Wie mag de clubgegevens zien? Alleen leden van de club (niet zomaar elk account).
create table if not exists public.club_members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null default 'trainer' check (role in ('trainer','admin')),
  created_at timestamptz not null default now()
);
create table if not exists public.club_settings (key text primary key, value text);
alter table public.club_members  enable row level security;  -- geen policies: alleen via de functies hieronder
alter table public.club_settings enable row level security;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.club_members where user_id = auth.uid());
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.club_members where user_id = auth.uid() and role = 'admin');
$$;

-- bestaande accounts werden door de beheerder aangemaakt: die zijn allemaal lid
insert into public.club_members(user_id, email) select id, email from auth.users on conflict do nothing;
update public.club_members set role = 'admin' where lower(email) = lower('arneschepens5@gmail.com');
insert into public.club_settings(key, value) values ('invite_code', 'OGV-' || upper(substr(md5(random()::text), 1, 6))) on conflict do nothing;

create or replace function public.club_status() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('member', public.is_member(), 'admin', public.is_admin());
$$;
create or replace function public.join_club(code text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if not exists (select 1 from public.club_settings where key = 'invite_code' and upper(trim(value)) = upper(trim(coalesce(code, '')))) then return false; end if;
  insert into public.club_members(user_id, email) values (auth.uid(), (select email from auth.users where id = auth.uid())) on conflict do nothing;
  return true;
end $$;
-- registreren met de clubcode: meteen lid
create or replace function public.join_on_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.club_settings where key = 'invite_code'
             and upper(trim(value)) = upper(trim(coalesce(new.raw_user_meta_data->>'invite', '')))) then
    insert into public.club_members(user_id, email) values (new.id, new.email) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists ogv_join_on_signup on auth.users;
create trigger ogv_join_on_signup after insert on auth.users for each row execute function public.join_on_signup();

-- beheer (alleen beheerders)
create or replace function public.club_admin_info() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  return json_build_object(
    'code', (select value from public.club_settings where key = 'invite_code'),
    'members', coalesce((select json_agg(json_build_object('user_id', m.user_id, 'email', m.email, 'role', m.role, 'created_at', m.created_at,
        'teams', (select string_agg(t.name, ', ' order by t.name) from public.team_trainers tt join public.teams t on t.id = tt.team_id where tt.user_id = m.user_id))
        order by m.role, m.email) from public.club_members m), '[]'::json),
    'waiting', coalesce((select json_agg(json_build_object('user_id', u.id, 'email', u.email, 'created_at', u.created_at) order by u.created_at desc)
        from auth.users u where not exists (select 1 from public.club_members m where m.user_id = u.id)), '[]'::json));
end $$;
create or replace function public.club_set_code(code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  if length(trim(coalesce(code, ''))) < 6 then raise exception 'De clubcode moet minstens 6 tekens hebben.'; end if;
  insert into public.club_settings(key, value) values ('invite_code', upper(trim(code))) on conflict (key) do update set value = excluded.value;
end $$;
create or replace function public.club_set_member(uid uuid, r text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  if uid = auth.uid() and coalesce(r, '') <> 'admin' then raise exception 'Je kan jezelf niet verwijderen of je beheerrechten afnemen.'; end if;
  if r is null then
    delete from public.team_trainers where user_id = uid;
    delete from public.club_members where user_id = uid;
  else
    insert into public.club_members(user_id, email, role) values (uid, (select email from auth.users where id = uid), r)
    on conflict (user_id) do update set role = excluded.role;
  end if;
end $$;

-- een co-trainer toevoegen maakt hem ook lid van de club
create or replace function public.add_trainer(t uuid, mail text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_trainer(t) then raise exception 'Je bent geen trainer van deze ploeg.'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(mail));
  if uid is null then return 'geen_account'; end if;
  insert into public.club_members(user_id, email) values (uid, lower(trim(mail))) on conflict do nothing;
  insert into public.team_trainers(team_id, user_id, email) values (t, uid, lower(trim(mail))) on conflict do nothing;
  return 'ok';
end $$;

-- clubbrede leesrechten voortaan alleen voor leden
drop policy if exists "ploeg lezen" on public.teams;
create policy "ploeg lezen" on public.teams for select to authenticated using (public.is_member() or public.is_trainer(id));
drop policy if exists "ploeg maken" on public.teams;
create policy "ploeg maken" on public.teams for insert to authenticated with check (public.is_member());
drop policy if exists "uitslagen club" on public.events;
create policy "uitslagen club" on public.events for select to authenticated using (type = 'wedstrijd' and public.is_member());
drop policy if exists "beoordelingen club" on public.attendance;
create policy "beoordelingen club" on public.attendance for select to authenticated
  using (public.is_member() and public.shares_ratings(team_id) and exists (select 1 from public.events e where e.id = event_id and e.type = 'wedstrijd'));
drop policy if exists "scouting lezen" on public.scouting;
drop policy if exists "scouting toevoegen" on public.scouting;
drop policy if exists "scouting wijzigen" on public.scouting;
drop policy if exists "scouting verwijderen" on public.scouting;
create policy "scouting lezen"       on public.scouting for select to authenticated using (public.is_member());
create policy "scouting toevoegen"   on public.scouting for insert to authenticated with check (public.is_member());
create policy "scouting wijzigen"    on public.scouting for update to authenticated using (public.is_member()) with check (public.is_member());
create policy "scouting verwijderen" on public.scouting for delete to authenticated using (public.is_member() and (created_by = auth.uid() or created_by is null));
drop policy if exists "clubdocs" on public.club_docs;
create policy "clubdocs" on public.club_docs for all to authenticated using (public.is_member()) with check (public.is_member());

grant execute on function public.is_member(), public.is_admin(), public.club_status(), public.join_club(text), public.club_admin_info(),
  public.club_set_code(text), public.club_set_member(uuid, text) to authenticated;

-- Ouders: elke speler krijgt een geheime link waarmee de ouders aanwezigheid bevestigen.
alter table public.players add column if not exists parent_token uuid not null default gen_random_uuid();
create unique index if not exists players_parent_token on public.players(parent_token);
alter table public.players add column if not exists history jsonb not null default '[]';
create table if not exists public.rsvp (
  event_id   uuid not null references public.events(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  team_id    uuid not null references public.teams(id) on delete cascade,
  status     text not null check (status in ('ja','nee')),
  note       text,
  updated_at timestamptz not null default now(),
  primary key (event_id, player_id)
);
alter table public.rsvp enable row level security;
drop policy if exists "ploegdata" on public.rsvp;
create policy "ploegdata" on public.rsvp for all to authenticated using (public.is_trainer(team_id)) with check (public.is_trainer(team_id));
grant select, insert, update, delete on public.rsvp to authenticated;

-- wat ouders zien: enkel de voornaam, de ploeg en de activiteiten van de komende 6 weken
create or replace function public.parent_view(tok uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare p public.players%rowtype;
begin
  select * into p from public.players where parent_token = tok and active is not false;
  if not found then return null; end if;
  return json_build_object('player', p.first_name, 'team', (select name from public.teams where id = p.team_id),
    'events', coalesce((select json_agg(json_build_object('id', e.id, 'type', e.type, 'date', e.date,
        'start', to_char(e.start_time, 'HH24:MI'), 'end', to_char(e.end_time, 'HH24:MI'), 'location', e.location,
        'opponent', e.opponent, 'home', e.home, 'state', e.rbfa_state,
        'rsvp', r.status, 'note', r.note) order by e.date, e.start_time)
      from public.events e left join public.rsvp r on r.event_id = e.id and r.player_id = p.id
      where e.team_id = p.team_id and e.date between current_date and current_date + 42), '[]'::json));
end $$;
create or replace function public.parent_rsvp(tok uuid, ev uuid, st text, msg text) returns boolean
language plpgsql security definer set search_path = public as $$
declare p public.players%rowtype;
begin
  select * into p from public.players where parent_token = tok and active is not false;
  if not found then return false; end if;
  if not exists (select 1 from public.events where id = ev and team_id = p.team_id and date >= current_date) then return false; end if;
  if st is null then delete from public.rsvp where event_id = ev and player_id = p.id; return true; end if;
  if st not in ('ja', 'nee') then return false; end if;
  insert into public.rsvp(event_id, player_id, team_id, status, note, updated_at)
  values (ev, p.id, p.team_id, st, nullif(left(trim(coalesce(msg, '')), 200), ''), now())
  on conflict (event_id, player_id) do update set status = excluded.status, note = excluded.note, updated_at = now();
  return true;
end $$;
grant execute on function public.parent_view(uuid), public.parent_rsvp(uuid, uuid, text, text) to anon, authenticated;
