-- OGV Trainers / FootballCoachHub · v37 · de beheerder van het platform kan een club definitief verwijderen.
-- Alles van de club verdwijnt mee: ploegen, spelers, kalender, verslagen, evaluaties, scouting, berichten, instellingen en lidmaatschappen.
-- De accounts van de trainers blijven bestaan, maar horen daarna bij geen club meer.
-- OG Vorselaar kan zo niet verwijderd worden. Veilig om opnieuw uit te voeren.
create or replace function public.platform_delete_club(c uuid, confirm_name text) returns json language plpgsql security definer set search_path to 'public' as $$
declare nm text; n_teams int; n_players int; n_members int;
begin
  if not public.is_platform_admin() then raise exception 'Alleen voor de beheerder van het platform.'; end if;
  if c = '00000000-0000-4000-8000-000000000001' then raise exception 'OG Vorselaar kan niet verwijderd worden.'; end if;
  select name into nm from public.clubs where id = c;
  if nm is null then raise exception 'Deze club bestaat niet (meer).'; end if;
  if trim(coalesce(confirm_name, '')) <> nm then raise exception 'Typ de naam van de club exact over om te bevestigen.'; end if;
  select count(*) into n_teams from public.teams where club_id = c;
  select count(*) into n_players from public.players p join public.teams t on t.id = p.team_id where t.club_id = c;
  select count(*) into n_members from public.club_members where club_id = c;
  delete from public.clubs where id = c;   -- alles van de club volgt automatisch (ON DELETE CASCADE)
  return json_build_object('name', nm, 'teams', n_teams, 'players', n_players, 'members', n_members);
end $$;
revoke all on function public.platform_delete_club(uuid, text) from public, anon;
grant execute on function public.platform_delete_club(uuid, text) to authenticated;

select proname from pg_proc where proname = 'platform_delete_club';
