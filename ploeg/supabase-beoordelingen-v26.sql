-- Databaseversie 26: alle trainers zien de cijfers en notities bij wedstrijden van elke ploeg.
-- Enkel voor trainers (en coördinatoren/beheerder), niet voor leden zonder ploeg zoals een scout. Ouders zien dit nooit.

-- is de ingelogde persoon trainer van minstens één ploeg, coördinator of beheerder?
create or replace function public.is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.team_trainers where user_id = auth.uid())
      or exists (select 1 from public.club_members where user_id = auth.uid() and (all_teams or coalesce(array_length(team_access, 1), 0) > 0));
$$;
revoke execute on function public.is_coach() from public, anon;
grant execute on function public.is_coach() to authenticated, service_role;

drop policy if exists "beoordelingen club" on public.attendance;
create policy "beoordelingen club" on public.attendance for select to authenticated
  using (public.is_coach() and exists (select 1 from public.events e where e.id = attendance.event_id and e.type = 'wedstrijd'));

-- de instelling per ploeg is niet meer nodig: overal aan
update public.teams set share_ratings = true where share_ratings is distinct from true;
alter table public.teams alter column share_ratings set default true;

-- spelersnaam invullen bij de overgezette beoordelingen (anders staat er "Speler")
update public.attendance a set player_name = trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))
  from public.players p where p.id = a.player_id and coalesce(a.player_name, '') = '';
