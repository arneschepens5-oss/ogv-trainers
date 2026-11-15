-- FootballCoachHub · v53 · interne scouting met spelersprofiel
-- Trainers die de interne scouting van de hele club mogen zien (zie v43 en v51), krijgen nu ook de scores van de evaluaties
-- (dit seizoen en vorige seizoenen), het potentieel en het advies. Zo verschijnt het spelersprofiel (radar) en kan je zoeken op niveau.
-- NIET mee: de open antwoorden, sterktes, werkpunten, privénotities en contactgegevens. Die blijven bij de trainers van de ploeg.
-- Veilig om meerdere keren uit te voeren.

create or replace function public.club_intscout()
 returns json language plpgsql stable security definer set search_path to 'public'
as $function$
declare me public.club_members%rowtype;
begin
  select * into me from public.club_members where user_id = auth.uid() and club_id = public.my_club();
  if not found then raise exception 'Je bent geen lid van deze club.'; end if;
  if me.role <> 'admin' and not public.is_coach() then raise exception 'Interne scouting is er voor trainers van een ploeg. Vraag de beheerder om je aan een ploeg te koppelen.'; end if;
  if me.role <> 'admin' and 'intscout_uit' = any(me.rechten) then raise exception 'De beheerder heeft de interne scouting van de hele club voor jou uitgezet.'; end if;
  return json_build_object(
    'teams', coalesce((select json_agg(json_build_object('id', t.id, 'name', t.name, 'category', t.category, 'format', t.format, 'season', t.season, 'criteria', t.criteria)) from public.teams t where t.club_id = me.club_id), '[]'::json),
    'players', coalesce((select json_agg(json_build_object('id', p.id, 'team_id', p.team_id, 'first_name', p.first_name, 'last_name', p.last_name, 'number', p.number,
        'birthdate', p.birthdate, 'position', p.position, 'foot', p.foot, 'active', p.active, 'maturity', p.maturity, 'scout', p.scout,
        'photo', case when public.is_trainer(p.team_id) or public.is_team_admin(p.team_id) then p.photo end,
        /* vorige seizoenen: enkel de scores, het potentieel en het advies */
        'history', coalesce((select jsonb_agg(jsonb_build_object('season', h->'season', 'team', h->'team', 'category', h->'category',
            'evals', coalesce((select jsonb_agg(jsonb_build_object('moment', e->'moment', 'date', e->'date', 'scores', e->'scores',
                'details', jsonb_build_object('open', jsonb_strip_nulls(jsonb_build_object('potentieel', e->'details'->'open'->'potentieel', 'advies', e->'details'->'open'->'advies')))))
              from jsonb_array_elements(case when jsonb_typeof(h->'evals') = 'array' then h->'evals' else '[]'::jsonb end) e), '[]'::jsonb)))
          from jsonb_array_elements(case when jsonb_typeof(p.history) = 'array' then p.history else '[]'::jsonb end) h), '[]'::jsonb)))
      from public.players p join public.teams t on t.id = p.team_id where t.club_id = me.club_id and p.active), '[]'::json),
    'evals', coalesce((select json_agg(json_build_object('player_id', e.player_id, 'team_id', e.team_id, 'moment', e.moment, 'date', e.date, 'scores', e.scores,
        'details', json_build_object('open', jsonb_strip_nulls(jsonb_build_object('potentieel', e.details->'open'->'potentieel', 'advies', e.details->'open'->'advies')), 'advice', e.details->'advice')))
      from public.evaluations e join public.teams t on t.id = e.team_id join public.players p on p.id = e.player_id
      where t.club_id = me.club_id and p.active and e.scores <> '{}'::jsonb), '[]'::json),
    'reports', coalesce((select json_agg(json_build_object('id', s.id, 'player_id', s.player_id, 'team_id', s.team_id, 'date', s.date, 'title', s.title, 'notes', s.notes,
        'strengths', s.strengths, 'workpoints', s.workpoints, 'by_name', s.by_name))
      from public.player_scout s join public.teams t on t.id = s.team_id where t.club_id = me.club_id), '[]'::json),
    'measures', coalesce((select json_agg(json_build_object('player_id', m.player_id, 'date', m.date, 'height_cm', m.height_cm, 'weight_kg', m.weight_kg))
      from public.player_measures m join public.teams t on t.id = m.team_id where t.club_id = me.club_id), '[]'::json));
end $function$;
revoke all on function public.club_intscout() from public, anon;
grant execute on function public.club_intscout() to authenticated;
