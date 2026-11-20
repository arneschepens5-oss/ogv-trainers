-- v59: aparte scoutapp. Scouts worden lid met een eigen scoutcode: enkel het recht "scouting", geen trainer.
create or replace function public.is_scout() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.club_members where user_id = auth.uid() and club_id = public.my_club() and role = 'scout');
$$;
revoke execute on function public.is_scout() from public, anon; grant execute on function public.is_scout() to authenticated;

-- clubdocumenten: niet voor scouts
drop policy if exists clubdocs on public.club_docs;
create policy clubdocs on public.club_docs for all using (club_id = public.my_club() and not public.is_scout()) with check (club_id = public.my_club() and not public.is_scout());

-- scoutcode opvragen of vernieuwen (enkel de beheerder)
create or replace function public.scout_code(nieuw boolean default false) returns text language plpgsql security definer set search_path = public as $$
declare c uuid := public.my_club(); v text;
begin
  if not public.is_admin() or c is null then raise exception 'Enkel de beheerder'; end if;
  select value into v from public.club_settings where club_id = c and key = 'scout_code';
  if v is null or nieuw then
    v := 'S' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 7));
    update public.club_settings set value = v where club_id = c and key = 'scout_code';
    if not found then insert into public.club_settings(club_id, key, value) values (c, 'scout_code', v); end if;
  end if;
  return v;
end $$;
revoke execute on function public.scout_code(boolean) from public, anon; grant execute on function public.scout_code(boolean) to authenticated;

-- lid worden als scout
create or replace function public.join_scout(code text) returns boolean language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  if auth.uid() is null then return false; end if;
  select club_id into c from public.club_settings where key = 'scout_code' and upper(trim(value)) = upper(trim(coalesce(code, ''))) limit 1;
  if c is null then return false; end if;
  if exists (select 1 from public.club_members where user_id = auth.uid() and club_id = c) then
    update public.club_members set rechten = (select array_agg(distinct x) from unnest(coalesce(rechten, '{}') || '{scouting}'::text[]) x), active_at = now() where user_id = auth.uid() and club_id = c;
  else
    insert into public.club_members(user_id, email, club_id, role, functie, rechten, active_at) values (auth.uid(), (select email from auth.users where id = auth.uid()), c, 'scout', 'Scout', '{scouting}', now());
  end if;
  return true;
end $$;
revoke execute on function public.join_scout(text) from public, anon; grant execute on function public.join_scout(text) to authenticated;

-- rol "scout" toelaten
alter table public.club_members drop constraint if exists club_members_role_check;
alter table public.club_members add constraint club_members_role_check check (role = any (array['trainer','admin','scout']));

-- trigger: account aangemaakt met scoutcode wordt meteen scout (ook na bevestiging op een ander toestel)
create or replace function public.join_on_signup() returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare c uuid;
begin
  select club_id into c from public.club_settings where key = 'invite_code' and upper(trim(value)) = upper(trim(coalesce(new.raw_user_meta_data->>'invite', ''))) limit 1;
  if c is not null then insert into public.club_members(user_id, email, club_id) values (new.id, new.email, c) on conflict do nothing; end if;
  c := null;
  select club_id into c from public.club_settings where key = 'scout_code' and upper(trim(value)) = upper(trim(coalesce(new.raw_user_meta_data->>'scoutcode', ''))) limit 1;
  if c is not null then insert into public.club_members(user_id, email, club_id, role, functie, rechten, active_at) values (new.id, new.email, c, 'scout', 'Scout', '{scouting}', now()) on conflict do nothing; end if;
  return new;
end $function$;
