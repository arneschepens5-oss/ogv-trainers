-- OGV Trainers / FootballCoachHub · v32 · enkel de beheerder van het platform kan bij meerdere clubs en van club wisselen.
-- Iedereen anders hoort bij precies één club. Veilig om opnieuw uit te voeren.

/* 1. een account kan maar bij één club horen, behalve de beheerder van het platform */
create or replace function public.een_club_per_account() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if exists (select 1 from public.platform_admins where user_id = new.user_id) then return new; end if;
  if exists (select 1 from public.club_members where user_id = new.user_id and club_id <> new.club_id) then
    raise exception 'Dit account hoort al bij een andere club. Een account kan maar bij één club horen.';
  end if;
  return new;
end $$;
drop trigger if exists een_club_per_account on public.club_members;
create trigger een_club_per_account before insert or update of club_id, user_id on public.club_members
  for each row execute function public.een_club_per_account();

/* 2. van club wisselen: enkel de beheerder van het platform */
create or replace function public.switch_club(c uuid) returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or not public.is_platform_admin() or not exists (select 1 from public.clubs where id = c) then return false; end if;
  if not exists (select 1 from public.club_members where user_id = auth.uid() and club_id = c) then
    insert into public.club_members(user_id, email, role, club_id) values (auth.uid(), (select email from auth.users where id = auth.uid()), 'admin', c);
  end if;
  update public.club_members set active_at = now() where user_id = auth.uid() and club_id = c;
  return true;
end $$;

/* 3. de lijst met clubs krijgt enkel de beheerder van het platform te zien */
do $$
declare d text;
begin
  select pg_get_functiondef('public.club_status()'::regprocedure) into d;
  if position('from public.clubs c where public.is_platform_admin() or exists' in d) > 0 then
    d := replace(d, 'from public.clubs c where public.is_platform_admin() or exists (select 1 from public.club_members m where m.user_id = auth.uid() and m.club_id = c.id)',
                    'from public.clubs c where public.is_platform_admin()');
    execute d;
  end if;
end $$;

/* controle: dit moet 0 rijen geven (niemand anders dan de beheerder van het platform bij meerdere clubs) */
select m.user_id, count(*) as clubs from public.club_members m
where not exists (select 1 from public.platform_admins p where p.user_id = m.user_id)
group by m.user_id having count(*) > 1;
