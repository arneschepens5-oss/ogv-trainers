-- FootballCoachHub · v54 · beheerders mogen de evaluaties van alle ploegen van hun club lezen en bewaren
-- Nodig voor de Excel-import van de interne scouting en voor het spelersprofiel van alle spelers.
-- Trainers blijven enkel aan de evaluaties van hun eigen ploegen. Veilig om opnieuw uit te voeren.
drop policy if exists "ploegdata" on public.evaluations;
create policy "ploegdata" on public.evaluations for all to authenticated
  using (public.is_trainer(team_id) or public.is_team_admin(team_id))
  with check (public.is_trainer(team_id) or public.is_team_admin(team_id));
