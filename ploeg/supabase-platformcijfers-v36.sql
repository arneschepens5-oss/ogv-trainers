-- OGV Trainers / FootballCoachHub · v36 · cijfers voor de beheerder van het platform.
-- Enkel tellingen per club en per week: geen namen, geen spelersgegevens. Veilig om opnieuw uit te voeren.
create or replace function public.platform_stats() returns json language plpgsql stable security definer set search_path to 'public' as $$
declare wk date := date_trunc('week', now())::date; seas date := make_date(extract(year from now() - interval '6 months')::int, 7, 1);
begin
  if not public.is_platform_admin() then raise exception 'Alleen voor de beheerder van het platform.'; end if;
  return json_build_object(
    'generated_at', now(),
    'season_start', seas,
    /* gebruik over het hele platform */
    'users', (select count(*) from auth.users),
    'active_7', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'active_30', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'new_30', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'waiting', (select count(*) from auth.users u where not exists (select 1 from public.club_members m where m.user_id = u.id)
                  and not exists (select 1 from public.platform_admins p where p.user_id = u.id)),
    'feedback_open', (select count(*) from public.feedback where status is distinct from 'afgehandeld'),
    'db_bytes', pg_database_size(current_database()),
    /* per week, de laatste 12 weken: nieuwe accounts en geplande activiteiten */
    'weeks', (select json_agg(json_build_object('week', w,
        'accounts', (select count(*) from auth.users u where u.created_at >= w and u.created_at < w + 7),
        'events', (select count(*) from public.events e where e.created_at >= w and e.created_at < w + 7),
        'logins', (select count(*) from auth.users u where u.last_sign_in_at >= w and u.last_sign_in_at < w + 7)) order by w)
      from generate_series(wk - 77, wk, interval '7 days') g(w0), lateral (select g.w0::date as w) x),
    /* per club */
    'clubs', coalesce((select json_agg(json_build_object('id', c.id, 'name', c.name, 'short', c.short, 'settings', c.settings,
        'members', (select count(*) from public.club_members m where m.club_id = c.id),
        'active_7', (select count(*) from public.club_members m join auth.users u on u.id = m.user_id where m.club_id = c.id and u.last_sign_in_at > now() - interval '7 days'),
        'last_login', (select max(u.last_sign_in_at) from public.club_members m join auth.users u on u.id = m.user_id where m.club_id = c.id),
        'teams', (select count(*) from public.teams t where t.club_id = c.id),
        'players', (select count(*) from public.players p join public.teams t on t.id = p.team_id where t.club_id = c.id and p.active is not false),
        'trainings_30', (select count(*) from public.events e join public.teams t on t.id = e.team_id where t.club_id = c.id and e.type = 'training' and e.date between current_date - 30 and current_date),
        'matches_30', (select count(*) from public.events e join public.teams t on t.id = e.team_id where t.club_id = c.id and e.type = 'wedstrijd' and e.date between current_date - 30 and current_date),
        'reports_30', (select count(*) from public.events e join public.teams t on t.id = e.team_id where t.club_id = c.id and e.type = 'wedstrijd' and e.date between current_date - 30 and current_date and e.score_for is not null),
        'evals_season', (select count(*) from public.evaluations v join public.teams t on t.id = v.team_id where t.club_id = c.id and v.date >= seas),
        'feedback_open', (select count(*) from public.feedback f where f.club_id = c.id and f.status is distinct from 'afgehandeld'),
        'setup_done', coalesce((c.settings->>'setup_done')::boolean, false))
      order by c.created_at) from public.clubs c), '[]'::json));
end $$;
revoke all on function public.platform_stats() from public, anon;
grant execute on function public.platform_stats() to authenticated;

/* controle: geeft een fout als je niet de beheerder van het platform bent (normaal in de SQL Editor); de functie bestaat: */
select proname from pg_proc where proname = 'platform_stats';
