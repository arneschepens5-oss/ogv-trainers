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
