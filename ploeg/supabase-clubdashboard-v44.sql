-- v44: uitgebreid clubdashboard (voer eerst v40, v42 en v43 uit). Veilig om opnieuw uit te voeren.
-- Per ploeg alleen aantallen, nooit namen van kinderen. Enkel voor beheerders en coördinatoren.
alter table public.trainer_profiles add column if not exists dipl jsonb not null default '{}'::jsonb;
create or replace function public.club_dashboard2(since date) returns json language plpgsql stable security definer set search_path to 'public' as $$
declare me public.club_members%rowtype;
begin
  select * into me from public.club_members where user_id = auth.uid() and club_id = public.my_club();
  if not found or not (me.role = 'admin' or me.all_teams or cardinality(me.team_access) > 0) then raise exception 'Alleen voor beheerders en coördinatoren.'; end if;
  return coalesce((select json_agg(x) from (
    select json_build_object('id', t.id, 'name', t.name, 'category', t.category, 'format', t.format,
      'trainers', (select count(*) from public.team_trainers tt where tt.team_id = t.id),
      'trainers_dipl', (select count(*) from public.team_trainers tt join public.trainer_profiles tp on tp.user_id = tt.user_id where tt.team_id = t.id and (coalesce(trim(tp.diplomas), '') <> '' or tp.dipl <> '{}'::jsonb)),
      'players', (select count(*) from public.players p where p.team_id = t.id and p.active),
      'nobirth', (select count(*) from public.players p where p.team_id = t.id and p.active and p.birthdate is null),
      'q1', (select count(*) from public.players p where p.team_id = t.id and p.active and extract(month from p.birthdate) between 1 and 3),
      'q2', (select count(*) from public.players p where p.team_id = t.id and p.active and extract(month from p.birthdate) between 4 and 6),
      'q3', (select count(*) from public.players p where p.team_id = t.id and p.active and extract(month from p.birthdate) between 7 and 9),
      'q4', (select count(*) from public.players p where p.team_id = t.id and p.active and extract(month from p.birthdate) between 10 and 12),
      'vroeg', (select count(*) from public.players p where p.team_id = t.id and p.active and p.maturity = 'vroeg'),
      'normaal', (select count(*) from public.players p where p.team_id = t.id and p.active and p.maturity = 'normaal'),
      'laat', (select count(*) from public.players p where p.team_id = t.id and p.active and p.maturity = 'laat'),
      'links', (select count(*) from public.players p where p.team_id = t.id and p.active and p.foot = 'Links'),
      'rechts', (select count(*) from public.players p where p.team_id = t.id and p.active and p.foot = 'Rechts'),
      'beide', (select count(*) from public.players p where p.team_id = t.id and p.active and p.foot = 'Beide'),
      'scouted', (select count(*) from public.players p where p.team_id = t.id and p.active and p.scout is not null and p.scout::text not in ('null', '{}')),
      'measured', (select count(distinct m.player_id) from public.player_measures m join public.players p on p.id = m.player_id where p.team_id = t.id and p.active),
      'trainings', (select count(*) from public.events e where e.team_id = t.id and e.type = 'training' and not e.cancelled and e.date between since and current_date),
      'trainings_cancel', (select count(*) from public.events e where e.team_id = t.id and e.type = 'training' and e.cancelled and e.date between since and current_date),
      'trainings_att', (select count(*) from public.events e where e.team_id = t.id and e.type = 'training' and not e.cancelled and e.date between since and current_date and exists (select 1 from public.attendance a where a.event_id = e.id)),
      'trainings_plan', (select count(*) from public.events e where e.team_id = t.id and e.type = 'training' and not e.cancelled and e.date between since and current_date and e.plan is not null and e.plan::text not in ('null', '{}', '[]')),
      'att_pct', (select round(100.0 * count(*) filter (where a.status in ('aanwezig', 'te laat')) / nullif(count(*), 0)) from public.attendance a join public.events e on e.id = a.event_id where e.team_id = t.id and e.type = 'training' and e.date between since and current_date),
      'late_pct', (select round(100.0 * count(*) filter (where a.status = 'te laat') / nullif(count(*) filter (where a.status in ('aanwezig', 'te laat')), 0)) from public.attendance a join public.events e on e.id = a.event_id where e.team_id = t.id and e.type = 'training' and e.date between since and current_date),
      'matches', (select count(*) from public.events e where e.team_id = t.id and e.type = 'wedstrijd' and not coalesce(e.cancelled, false) and e.date between since and current_date),
      'matches_report', (select count(*) from public.events e where e.team_id = t.id and e.type = 'wedstrijd' and e.date between since and current_date and e.score_for is not null),
      'w', (select count(*) from public.events e where e.team_id = t.id and e.type = 'wedstrijd' and e.date between since and current_date and e.score_for > e.score_against),
      'd', (select count(*) from public.events e where e.team_id = t.id and e.type = 'wedstrijd' and e.date between since and current_date and e.score_for = e.score_against),
      'l', (select count(*) from public.events e where e.team_id = t.id and e.type = 'wedstrijd' and e.date between since and current_date and e.score_for < e.score_against),
      'gf', (select coalesce(sum(e.score_for), 0) from public.events e where e.team_id = t.id and e.type = 'wedstrijd' and e.date between since and current_date),
      'ga', (select coalesce(sum(e.score_against), 0) from public.events e where e.team_id = t.id and e.type = 'wedstrijd' and e.date between since and current_date),
      'evals', (select json_object_agg(m, n) from (select ev.moment m, count(*) n from public.evaluations ev join public.players pl on pl.id = ev.player_id where pl.team_id = t.id and pl.active group by ev.moment) q),
      'next', (select min(e.date) from public.events e where e.team_id = t.id and e.date >= current_date and not coalesce(e.cancelled, false))) x
    from public.teams t
    where t.club_id = me.club_id and (me.role = 'admin' or me.all_teams or t.id = any(me.team_access))) s), '[]'::json);
end $$;
revoke all on function public.club_dashboard2(date) from public, anon;
grant execute on function public.club_dashboard2(date) to authenticated;
