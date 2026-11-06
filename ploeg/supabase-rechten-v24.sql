-- =====================================================================
-- Databaseversie 24: rechten per persoon (uit te voeren door de beheerder in de SQL-editor).
--  * Scoutingsdatabase: enkel nog voor de beheerder en wie het recht "scouting" krijgt.
--  * Terreinen indelen (terrein, uur, helft/kwart, kleedkamers, scheidsrechter):
--    enkel nog voor de beheerder en wie het recht "terreinen" krijgt.
--  * Iedereen met de clubcode kan lid worden zonder trainer te zijn (bv. een scout);
--    de beheerder geeft dan een functie en de rechten die nodig zijn.
-- Veilig om meerdere keren uit te voeren.
-- =====================================================================

alter table public.club_members add column if not exists rechten text[] not null default '{}';

-- heeft de ingelogde persoon dit recht? (de beheerder heeft alle rechten)
create or replace function public.heeft_recht(r text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.club_members where user_id = auth.uid() and r = any(rechten));
$$;

-- de app vraagt bij het opstarten op wat iemand mag
create or replace function public.club_status() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('member', public.is_member(), 'admin', public.is_admin(),
    'all_teams', coalesce((select all_teams from public.club_members where user_id = auth.uid()), false),
    'team_access', coalesce((select to_json(team_access) from public.club_members where user_id = auth.uid()), '[]'::json),
    'functie', (select functie from public.club_members where user_id = auth.uid()),
    'rechten', coalesce((select to_json(rechten) from public.club_members where user_id = auth.uid()), '[]'::json));
$$;

-- ledenlijst voor de beheerder, nu met rechten
create or replace function public.club_admin_info() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  return json_build_object(
    'code', (select value from public.club_settings where key = 'invite_code'),
    'members', coalesce((select json_agg(json_build_object('user_id', m.user_id, 'email', m.email, 'role', m.role, 'created_at', m.created_at,
        'name', nullif(trim(u.raw_user_meta_data->>'full_name'), ''), 'all_teams', m.all_teams, 'functie', m.functie, 'team_access', m.team_access, 'rechten', m.rechten,
        'teams', (select string_agg(t.name, ', ' order by t.name) from public.team_trainers tt join public.teams t on t.id = tt.team_id where tt.user_id = m.user_id))
        order by m.role, coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), m.email)) from public.club_members m left join auth.users u on u.id = m.user_id), '[]'::json),
    'waiting', coalesce((select json_agg(json_build_object('user_id', u.id, 'email', u.email, 'created_at', u.created_at, 'name', nullif(trim(u.raw_user_meta_data->>'full_name'), '')) order by u.created_at desc)
        from auth.users u where not exists (select 1 from public.club_members m where m.user_id = u.id)), '[]'::json));
end $$;

-- beheerder zet de rechten van een lid
create or replace function public.club_set_rechten(uid uuid, r text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  update public.club_members
     set rechten = coalesce((select array_agg(distinct x) from unnest(coalesce(r, '{}')) x where x in ('scouting', 'terreinen')), '{}')
   where user_id = uid;
end $$;

-- scouting: enkel met het recht "scouting"
drop policy if exists "scouting lezen" on public.scouting;
create policy "scouting lezen" on public.scouting for select to authenticated using (public.heeft_recht('scouting'));
drop policy if exists "scouting toevoegen" on public.scouting;
create policy "scouting toevoegen" on public.scouting for insert to authenticated with check (public.heeft_recht('scouting'));
drop policy if exists "scouting wijzigen" on public.scouting;
create policy "scouting wijzigen" on public.scouting for update to authenticated using (public.heeft_recht('scouting')) with check (public.heeft_recht('scouting'));
drop policy if exists "scouting verwijderen" on public.scouting;
create policy "scouting verwijderen" on public.scouting for delete to authenticated
  using (public.heeft_recht('scouting') and (created_by = (select auth.uid()) or created_by is null or public.is_admin()));

-- terreinen indelen: enkel de velden voor terrein, uur, kleedkamers en scheidsrechter
create or replace function public.zet_terreininfo(ev uuid, p jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.heeft_recht('terreinen') then raise exception 'Je hebt geen recht om de terreinen in te delen. Vraag het aan de beheerder.'; end if;
  update public.events set
    location   = case when p ? 'location'   then nullif(p->>'location', '')        else location end,
    start_time = case when p ? 'start_time' then nullif(p->>'start_time', '')::time else start_time end,
    end_time   = case when p ? 'end_time'   then nullif(p->>'end_time', '')::time   else end_time end,
    field_part = case when p ? 'field_part' then nullif(p->>'field_part', '')       else field_part end,
    kk_home    = case when p ? 'kk_home'    then nullif(p->>'kk_home', '')          else kk_home end,
    kk_away    = case when p ? 'kk_away'    then nullif(p->>'kk_away', '')          else kk_away end,
    referee    = case when p ? 'referee'    then nullif(p->>'referee', '')          else referee end
  where id = ev;
  return found;
end $$;

-- nieuwe functies niet oproepbaar zonder in te loggen
revoke execute on function public.heeft_recht(text) from public, anon;
revoke execute on function public.club_status() from public, anon;
revoke execute on function public.club_admin_info() from public, anon;
revoke execute on function public.club_set_rechten(uuid, text[]) from public, anon;
revoke execute on function public.zet_terreininfo(uuid, jsonb) from public, anon;
grant execute on function public.heeft_recht(text), public.club_status(), public.club_admin_info(),
  public.club_set_rechten(uuid, text[]), public.zet_terreininfo(uuid, jsonb) to authenticated, service_role;
