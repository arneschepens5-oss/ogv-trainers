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
alter table public.attendance add column if not exists rated_by    text;
alter table public.attendance add column if not exists rated_by_id uuid;

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
-- (alleen bij de allereerste installatie, zodat dit script veilig opnieuw uitgevoerd kan worden)
insert into public.club_members(user_id, email) select id, email from auth.users
  where not exists (select 1 from public.club_members) on conflict do nothing;
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

-- =====================================================================
-- Versie 6: uitgebreide evaluaties (sterktes, werkpunten, doelen, oudergesprek).
-- =====================================================================
alter table public.evaluations add column if not exists details jsonb not null default '{}';
-- vijf momenten: start, herfst, winterstop (verplicht), maart, einde seizoen (verplicht)
alter table public.evaluations drop constraint if exists evaluations_moment_check;
alter table public.evaluations add constraint evaluations_moment_check check (moment between 1 and 5);

-- =====================================================================
-- Versie 7: oefenstof en trainingssjablonen delen met alle trainers van de club.
-- Een gedeeld item kan elk clublid lezen (en kopiëren); alleen de maker kan het wijzigen of verwijderen.
-- De veldtekening van een gedeelde oefening wordt automatisch mee leesbaar.
-- =====================================================================
alter table public.trainer_items add column if not exists shared boolean not null default false;
create index if not exists trainer_items_shared on public.trainer_items(kind) where shared;
create index if not exists trainer_items_img on public.trainer_items((data->>'img_path')) where shared;
drop policy if exists "gedeelde items lezen" on public.trainer_items;
create policy "gedeelde items lezen" on public.trainer_items for select to authenticated
  using (shared and public.is_member());
drop policy if exists "gedeelde afbeeldingen lezen" on storage.objects;
create policy "gedeelde afbeeldingen lezen" on storage.objects for select to authenticated
  using (bucket_id = 'trainer-files' and public.is_member()
         and exists (select 1 from public.trainer_items t where t.shared and t.data->>'img_path' = storage.objects.name));
-- de overgenomen PSD-oefendatabank meteen delen met de club
update public.trainer_items set shared = true, data = data || jsonb_build_object('shared_by', 'Arne Schepens')
  where data->>'source' = 'PSD' and not shared;

-- =====================================================================
-- Versie 8: de beheerder beheert de trainers van alle ploegen
-- (toevoegen, verplaatsen naar een andere ploeg, verwijderen bij een ploeg).
-- =====================================================================
create or replace function public.admin_teams() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  return coalesce((select json_agg(json_build_object('id', t.id, 'name', t.name, 'category', t.category, 'season', t.season,
      'trainers', coalesce((select json_agg(json_build_object('user_id', tt.user_id, 'email', coalesce(u.email, tt.email)) order by coalesce(u.email, tt.email))
        from public.team_trainers tt left join auth.users u on u.id = tt.user_id where tt.team_id = t.id), '[]'::json))
    order by t.season desc nulls last, t.name) from public.teams t), '[]'::json);
end $$;
create or replace function public.admin_set_trainer(t uuid, uid uuid, on_team boolean) returns void
language plpgsql security definer set search_path = public as $$
declare mail text;
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  if on_team then
    select email into mail from auth.users where id = uid;
    if mail is null then raise exception 'Dit account bestaat niet.'; end if;
    insert into public.team_trainers(team_id, user_id, email) values (t, uid, lower(mail)) on conflict do nothing;
    insert into public.club_members(user_id, email) values (uid, mail) on conflict do nothing;
  else
    delete from public.team_trainers where team_id = t and user_id = uid;
  end if;
end $$;
create or replace function public.admin_move_trainer(uid uuid, from_t uuid, to_t uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  perform public.admin_set_trainer(to_t, uid, true);
  if from_t is not null and from_t <> to_t then delete from public.team_trainers where team_id = from_t and user_id = uid; end if;
end $$;
revoke all on function public.admin_teams(), public.admin_set_trainer(uuid, uuid, boolean), public.admin_move_trainer(uuid, uuid, uuid) from anon, public;
grant execute on function public.admin_teams(), public.admin_set_trainer(uuid, uuid, boolean), public.admin_move_trainer(uuid, uuid, uuid) to authenticated;

-- =====================================================================
-- Versie 9: namen van trainers tonen in clubbeheer (uit het account).
-- =====================================================================
create or replace function public.club_admin_info() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  return json_build_object(
    'code', (select value from public.club_settings where key = 'invite_code'),
    'members', coalesce((select json_agg(json_build_object('user_id', m.user_id, 'email', m.email, 'role', m.role, 'created_at', m.created_at,
        'name', nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
        'teams', (select string_agg(t.name, ', ' order by t.name) from public.team_trainers tt join public.teams t on t.id = tt.team_id where tt.user_id = m.user_id))
        order by m.role, coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), m.email)) from public.club_members m left join auth.users u on u.id = m.user_id), '[]'::json),
    'waiting', coalesce((select json_agg(json_build_object('user_id', u.id, 'email', u.email, 'created_at', u.created_at, 'name', nullif(trim(u.raw_user_meta_data->>'full_name'), '')) order by u.created_at desc)
        from auth.users u where not exists (select 1 from public.club_members m where m.user_id = u.id)), '[]'::json));
end $$;
create or replace function public.admin_teams() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  return coalesce((select json_agg(json_build_object('id', t.id, 'name', t.name, 'category', t.category, 'season', t.season,
      'trainers', coalesce((select json_agg(json_build_object('user_id', tt.user_id, 'email', coalesce(u.email, tt.email), 'name', nullif(trim(u.raw_user_meta_data->>'full_name'), ''))
          order by coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), u.email, tt.email))
        from public.team_trainers tt left join auth.users u on u.id = tt.user_id where tt.team_id = t.id), '[]'::json))
    order by t.season desc nulls last, t.name) from public.teams t), '[]'::json);
end $$;

-- =====================================================================
-- Versie 10: meldingen van trainers ("Probleem melden") voor de beheerder.
-- =====================================================================
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid default auth.uid() references auth.users(id) on delete set null,
  email      text,
  name       text,
  kind       text,
  page       text,
  message    text not null,
  info       jsonb not null default '{}',
  status     text not null default 'nieuw',
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
drop policy if exists "feedback geven" on public.feedback;
drop policy if exists "feedback beheren" on public.feedback;
create policy "feedback geven"   on public.feedback for insert to authenticated with check (user_id = auth.uid());
create policy "feedback beheren" on public.feedback for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.feedback to authenticated;

-- =====================================================================
-- Versie 11: alleen de beheerder maakt ploegen aan, verwijdert ze en koppelt trainers.
-- Trainers passen de instellingen, spelers en activiteiten van hun eigen ploeg nog wel zelf aan.
-- =====================================================================
drop policy if exists "ploeg maken" on public.teams;
create policy "ploeg maken" on public.teams for insert to authenticated with check (public.is_admin());
drop policy if exists "ploeg verwijderen" on public.teams;
create policy "ploeg verwijderen" on public.teams for delete to authenticated using (public.is_admin());
drop policy if exists "trainer verwijderen" on public.team_trainers;
create policy "trainer verwijderen" on public.team_trainers for delete to authenticated using (public.is_admin());
create or replace function public.add_trainer(t uuid, mail text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Alleen de beheerder kan trainers aan een ploeg koppelen.'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(mail));
  if uid is null then return 'geen_account'; end if;
  insert into public.club_members(user_id, email) values (uid, lower(trim(mail))) on conflict do nothing;
  insert into public.team_trainers(team_id, user_id, email) values (t, uid, lower(trim(mail))) on conflict do nothing;
  return 'ok';
end $$;

-- =====================================================================
-- Versie 12: functies in de club (TVJO, ICT, coördinator…) en toegang tot alle ploegen zonder trainer te zijn,
-- plus de lijst met contactpersonen ("Wie contacteer ik?") die de beheerder invult.
-- =====================================================================
alter table public.club_members add column if not exists all_teams boolean not null default false;
alter table public.club_members add column if not exists functie   text;
create or replace function public.is_trainer(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_trainers where team_id = t and user_id = auth.uid())
      or exists (select 1 from public.club_members where user_id = auth.uid() and all_teams);
$$;
create or replace function public.club_status() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('member', public.is_member(), 'admin', public.is_admin(),
    'all_teams', coalesce((select all_teams from public.club_members where user_id = auth.uid()), false),
    'functie', (select functie from public.club_members where user_id = auth.uid()));
$$;
create or replace function public.club_set_access(uid uuid, alle boolean, fn text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  update public.club_members set all_teams = coalesce(alle, false), functie = nullif(trim(coalesce(fn, '')), '') where user_id = uid;
end $$;
revoke all on function public.club_set_access(uuid, boolean, text) from anon, public;
grant execute on function public.club_set_access(uuid, boolean, text), public.club_status() to authenticated;
create or replace function public.club_admin_info() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  return json_build_object(
    'code', (select value from public.club_settings where key = 'invite_code'),
    'members', coalesce((select json_agg(json_build_object('user_id', m.user_id, 'email', m.email, 'role', m.role, 'created_at', m.created_at,
        'name', nullif(trim(u.raw_user_meta_data->>'full_name'), ''), 'all_teams', m.all_teams, 'functie', m.functie,
        'teams', (select string_agg(t.name, ', ' order by t.name) from public.team_trainers tt join public.teams t on t.id = tt.team_id where tt.user_id = m.user_id))
        order by m.role, coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), m.email)) from public.club_members m left join auth.users u on u.id = m.user_id), '[]'::json),
    'waiting', coalesce((select json_agg(json_build_object('user_id', u.id, 'email', u.email, 'created_at', u.created_at, 'name', nullif(trim(u.raw_user_meta_data->>'full_name'), '')) order by u.created_at desc)
        from auth.users u where not exists (select 1 from public.club_members m where m.user_id = u.id)), '[]'::json));
end $$;

create table if not exists public.club_contacts (
  id         uuid primary key default gen_random_uuid(),
  cat        text not null default 'Algemeen',
  topic      text not null,
  name       text,
  functie    text,
  phone      text,
  email      text,
  note       text,
  sort       integer not null default 100,
  updated_at timestamptz not null default now()
);
alter table public.club_contacts enable row level security;
drop policy if exists "contacten lezen" on public.club_contacts;
drop policy if exists "contacten beheren" on public.club_contacts;
create policy "contacten lezen"   on public.club_contacts for select to authenticated using (public.is_member());
create policy "contacten beheren" on public.club_contacts for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.club_contacts to authenticated;

-- Versie 13: beheerders plannen vaste trainingen in voor ploegen (bv. elke maandag 18:00).
-- Alle trainingen die in één keer worden ingepland, delen een reeks-id. Trainers kunnen ze nadien
-- gewoon aanpassen of verwijderen en zelf extra trainingen toevoegen.
alter table public.events add column if not exists series text;
create index if not exists events_series on public.events(series) where series is not null;
drop policy if exists "beheer trainingen inplannen" on public.events;
create policy "beheer trainingen inplannen" on public.events for all to authenticated
  using (public.is_admin() and type = 'training') with check (public.is_admin() and type = 'training');

-- =====================================================================
-- Versie 14: ouders (convocaties en berichten), oudercontacten en medische info, toegang per ploegenselectie
-- (bv. coördinator onderbouw), clubdashboard, terreinoverzicht en back-up voor de beheerder.
-- =====================================================================
alter table public.events  add column if not exists convo     jsonb;     -- {players:[id], meet, place, bring, note, sent}
alter table public.events  add column if not exists cancelled boolean not null default false;
alter table public.players add column if not exists contacts  jsonb not null default '[]'; -- [{name, rel, phone, email}]
alter table public.players add column if not exists medical   text;     -- allergieën, medicatie, aandachtspunten (enkel voor de trainers van de ploeg)
alter table public.club_members add column if not exists team_access uuid[] not null default '{}';

create or replace function public.is_trainer(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_trainers where team_id = t and user_id = auth.uid())
      or exists (select 1 from public.club_members where user_id = auth.uid() and (all_teams or t = any(team_access)));
$$;
create or replace function public.club_status() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('member', public.is_member(), 'admin', public.is_admin(),
    'all_teams', coalesce((select all_teams from public.club_members where user_id = auth.uid()), false),
    'team_access', coalesce((select to_json(team_access) from public.club_members where user_id = auth.uid()), '[]'::json),
    'functie', (select functie from public.club_members where user_id = auth.uid()));
$$;
create or replace function public.club_set_team_access(uid uuid, teams uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  update public.club_members set team_access = coalesce(teams, '{}') where user_id = uid;
end $$;
revoke all on function public.club_set_team_access(uuid, uuid[]) from anon, public;
grant execute on function public.club_set_team_access(uuid, uuid[]) to authenticated;
create or replace function public.club_admin_info() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  return json_build_object(
    'code', (select value from public.club_settings where key = 'invite_code'),
    'members', coalesce((select json_agg(json_build_object('user_id', m.user_id, 'email', m.email, 'role', m.role, 'created_at', m.created_at,
        'name', nullif(trim(u.raw_user_meta_data->>'full_name'), ''), 'all_teams', m.all_teams, 'functie', m.functie, 'team_access', m.team_access,
        'teams', (select string_agg(t.name, ', ' order by t.name) from public.team_trainers tt join public.teams t on t.id = tt.team_id where tt.user_id = m.user_id))
        order by m.role, coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), m.email)) from public.club_members m left join auth.users u on u.id = m.user_id), '[]'::json),
    'waiting', coalesce((select json_agg(json_build_object('user_id', u.id, 'email', u.email, 'created_at', u.created_at, 'name', nullif(trim(u.raw_user_meta_data->>'full_name'), '')) order by u.created_at desc)
        from auth.users u where not exists (select 1 from public.club_members m where m.user_id = u.id)), '[]'::json));
end $$;

-- berichten: van de club (team_id leeg, enkel beheerders) of van een ploeg (trainers van die ploeg)
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid references public.teams(id) on delete cascade,
  title      text not null,
  body       text,
  author     text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  until      date
);
alter table public.messages enable row level security;
drop policy if exists "berichten lezen" on public.messages;
drop policy if exists "berichten schrijven" on public.messages;
create policy "berichten lezen" on public.messages for select to authenticated
  using (public.is_member() and (team_id is null or public.is_trainer(team_id) or public.is_admin()));
create policy "berichten schrijven" on public.messages for all to authenticated
  using ((team_id is null and public.is_admin()) or (team_id is not null and (public.is_trainer(team_id) or public.is_admin())))
  with check ((team_id is null and public.is_admin()) or (team_id is not null and (public.is_trainer(team_id) or public.is_admin())));
grant select, insert, update, delete on public.messages to authenticated;
create index if not exists messages_team on public.messages(team_id, created_at desc);

-- wat ouders zien: nu ook de convocatie (verzamelen, meebrengen, of hun kind geselecteerd is), afgelastingen en berichten
create or replace function public.parent_view(tok uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare p public.players%rowtype;
begin
  select * into p from public.players where parent_token = tok and active is not false;
  if not found then return null; end if;
  return json_build_object('player', p.first_name, 'team', (select name from public.teams where id = p.team_id),
    'events', coalesce((select json_agg(json_build_object('id', e.id, 'type', e.type, 'date', e.date,
        'start', to_char(e.start_time, 'HH24:MI'), 'end', to_char(e.end_time, 'HH24:MI'), 'location', e.location,
        'opponent', e.opponent, 'home', e.home, 'state', case when e.cancelled then 'afgelast' else e.rbfa_state end,
        'convo', case when e.convo ? 'sent' then json_build_object('selected', (e.convo->'players') ? p.id::text,
            'meet', e.convo->>'meet', 'place', e.convo->>'place', 'bring', e.convo->>'bring', 'note', e.convo->>'note') end,
        'rsvp', r.status, 'note', r.note) order by e.date, e.start_time)
      from public.events e left join public.rsvp r on r.event_id = e.id and r.player_id = p.id
      where e.team_id = p.team_id and e.date between current_date and current_date + 42), '[]'::json),
    'messages', coalesce((select json_agg(json_build_object('title', m.title, 'body', m.body, 'author', m.author, 'date', m.created_at::date, 'club', m.team_id is null) order by m.created_at desc)
      from (select * from public.messages m where (m.team_id is null or m.team_id = p.team_id)
              and coalesce(m.until, (m.created_at + interval '30 days')::date) >= current_date order by m.created_at desc limit 8) m), '[]'::json));
end $$;
grant execute on function public.parent_view(uuid) to anon, authenticated;

-- clubdashboard: cijfers per ploeg zonder namen van kinderen; voor beheerders en wie toegang heeft tot meerdere ploegen
create or replace function public.club_dashboard(since date) returns json
language plpgsql stable security definer set search_path = public as $$
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
    where me.role = 'admin' or me.all_teams or t.id = any(me.team_access)) s), '[]'::json);
end $$;
revoke all on function public.club_dashboard(date) from anon, public;
grant execute on function public.club_dashboard(date) to authenticated;

-- terreinoverzicht: trainingen en thuiswedstrijden van alle ploegen (geen namen van kinderen), voor alle clubleden
create or replace function public.club_fields(d1 date, d2 date) returns json
language sql stable security definer set search_path = public as $$
  select case when not public.is_member() then '[]'::json else coalesce((select json_agg(json_build_object('id', e.id, 'team_id', e.team_id, 'team', t.name, 'type', e.type,
      'date', e.date, 'start', to_char(e.start_time, 'HH24:MI'), 'end', to_char(e.end_time, 'HH24:MI'), 'location', e.location, 'opponent', e.opponent,
      'cancelled', e.cancelled or coalesce(e.rbfa_state, '') = 'afgelast') order by e.date, e.start_time)
    from public.events e join public.teams t on t.id = e.team_id
    where e.date between d1 and least(d2, d1 + 400) and (e.type = 'training' or e.home is not false)), '[]'::json) end;
$$;
revoke all on function public.club_fields(date, date) from anon, public;
grant execute on function public.club_fields(date, date) to authenticated;

-- back-up: de beheerder downloadt alle gegevens van de club als één bestand
create or replace function public.club_backup() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  return json_build_object('made', now(), 'version', 14,
    'teams', (select coalesce(json_agg(t), '[]') from public.teams t),
    'team_trainers', (select coalesce(json_agg(t), '[]') from public.team_trainers t),
    'players', (select coalesce(json_agg(t), '[]') from public.players t),
    'events', (select coalesce(json_agg(t), '[]') from public.events t),
    'attendance', (select coalesce(json_agg(t), '[]') from public.attendance t),
    'evaluations', (select coalesce(json_agg(t), '[]') from public.evaluations t),
    'goals', (select coalesce(json_agg(t), '[]') from public.goals t),
    'rsvp', (select coalesce(json_agg(t), '[]') from public.rsvp t),
    'scouting', (select coalesce(json_agg(t), '[]') from public.scouting t),
    'trainer_items', (select coalesce(json_agg(t), '[]') from public.trainer_items t),
    'club_docs', (select coalesce(json_agg(t), '[]') from public.club_docs t),
    'club_members', (select coalesce(json_agg(t), '[]') from public.club_members t),
    'club_contacts', (select coalesce(json_agg(t), '[]') from public.club_contacts t),
    'messages', (select coalesce(json_agg(t), '[]') from public.messages t),
    'feedback', (select coalesce(json_agg(t), '[]') from public.feedback t));
end $$;
revoke all on function public.club_backup() from anon, public;
grant execute on function public.club_backup() to authenticated;

-- beheerders mogen spelers importeren in elke ploeg (bv. de ledenlijst uit PSD)
drop policy if exists "beheer spelers lezen" on public.players;
drop policy if exists "beheer spelers toevoegen" on public.players;
drop policy if exists "beheer spelers wijzigen" on public.players;
create policy "beheer spelers lezen"     on public.players for select to authenticated using (public.is_admin());
create policy "beheer spelers toevoegen" on public.players for insert to authenticated with check (public.is_admin());
create policy "beheer spelers wijzigen"  on public.players for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- wakker houden: een kleine, openbare oproep die een geplande taak (GitHub Actions) elke dag doet,
-- zodat het gratis Supabase-project niet gepauzeerd wordt na een week zonder gebruik. Geeft geen gegevens terug.
create or replace function public.ping() returns text language sql stable as $$ select 'ok'::text $$;
grant execute on function public.ping() to anon, authenticated;

-- =====================================================================
-- Versie 15: de ouderapp (OGV Ouders). Ouders vullen zelf hun contactgegevens, medische aandachtspunten
-- en toestemming voor beeldmateriaal in via hun persoonlijke link. Geen accounts of wachtwoorden nodig.
-- =====================================================================
alter table public.players add column if not exists consent        jsonb;        -- {analysis:bool, public:bool, date, name}
alter table public.players add column if not exists parent_updated timestamptz;

create or replace function public.parent_view(tok uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare p public.players%rowtype;
begin
  select * into p from public.players where parent_token = tok and active is not false;
  if not found then return null; end if;
  return json_build_object('player', p.first_name, 'team', (select name from public.teams where id = p.team_id),
    'contacts', coalesce(p.contacts, '[]'::jsonb), 'medical', p.medical, 'consent', p.consent, 'updated', p.parent_updated,
    'events', coalesce((select json_agg(json_build_object('id', e.id, 'type', e.type, 'date', e.date,
        'start', to_char(e.start_time, 'HH24:MI'), 'end', to_char(e.end_time, 'HH24:MI'), 'location', e.location,
        'opponent', e.opponent, 'home', e.home, 'state', case when e.cancelled then 'afgelast' else e.rbfa_state end,
        'convo', case when e.convo ? 'sent' then json_build_object('selected', (e.convo->'players') ? p.id::text,
            'meet', e.convo->>'meet', 'place', e.convo->>'place', 'bring', e.convo->>'bring', 'note', e.convo->>'note') end,
        'rsvp', r.status, 'note', r.note) order by e.date, e.start_time)
      from public.events e left join public.rsvp r on r.event_id = e.id and r.player_id = p.id
      where e.team_id = p.team_id and e.date between current_date and current_date + 42), '[]'::json),
    'messages', coalesce((select json_agg(json_build_object('title', m.title, 'body', m.body, 'author', m.author, 'date', m.created_at::date, 'club', m.team_id is null) order by m.created_at desc)
      from (select * from public.messages m where (m.team_id is null or m.team_id = p.team_id)
              and coalesce(m.until, (m.created_at + interval '30 days')::date) >= current_date order by m.created_at desc limit 8) m), '[]'::json));
end $$;
grant execute on function public.parent_view(uuid) to anon, authenticated;

create or replace function public.parent_update(tok uuid, c jsonb, med text, cons jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare p public.players%rowtype; clean jsonb;
begin
  select * into p from public.players where parent_token = tok and active is not false;
  if not found then return false; end if;
  if c is not null and jsonb_typeof(c) <> 'array' then return false; end if;
  select coalesce(jsonb_agg(jsonb_build_object('name', left(coalesce(x->>'name', ''), 80), 'rel', left(coalesce(x->>'rel', ''), 30),
           'phone', left(coalesce(x->>'phone', ''), 30), 'email', left(coalesce(x->>'email', ''), 120))), '[]'::jsonb)
    into clean from (select x from jsonb_array_elements(coalesce(c, '[]'::jsonb)) x limit 3) q
    where coalesce(x->>'name', '') <> '' or coalesce(x->>'phone', '') <> '' or coalesce(x->>'email', '') <> '';
  update public.players set contacts = clean,
    medical = nullif(left(trim(coalesce(med, '')), 1000), ''),
    consent = case when cons is null then consent else jsonb_build_object('analysis', coalesce((cons->>'analysis')::boolean, false),
      'public', coalesce((cons->>'public')::boolean, false), 'name', left(coalesce(cons->>'name', ''), 80), 'date', now()) end,
    parent_contact = nullif((select string_agg(trim(concat_ws(' ', y->>'name', y->>'phone')), ' · ') from jsonb_array_elements(clean) y), ''),
    parent_updated = now()
  where id = p.id;
  return true;
end $$;
revoke all on function public.parent_update(uuid, jsonb, text, jsonb) from public;
grant execute on function public.parent_update(uuid, jsonb, text, jsonb) to anon, authenticated;

-- =====================================================================
-- Versie 16: plattegrond en terreinen. Beheerders delen thuiswedstrijden in op een terrein en halen de
-- wedstrijden van alle ploegen op bij RBFA; daarvoor mogen ze de kalender en de RBFA-koppeling van elke ploeg bijwerken.
-- =====================================================================
drop policy if exists "beheer trainingen inplannen" on public.events;
drop policy if exists "beheer kalender" on public.events;
create policy "beheer kalender" on public.events for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "beheer ploeg wijzigen" on public.teams;
create policy "beheer ploeg wijzigen" on public.teams for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- Versie 17: OGV Ouders, uitgebreid. Ouders zien ook de laatste uitslagen en het seizoen van hun kind
-- (aanwezigheid, wedstrijden, doelpunten) en kunnen een vraag of bericht naar de trainer sturen.
-- =====================================================================
create table if not exists public.parent_messages (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  team_id    uuid not null references public.teams(id) on delete cascade,
  body       text not null,
  sender     text,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
alter table public.parent_messages enable row level security;
drop policy if exists "ouderberichten" on public.parent_messages;
create policy "ouderberichten" on public.parent_messages for all to authenticated using (public.is_trainer(team_id)) with check (public.is_trainer(team_id));
grant select, insert, update, delete on public.parent_messages to authenticated;
create index if not exists parent_messages_team on public.parent_messages(team_id, created_at desc);

create or replace function public.parent_ask(tok uuid, body text, who text) returns boolean
language plpgsql security definer set search_path = public as $$
declare p public.players%rowtype;
begin
  select * into p from public.players where parent_token = tok and active is not false;
  if not found or coalesce(trim(body), '') = '' then return false; end if;
  if (select count(*) from public.parent_messages where player_id = p.id and created_at > now() - interval '1 day') >= 10 then return false; end if;
  insert into public.parent_messages(player_id, team_id, body, sender) values (p.id, p.team_id, left(trim(body), 1000), nullif(left(trim(coalesce(who, '')), 80), ''));
  return true;
end $$;
revoke all on function public.parent_ask(uuid, text, text) from public;
grant execute on function public.parent_ask(uuid, text, text) to anon, authenticated;

create or replace function public.parent_view(tok uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare p public.players%rowtype; ss date;
begin
  select * into p from public.players where parent_token = tok and active is not false;
  if not found then return null; end if;
  ss := make_date(case when extract(month from current_date) >= 7 then extract(year from current_date)::int else extract(year from current_date)::int - 1 end, 7, 1);
  return json_build_object('v', 17, 'player', p.first_name, 'number', p.number, 'team', (select name from public.teams where id = p.team_id),
    'trainers', coalesce((select json_agg(nullif(trim(u.raw_user_meta_data->>'full_name'), '')) from public.team_trainers tt join auth.users u on u.id = tt.user_id
        where tt.team_id = p.team_id and nullif(trim(u.raw_user_meta_data->>'full_name'), '') is not null), '[]'::json),
    'contacts', coalesce(p.contacts, '[]'::jsonb), 'medical', p.medical, 'consent', p.consent, 'updated', p.parent_updated,
    'events', coalesce((select json_agg(json_build_object('id', e.id, 'type', e.type, 'date', e.date,
        'start', to_char(e.start_time, 'HH24:MI'), 'end', to_char(e.end_time, 'HH24:MI'), 'location', e.location,
        'opponent', e.opponent, 'home', e.home, 'state', case when e.cancelled then 'afgelast' else e.rbfa_state end,
        'convo', case when e.convo ? 'sent' then json_build_object('selected', (e.convo->'players') ? p.id::text,
            'meet', e.convo->>'meet', 'place', e.convo->>'place', 'bring', e.convo->>'bring', 'note', e.convo->>'note') end,
        'rsvp', r.status, 'note', r.note) order by e.date, e.start_time)
      from public.events e left join public.rsvp r on r.event_id = e.id and r.player_id = p.id
      where e.team_id = p.team_id and e.date between current_date and current_date + 42), '[]'::json),
    'results', coalesce((select json_agg(json_build_object('date', e.date, 'opponent', e.opponent, 'home', e.home, 'for', e.score_for, 'against', e.score_against,
        'played', a.status in ('aanwezig', 'te laat'), 'goals', a.goals, 'assists', a.assists) order by e.date desc)
      from (select * from public.events e where e.team_id = p.team_id and e.type = 'wedstrijd' and e.date < current_date and e.date >= current_date - 35 and e.score_for is not null order by e.date desc limit 6) e
      left join public.attendance a on a.event_id = e.id and a.player_id = p.id), '[]'::json),
    'season', json_build_object(
      'trainings', (select count(*) from public.events e where e.team_id = p.team_id and e.type = 'training' and not e.cancelled and e.date between ss and current_date and exists (select 1 from public.attendance x where x.event_id = e.id)),
      'present', (select count(*) from public.attendance a join public.events e on e.id = a.event_id where a.player_id = p.id and e.type = 'training' and e.date between ss and current_date and a.status in ('aanwezig', 'te laat')),
      'matches', (select count(*) from public.attendance a join public.events e on e.id = a.event_id where a.player_id = p.id and e.type = 'wedstrijd' and e.date between ss and current_date and a.status in ('aanwezig', 'te laat')),
      'goals', (select coalesce(sum(a.goals), 0) from public.attendance a join public.events e on e.id = a.event_id where a.player_id = p.id and e.date >= ss),
      'assists', (select coalesce(sum(a.assists), 0) from public.attendance a join public.events e on e.id = a.event_id where a.player_id = p.id and e.date >= ss)),
    'messages', coalesce((select json_agg(json_build_object('title', m.title, 'body', m.body, 'author', m.author, 'date', m.created_at::date, 'club', m.team_id is null) order by m.created_at desc)
      from (select * from public.messages m where (m.team_id is null or m.team_id = p.team_id)
              and coalesce(m.until, (m.created_at + interval '30 days')::date) >= current_date order by m.created_at desc limit 8) m), '[]'::json),
    'asked', coalesce((select json_agg(json_build_object('body', q.body, 'date', q.created_at, 'read', q.read_at is not null) order by q.created_at desc)
      from (select * from public.parent_messages q where q.player_id = p.id order by q.created_at desc limit 5) q), '[]'::json));
end $$;
grant execute on function public.parent_view(uuid) to anon, authenticated;


-- =====================================================================
-- Versie 18: OGV Ouders ook voor spelers met een eigen gsm. Elke speler krijgt naast de ouderlink een eigen spelerslink:
-- agenda, convocaties, seizoen en nieuws, en zelf doorgeven of hij komt. Geen contactgegevens, medische info,
-- toestemmingen of berichten naar de trainer (dat blijft bij de ouders).
-- =====================================================================
alter table public.players add column if not exists player_token uuid not null default gen_random_uuid();
create unique index if not exists players_player_token on public.players(player_token);
alter table public.rsvp add column if not exists via text;
alter table public.events add column if not exists field_part text;
alter table public.events add column if not exists kk_home text;
create or replace function public.parent_view(tok uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare p public.players%rowtype; ss date; kid boolean;
begin
  select * into p from public.players where (parent_token = tok or player_token = tok) and active is not false;
  if not found then return null; end if;
  kid := p.player_token = tok; /* spelerslink: geen contactgegevens, medische info of berichten */
  ss := make_date(case when extract(month from current_date) >= 7 then extract(year from current_date)::int else extract(year from current_date)::int - 1 end, 7, 1);
  return json_build_object('v', 18, 'role', case when kid then 'speler' else 'ouder' end, 'player', p.first_name, 'number', p.number, 'team', (select name from public.teams where id = p.team_id),
    'trainers', coalesce((select json_agg(nullif(trim(u.raw_user_meta_data->>'full_name'), '')) from public.team_trainers tt join auth.users u on u.id = tt.user_id
        where tt.team_id = p.team_id and nullif(trim(u.raw_user_meta_data->>'full_name'), '') is not null), '[]'::json),
    'contacts', case when kid then '[]'::jsonb else coalesce(p.contacts, '[]'::jsonb) end, 'medical', case when kid then null else p.medical end, 'consent', case when kid then null else p.consent end, 'updated', case when kid then null else p.parent_updated end,
    'events', coalesce((select json_agg(json_build_object('id', e.id, 'type', e.type, 'date', e.date,
        'start', to_char(e.start_time, 'HH24:MI'), 'end', to_char(e.end_time, 'HH24:MI'), 'location', e.location, 'part', e.field_part, 'kk', e.kk_home,
        'opponent', e.opponent, 'home', e.home, 'state', case when e.cancelled then 'afgelast' else e.rbfa_state end,
        'convo', case when e.convo ? 'sent' then json_build_object('selected', (e.convo->'players') ? p.id::text,
            'meet', e.convo->>'meet', 'place', e.convo->>'place', 'bring', e.convo->>'bring', 'note', e.convo->>'note') end,
        'rsvp', r.status, 'note', r.note) order by e.date, e.start_time)
      from public.events e left join public.rsvp r on r.event_id = e.id and r.player_id = p.id
      where e.team_id = p.team_id and e.date between current_date and current_date + 42), '[]'::json),
    'results', coalesce((select json_agg(json_build_object('date', e.date, 'opponent', e.opponent, 'home', e.home, 'for', e.score_for, 'against', e.score_against,
        'played', a.status in ('aanwezig', 'te laat'), 'goals', a.goals, 'assists', a.assists) order by e.date desc)
      from (select * from public.events e where e.team_id = p.team_id and e.type = 'wedstrijd' and e.date < current_date and e.date >= current_date - 35 and e.score_for is not null order by e.date desc limit 6) e
      left join public.attendance a on a.event_id = e.id and a.player_id = p.id), '[]'::json),
    'season', json_build_object(
      'trainings', (select count(*) from public.events e where e.team_id = p.team_id and e.type = 'training' and not e.cancelled and e.date between ss and current_date and exists (select 1 from public.attendance x where x.event_id = e.id)),
      'present', (select count(*) from public.attendance a join public.events e on e.id = a.event_id where a.player_id = p.id and e.type = 'training' and e.date between ss and current_date and a.status in ('aanwezig', 'te laat')),
      'matches', (select count(*) from public.attendance a join public.events e on e.id = a.event_id where a.player_id = p.id and e.type = 'wedstrijd' and e.date between ss and current_date and a.status in ('aanwezig', 'te laat')),
      'goals', (select coalesce(sum(a.goals), 0) from public.attendance a join public.events e on e.id = a.event_id where a.player_id = p.id and e.date >= ss),
      'assists', (select coalesce(sum(a.assists), 0) from public.attendance a join public.events e on e.id = a.event_id where a.player_id = p.id and e.date >= ss)),
    'messages', coalesce((select json_agg(json_build_object('title', m.title, 'body', m.body, 'author', m.author, 'date', m.created_at::date, 'club', m.team_id is null) order by m.created_at desc)
      from (select * from public.messages m where (m.team_id is null or m.team_id = p.team_id)
              and coalesce(m.until, (m.created_at + interval '30 days')::date) >= current_date order by m.created_at desc limit 8) m), '[]'::json),
    'asked', case when kid then '[]'::json else coalesce((select json_agg(json_build_object('body', q.body, 'date', q.created_at, 'read', q.read_at is not null) order by q.created_at desc)
      from (select * from public.parent_messages q where q.player_id = p.id order by q.created_at desc limit 5) q), '[]'::json) end);
end $$;
grant execute on function public.parent_view(uuid) to anon, authenticated;
create or replace function public.parent_rsvp(tok uuid, ev uuid, st text, msg text) returns boolean
language plpgsql security definer set search_path = public as $$
declare p public.players%rowtype;
begin
  select * into p from public.players where (parent_token = tok or player_token = tok) and active is not false;
  if not found then return false; end if;
  if not exists (select 1 from public.events where id = ev and team_id = p.team_id and date >= current_date) then return false; end if;
  if st is null then delete from public.rsvp where event_id = ev and player_id = p.id; return true; end if;
  if st not in ('ja', 'nee') then return false; end if;
  insert into public.rsvp(event_id, player_id, team_id, status, note, updated_at)
  values (ev, p.id, p.team_id, st, nullif(left(trim(coalesce(msg, '')), 200), ''), now())
  on conflict (event_id, player_id) do update set status = excluded.status, note = excluded.note, updated_at = now();
  return true;
end $$;
grant execute on function public.parent_rsvp(uuid, uuid, text, text) to anon, authenticated;

-- =====================================================================
-- Versie 19: terreinverdeling. De beheerder geeft een ploeg een heel veld, een helft (h1/h2)
-- of een kwart (q1–q4) van een terrein, met een einduur, zodat wedstrijden kort na elkaar
-- of twee ploegen op hetzelfde veld kunnen zonder dat het als overlap telt.
-- =====================================================================
alter table public.events add column if not exists field_part text;
do $$ begin
  alter table public.events add constraint events_field_part_chk check (field_part is null or field_part in ('h1','h2','q1','q2','q3','q4'));
exception when duplicate_object then null; end $$;
create or replace function public.club_fields(d1 date, d2 date) returns json
language sql stable security definer set search_path = public as $$
  select case when not public.is_member() then '[]'::json else coalesce((select json_agg(json_build_object('id', e.id, 'team_id', e.team_id, 'team', t.name, 'type', e.type,
      'date', e.date, 'start', to_char(e.start_time, 'HH24:MI'), 'end', to_char(e.end_time, 'HH24:MI'), 'location', e.location, 'part', e.field_part, 'opponent', e.opponent,
      'format', t.format, 'cancelled', e.cancelled or coalesce(e.rbfa_state, '') = 'afgelast') order by e.date, e.start_time)
    from public.events e join public.teams t on t.id = e.team_id
    where e.date between d1 and least(d2, d1 + 400) and (e.type = 'training' or e.home is not false)), '[]'::json) end;
$$;
revoke all on function public.club_fields(date, date) from anon, public;
grant execute on function public.club_fields(date, date) to authenticated;

-- =====================================================================
-- Versie 20: kleedkamers en scheidsrechter per activiteit (voor het dagoverzicht dat op de club hangt).
-- Ouders en spelers zien de kleedkamer van hun ploeg in OGV Ouders.
-- =====================================================================
alter table public.events add column if not exists kk_home text;
alter table public.events add column if not exists kk_away text;
alter table public.events add column if not exists referee text;
create or replace function public.club_fields(d1 date, d2 date) returns json
language sql stable security definer set search_path = public as $$
  select case when not public.is_member() then '[]'::json else coalesce((select json_agg(json_build_object('id', e.id, 'team_id', e.team_id, 'team', t.name, 'type', e.type,
      'date', e.date, 'start', to_char(e.start_time, 'HH24:MI'), 'end', to_char(e.end_time, 'HH24:MI'), 'location', e.location, 'part', e.field_part, 'opponent', e.opponent,
      'kk_home', e.kk_home, 'kk_away', e.kk_away, 'referee', e.referee,
      'format', t.format, 'cancelled', e.cancelled or coalesce(e.rbfa_state, '') = 'afgelast') order by e.date, e.start_time)
    from public.events e join public.teams t on t.id = e.team_id
    where e.date between d1 and least(d2, d1 + 400) and (e.type = 'training' or e.home is not false)), '[]'::json) end;
$$;
revoke all on function public.club_fields(date, date) from anon, public;
grant execute on function public.club_fields(date, date) to authenticated;

-- =====================================================================
-- Versie 21: beheerders mogen aanwezigheden, minuten, cijfers en notities van alle ploegen invoeren
-- (nodig om de wedstrijdgegevens uit PSD voor alle ploegen over te zetten).
-- =====================================================================
drop policy if exists "beheer aanwezigheden" on public.attendance;
create policy "beheer aanwezigheden" on public.attendance for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
