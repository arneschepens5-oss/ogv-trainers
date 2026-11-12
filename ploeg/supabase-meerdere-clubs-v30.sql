-- =====================================================================
-- OGV Trainers / Coachbord  ·  v30  ·  ÉÉN ACCOUNT BIJ MEERDERE CLUBS
-- Iemand kan nu lid zijn van meer dan één club (bv. trainer bij twee clubs, of de beheerder van het platform).
-- Je werkt telkens in één club tegelijk: wisselen kan in het menu. Alles blijft per club afgeschermd.
-- Voer eerst v29 uit. Veilig om opnieuw uit te voeren. Supabase > SQL Editor > New query.
-- =====================================================================
begin;

-- lidmaatschap per (persoon, club) in plaats van per persoon
alter table public.club_members add column if not exists active_at timestamptz;
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'club_members_pkey' and pg_get_constraintdef(oid) = 'PRIMARY KEY (user_id)') then
    alter table public.club_members drop constraint club_members_pkey;
    alter table public.club_members add primary key (user_id, club_id);
  end if;
end $$;

/* de club waarin je nu werkt: de laatst gekozen, anders de oudste */
create or replace function public.my_club() returns uuid language sql stable security definer set search_path to 'public' as $$
  select club_id from public.club_members where user_id = auth.uid() order by active_at desc nulls last, created_at limit 1;
$$;
/* mijn lidmaatschap in de huidige club */
create or replace function public.is_member() returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.club_members where user_id = auth.uid());
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.club_members where user_id = auth.uid() and club_id = public.my_club() and role = 'admin');
$$;
create or replace function public.heeft_recht(r text) returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.is_admin() or exists (select 1 from public.club_members where user_id = auth.uid() and club_id = public.my_club() and r = any(rechten));
$$;
/* trainer van deze ploeg, enkel binnen de club waarin je nu werkt */
create or replace function public.is_trainer(t uuid) returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.in_my_club(t) and (
    exists (select 1 from public.team_trainers where team_id = t and user_id = auth.uid())
    or exists (select 1 from public.club_members where user_id = auth.uid() and club_id = public.my_club() and (all_teams or t = any(team_access))));
$$;
create or replace function public.is_coach() returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.is_admin()
      or exists (select 1 from public.team_trainers tt where tt.user_id = auth.uid() and public.in_my_club(tt.team_id))
      or exists (select 1 from public.club_members where user_id = auth.uid() and club_id = public.my_club() and (all_teams or coalesce(array_length(team_access, 1), 0) > 0));
$$;

/* wisselen van club: als lid, of als beheerder van het platform (die wordt dan beheerder van die club) */
create or replace function public.switch_club(c uuid) returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or not exists (select 1 from public.clubs where id = c) then return false; end if;
  if not exists (select 1 from public.club_members where user_id = auth.uid() and club_id = c) then
    if not public.is_platform_admin() then return false; end if;
    insert into public.club_members(user_id, email, role, club_id) values (auth.uid(), (select email from auth.users where id = auth.uid()), 'admin', c);
  end if;
  update public.club_members set active_at = now() where user_id = auth.uid() and club_id = c;
  return true;
end $$;

create or replace function public.club_status() returns json language sql stable security definer set search_path to 'public' as $$
  select json_build_object('member', public.is_member(), 'admin', public.is_admin(), 'platform', public.is_platform_admin(),
    'all_teams', coalesce((select all_teams from public.club_members where user_id = auth.uid() and club_id = public.my_club()), false),
    'team_access', coalesce((select to_json(team_access) from public.club_members where user_id = auth.uid() and club_id = public.my_club()), '[]'::json),
    'functie', (select functie from public.club_members where user_id = auth.uid() and club_id = public.my_club()),
    'rechten', coalesce((select to_json(rechten) from public.club_members where user_id = auth.uid() and club_id = public.my_club()), '[]'::json),
    'club', (select json_build_object('id', c.id, 'name', c.name, 'short', c.short, 'slug', c.slug, 'settings', c.settings) from public.clubs c where c.id = public.my_club()),
    'clubs', coalesce((select json_agg(json_build_object('id', c.id, 'name', c.name, 'short', c.short) order by c.name)
      from public.clubs c where public.is_platform_admin() or exists (select 1 from public.club_members m where m.user_id = auth.uid() and m.club_id = c.id)), '[]'::json));
$$;

create or replace function public.club_dashboard(since date) returns json language plpgsql stable security definer set search_path to 'public' as $$
declare me public.club_members%rowtype;
begin
  select * into me from public.club_members where user_id = auth.uid() and club_id = public.my_club();
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

-- trainers en leden toevoegen: mag nu ook als die persoon al bij een andere club zit
create or replace function public.add_trainer(t uuid, mail text) returns text language plpgsql security definer set search_path to 'public' as $$
declare u uuid;
begin
  if not public.is_team_admin(t) then raise exception 'Alleen de beheerder van deze club kan trainers aan een ploeg koppelen.'; end if;
  select id into u from auth.users where lower(email) = lower(trim(mail));
  if u is null then return 'geen_account'; end if;
  insert into public.club_members(user_id, email, club_id) values (u, lower(trim(mail)), public.my_club()) on conflict do nothing;
  insert into public.team_trainers(team_id, user_id, email) values (t, u, lower(trim(mail))) on conflict do nothing;
  return 'ok';
end $$;

create or replace function public.admin_set_trainer(t uuid, uid uuid, on_team boolean) returns void language plpgsql security definer set search_path to 'public' as $$
declare mail text;
begin
  if not public.is_team_admin(t) then raise exception 'Alleen voor beheerders van de club.'; end if;
  if on_team then
    select email into mail from auth.users where id = uid;
    if mail is null then raise exception 'Dit account bestaat niet.'; end if;
    insert into public.team_trainers(team_id, user_id, email) values (t, uid, lower(mail)) on conflict do nothing;
    insert into public.club_members(user_id, email, club_id) values (uid, mail, public.my_club()) on conflict do nothing;
  else
    delete from public.team_trainers where team_id = t and user_id = uid;
  end if;
end $$;

create or replace function public.club_set_member(uid uuid, r text) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  if uid = auth.uid() and coalesce(r, '') <> 'admin' then raise exception 'Je kan jezelf niet verwijderen of je beheerrechten afnemen.'; end if;
  if r is null then
    delete from public.team_trainers where user_id = uid and public.in_my_club(team_id);
    delete from public.club_members where user_id = uid and club_id = public.my_club();
  else
    insert into public.club_members(user_id, email, role, club_id) values (uid, (select email from auth.users where id = uid), r, public.my_club())
    on conflict (user_id, club_id) do update set role = excluded.role;
  end if;
end $$;

/* lid worden met een clubcode: ook als je al bij een andere club zit; je werkt daarna meteen in die club */
create or replace function public.join_club(code text) returns boolean language plpgsql security definer set search_path to 'public' as $$
declare c uuid;
begin
  if auth.uid() is null then return false; end if;
  select club_id into c from public.club_settings where key = 'invite_code' and upper(trim(value)) = upper(trim(coalesce(code, ''))) limit 1;
  if c is null then return false; end if;
  insert into public.club_members(user_id, email, club_id) values (auth.uid(), (select email from auth.users where id = auth.uid()), c) on conflict do nothing;
  update public.club_members set active_at = now() where user_id = auth.uid() and club_id = c;
  return true;
end $$;

/* beheerder van een nieuwe club worden als je e-mailadres klopt, ook als je al bij een andere club zit */
create or replace function public.claim_club_admin() returns boolean language plpgsql security definer set search_path to 'public' as $$
declare c uuid; mail text; n int := 0;
begin
  if auth.uid() is null then return false; end if;
  select lower(email) into mail from auth.users where id = auth.uid();
  for c in select club_id from public.club_settings where key = 'pending_admin' and value = mail loop
    insert into public.club_members(user_id, email, role, club_id) values (auth.uid(), mail, 'admin', c)
    on conflict (user_id, club_id) do update set role = 'admin';
    delete from public.club_settings where club_id = c and key = 'pending_admin';
    n := n + 1;
  end loop;
  return n > 0;
end $$;

create or replace function public.create_club(nm text, sh text, admin_mail text) returns json language plpgsql security definer set search_path to 'public' as $$
declare c uuid; code text; u uuid; sl text;
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
    insert into public.club_members(user_id, email, role, club_id) values (u, lower(trim(admin_mail)), 'admin', c) on conflict do nothing;
  elsif coalesce(trim(admin_mail), '') <> '' then
    insert into public.club_settings(club_id, key, value) values (c, 'pending_admin', lower(trim(admin_mail))) on conflict do nothing;
  end if;
  return json_build_object('id', c, 'name', trim(nm), 'code', code, 'admin', u is not null);
end $$;

-- wie al een account had en als beheerder van een nieuwe club klaarstond (bv. KFC Grobbendonk): nu meteen beheerder
insert into public.club_members(user_id, email, role, club_id)
select u.id, lower(u.email), 'admin', s.club_id from public.club_settings s join auth.users u on lower(u.email) = s.value
where s.key = 'pending_admin'
on conflict (user_id, club_id) do update set role = 'admin';
delete from public.club_settings s where s.key = 'pending_admin' and exists (select 1 from auth.users u where lower(u.email) = s.value);

grant execute on function public.switch_club(uuid) to authenticated;
commit;
