-- OGV Trainers / FootballCoachHub · v33 · platformbeheer zonder in de clubs te zitten.
-- De beheerder van het platform beheert clubs (naam, kleuren, logo, beheerder, clubcode) maar ziet geen spelers,
-- ploegen of andere gegevens van een club waar hij zelf geen lid van is. Veilig om opnieuw uit te voeren.

/* 1. de beheerder van het platform is enkel nog lid van zijn eigen club (OG Vorselaar) */
delete from public.club_members m
where exists (select 1 from public.platform_admins p where p.user_id = m.user_id)
  and m.club_id <> '00000000-0000-4000-8000-000000000001';

/* 2. niemand hoort bij meer dan één club, ook de beheerder van het platform niet */
create or replace function public.een_club_per_account() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if exists (select 1 from public.club_members where user_id = new.user_id and club_id <> new.club_id) then
    raise exception 'Dit account hoort al bij een andere club. Een account kan maar bij één club horen.';
  end if;
  return new;
end $$;
drop trigger if exists een_club_per_account on public.club_members;
create trigger een_club_per_account before insert or update of club_id, user_id on public.club_members
  for each row execute function public.een_club_per_account();

/* 3. van club wisselen kan niet meer om binnen te kijken: enkel naar een club waar je zelf lid van bent */
create or replace function public.switch_club(c uuid) returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or not exists (select 1 from public.club_members where user_id = auth.uid() and club_id = c) then return false; end if;
  update public.club_members set active_at = now() where user_id = auth.uid() and club_id = c;
  return true;
end $$;

/* 4. overzicht van alle clubs: enkel tellingen en instellingen, geen persoonsgegevens van spelers */
create or replace function public.platform_clubs() returns json language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_platform_admin() then raise exception 'Alleen voor de beheerder van het platform.'; end if;
  return coalesce((select json_agg(json_build_object('id', c.id, 'name', c.name, 'short', c.short, 'created_at', c.created_at,
      'settings', c.settings,
      'code', (select value from public.club_settings s where s.club_id = c.id and s.key = 'invite_code'),
      'pending_admin', (select value from public.club_settings s where s.club_id = c.id and s.key = 'pending_admin'),
      'admins', coalesce((select json_agg(m.email order by m.email) from public.club_members m where m.club_id = c.id and m.role = 'admin'), '[]'::json),
      'members', (select count(*) from public.club_members m where m.club_id = c.id),
      'teams', (select count(*) from public.teams t where t.club_id = c.id),
      'players', (select count(*) from public.players p join public.teams t on t.id = p.team_id where t.club_id = c.id),
      'feedback_open', (select count(*) from public.feedback f where f.club_id = c.id and f.status is distinct from 'afgehandeld'))
    order by c.created_at) from public.clubs c), '[]'::json);
end $$;

/* 5. naam, korte naam en instellingen (kleuren, logo) van een club aanpassen */
create or replace function public.platform_update_club(c uuid, nm text, sh text, s jsonb) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_platform_admin() then raise exception 'Alleen voor de beheerder van het platform.'; end if;
  update public.clubs set name = coalesce(nullif(trim(nm), ''), name), short = coalesce(nullif(trim(sh), ''), short),
    settings = coalesce(s, settings) where id = c;
  if not found then raise exception 'Deze club bestaat niet.'; end if;
end $$;

/* 6. beheerder van een club aanduiden: met account meteen, anders zodra hij er een maakt met dit e-mailadres */
create or replace function public.platform_set_admin(c uuid, mail text) returns text language plpgsql security definer set search_path to 'public' as $$
declare u uuid; ml text := lower(trim(coalesce(mail, '')));
begin
  if not public.is_platform_admin() then raise exception 'Alleen voor de beheerder van het platform.'; end if;
  if ml !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Vul een geldig e-mailadres in.'; end if;
  if not exists (select 1 from public.clubs where id = c) then raise exception 'Deze club bestaat niet.'; end if;
  select id into u from auth.users where lower(email) = ml;
  if u is null then
    delete from public.club_settings where club_id = c and key = 'pending_admin';
    insert into public.club_settings(club_id, key, value) values (c, 'pending_admin', ml);
    return 'wacht';
  end if;
  if exists (select 1 from public.club_members where user_id = u and club_id <> c) then
    raise exception 'Dit e-mailadres hoort al bij een andere club. Gebruik een ander e-mailadres.';
  end if;
  insert into public.club_members(user_id, email, role, club_id) values (u, ml, 'admin', c)
    on conflict (user_id, club_id) do update set role = 'admin';
  delete from public.club_settings where club_id = c and key = 'pending_admin';
  return 'klaar';
end $$;

/* 7. nieuwe clubcode voor een club (bv. als de oude rondging) */
create or replace function public.platform_new_code(c uuid) returns text language plpgsql security definer set search_path to 'public' as $$
declare code text;
begin
  if not public.is_platform_admin() then raise exception 'Alleen voor de beheerder van het platform.'; end if;
  loop
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (select 1 from public.club_settings where key = 'invite_code' and value = code);
  end loop;
  delete from public.club_settings where club_id = c and key = 'invite_code';
  insert into public.club_settings(club_id, key, value) values (c, 'invite_code', code);
  return code;
end $$;

/* 8. nieuwe club: de beheerder van het platform wordt er nooit zelf lid van */
create or replace function public.create_club(nm text, sh text, admin_mail text) returns json language plpgsql security definer set search_path to 'public' as $$
declare c uuid; code text; sl text; st text;
begin
  if not public.is_platform_admin() then raise exception 'Alleen voor de beheerder van het platform.'; end if;
  if coalesce(trim(nm), '') = '' then raise exception 'Geef de club een naam.'; end if;
  sl := trim(both '-' from regexp_replace(lower(nm), '[^a-z0-9]+', '-', 'g'));
  if exists (select 1 from public.clubs x where x.slug = sl) then sl := sl || '-' || substr(md5(random()::text), 1, 4); end if;
  insert into public.clubs(name, short, slug) values (trim(nm), nullif(trim(coalesce(sh, '')), ''), sl) returning id into c;
  code := public.platform_new_code(c);
  st := public.platform_set_admin(c, admin_mail);
  return json_build_object('id', c, 'name', trim(nm), 'code', code, 'admin', st = 'klaar');
end $$;

revoke all on function public.platform_update_club(uuid, text, text, jsonb), public.platform_set_admin(uuid, text), public.platform_new_code(uuid) from public, anon;
grant execute on function public.platform_update_club(uuid, text, text, jsonb), public.platform_set_admin(uuid, text), public.platform_new_code(uuid) to authenticated;

/* controle: elke club met haar beheerders (de beheerder van het platform hoort enkel bij OG Vorselaar) */
select c.name, coalesce(string_agg(m.email, ', ') filter (where m.role = 'admin'), '(nog geen beheerder)') as beheerders
from public.clubs c left join public.club_members m on m.club_id = c.id group by c.name order by c.name;
