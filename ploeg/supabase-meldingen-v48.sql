-- v48: pushmeldingen (trainers en ouders) en blessures/afwezigheden. Voer eerst v47 uit. Veilig om opnieuw uit te voeren.
-- De meldingen zelf verstuurt de functie "notify" (Supabase Edge Function); elk uur kijkt ze wat er te melden valt.

-- 1. toestellen die meldingen willen krijgen. Een trainer (user_id) of een ouder/speler (player_id via de persoonlijke link).
create table if not exists public.push_subs (
  id         uuid primary key default gen_random_uuid(),
  endpoint   text not null check (endpoint like 'https://%' and length(endpoint) < 1000),
  p256dh     text not null check (length(p256dh) < 200),
  auth       text not null check (length(auth) < 100),
  user_id    uuid references auth.users(id) on delete cascade,
  player_id  uuid references public.players(id) on delete cascade,
  club_id    uuid references public.clubs(id) on delete cascade,
  prefs      jsonb not null default '{}'::jsonb,
  fails      int not null default 0,
  created_at timestamptz not null default now(),
  check ((user_id is null) <> (player_id is null)));
create unique index if not exists push_subs_uniq on public.push_subs(endpoint, coalesce(user_id::text, ''), coalesce(player_id::text, ''));
alter table public.push_subs enable row level security;
drop policy if exists "eigen meldingen" on public.push_subs;
create policy "eigen meldingen" on public.push_subs for select to authenticated using (user_id = auth.uid());
grant select on public.push_subs to authenticated;
-- schrijven enkel via de functies hieronder (zodat niemand zich voor iemand anders kan inschrijven)

create or replace function public.push_save(sub json, pr json) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'Niet aangemeld.'; end if;
  insert into public.push_subs(endpoint, p256dh, auth, user_id, club_id, prefs)
  values (sub->>'endpoint', sub->'keys'->>'p256dh', sub->'keys'->>'auth', auth.uid(), public.my_club(), coalesce(pr::jsonb, '{}'))
  on conflict (endpoint, coalesce(user_id::text, ''), coalesce(player_id::text, '')) do update set p256dh = excluded.p256dh, auth = excluded.auth, prefs = excluded.prefs, club_id = excluded.club_id, fails = 0;
end $$;
create or replace function public.push_del(ep text) returns void language sql security definer set search_path to 'public' as $$
  delete from public.push_subs where endpoint = ep and user_id = auth.uid() $$;
create or replace function public.parent_push_save(tok uuid, sub json, pr json) returns boolean language plpgsql security definer set search_path to 'public' as $$
declare p public.players%rowtype;
begin
  select * into p from public.players where (parent_token = tok or player_token = tok) and active is not false;
  if not found then return false; end if;
  insert into public.push_subs(endpoint, p256dh, auth, player_id, club_id, prefs)
  values (sub->>'endpoint', sub->'keys'->>'p256dh', sub->'keys'->>'auth', p.id, (select club_id from public.teams where id = p.team_id), coalesce(pr::jsonb, '{}'))
  on conflict (endpoint, coalesce(user_id::text, ''), coalesce(player_id::text, '')) do update set p256dh = excluded.p256dh, auth = excluded.auth, prefs = excluded.prefs, fails = 0;
  return true;
end $$;
create or replace function public.parent_push_del(tok uuid, ep text) returns void language sql security definer set search_path to 'public' as $$
  delete from public.push_subs s using public.players p where s.endpoint = ep and s.player_id = p.id and (p.parent_token = tok or p.player_token = tok) $$;
revoke all on function public.push_save(json, json), public.push_del(text), public.parent_push_save(uuid, json, json), public.parent_push_del(uuid, text) from public;
grant execute on function public.push_save(json, json), public.push_del(text) to authenticated;
grant execute on function public.parent_push_save(uuid, json, json), public.parent_push_del(uuid, text) to anon, authenticated;

-- 2. welke meldingen al verstuurd zijn (zodat niemand twee keer hetzelfde krijgt). Enkel voor de functie.
create table if not exists public.notif_sent (key text primary key, at timestamptz not null default now());
alter table public.notif_sent enable row level security;

-- de sleutels voor de meldingen maakt de functie zelf aan en bewaart ze hier; niemand anders kan ze lezen
create table if not exists public.push_keys (id int primary key default 1 check (id = 1), public_key text not null, private_key text not null, created_at timestamptz not null default now());
alter table public.push_keys enable row level security;
revoke all on public.push_keys from anon, authenticated;

-- 3. blessures en afwezigheden over een periode
create table if not exists public.player_absence (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  kind       text not null check (kind in ('blessure', 'ziek', 'afwezig', 'andere')),
  date_from  date not null,
  date_to    date,
  note       text check (note is null or length(note) <= 300),
  by_name    text,
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  check (date_to is null or date_to >= date_from));
create index if not exists player_absence_player on public.player_absence(player_id);
alter table public.player_absence enable row level security;
drop policy if exists "afwezigheden ploeg" on public.player_absence;
create policy "afwezigheden ploeg" on public.player_absence for all to authenticated
  using (public.is_trainer(team_id) or public.is_team_admin(team_id)) with check (public.is_trainer(team_id) or public.is_team_admin(team_id));
grant select, insert, update, delete on public.player_absence to authenticated;

-- 4. elk uur de meldingen laten nakijken (afgelastingen, wie komt er morgen, vergeten aanwezigheden)
do $$ begin
  if exists (select 1 from cron.job where jobname = 'ogv-meldingen') then perform cron.unschedule('ogv-meldingen'); end if;
  perform cron.schedule('ogv-meldingen', '7 * * * *', $c$ select net.http_post(
    url := 'https://intswyovpwiigdwmgjfz.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('kind', 'tick')) $c$);
end $$;

-- (v49) toegang voor de meldingsfunctie: dit project geeft de server-rol geen automatische toegang tot tabellen
grant select on public.teams, public.team_trainers, public.players, public.events,
  public.rsvp, public.attendance, public.player_absence to service_role;
grant select, insert on public.push_keys to service_role;
grant select, update, delete on public.push_subs to service_role;
grant select, insert on public.notif_sent to service_role;
