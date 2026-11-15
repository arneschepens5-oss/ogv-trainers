-- FootballCoachHub · v55 · interne scouting als tweede fiche naast de evaluatie
-- 1. Interne scouting (zoeken, spelersprofiel) leest ook de scores van de interne fiche (details.isc). Nog steeds zonder open antwoorden.
-- 2. Wat eerder uit de Excel van de interne scouting geïmporteerd werd, verhuist van de gewone evaluatie naar de interne scouting van die evaluatie.
-- 3. De tijdelijke "Evaluatie per leeftijd" met de naam "Interne scouting" verdwijnt; die ploegen evalueren weer met de standaard van de club.
-- Voer eerst v53 en v54 uit. Veilig om meerdere keren uit te voeren.

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
                'details', jsonb_build_object('open', jsonb_strip_nulls(jsonb_build_object('potentieel', e->'details'->'open'->'potentieel', 'advies', e->'details'->'open'->'advies')),
                  'isc', jsonb_strip_nulls(jsonb_build_object('scores', e->'details'->'isc'->'scores', 'open', jsonb_strip_nulls(jsonb_build_object('potentieel', e->'details'->'isc'->'open'->'potentieel', 'advies', e->'details'->'isc'->'open'->'advies')))))))
              from jsonb_array_elements(case when jsonb_typeof(h->'evals') = 'array' then h->'evals' else '[]'::jsonb end) e), '[]'::jsonb)))
          from jsonb_array_elements(case when jsonb_typeof(p.history) = 'array' then p.history else '[]'::jsonb end) h), '[]'::jsonb)))
      from public.players p join public.teams t on t.id = p.team_id where t.club_id = me.club_id and p.active), '[]'::json),
    'evals', coalesce((select json_agg(json_build_object('player_id', e.player_id, 'team_id', e.team_id, 'moment', e.moment, 'date', e.date, 'scores', e.scores,
        'details', json_build_object('open', jsonb_strip_nulls(jsonb_build_object('potentieel', e.details->'open'->'potentieel', 'advies', e.details->'open'->'advies')), 'advice', e.details->'advice',
          'isc', jsonb_strip_nulls(jsonb_build_object('scores', e.details->'isc'->'scores', 'open', jsonb_strip_nulls(jsonb_build_object('potentieel', e.details->'isc'->'open'->'potentieel', 'advies', e.details->'isc'->'open'->'advies')))))))
      from public.evaluations e join public.teams t on t.id = e.team_id join public.players p on p.id = e.player_id
      where t.club_id = me.club_id and p.active and (e.scores <> '{}'::jsonb or e.details->'isc'->'scores' is not null)), '[]'::json),
    'reports', coalesce((select json_agg(json_build_object('id', s.id, 'player_id', s.player_id, 'team_id', s.team_id, 'date', s.date, 'title', s.title, 'notes', s.notes,
        'strengths', s.strengths, 'workpoints', s.workpoints, 'by_name', s.by_name))
      from public.player_scout s join public.teams t on t.id = s.team_id where t.club_id = me.club_id), '[]'::json),
    'measures', coalesce((select json_agg(json_build_object('player_id', m.player_id, 'date', m.date, 'height_cm', m.height_cm, 'weight_kg', m.weight_kg))
      from public.player_measures m join public.teams t on t.id = m.team_id where t.club_id = me.club_id), '[]'::json));
end $function$;
revoke all on function public.club_intscout() from public, anon;
grant execute on function public.club_intscout() to authenticated;

/* 2. geïmporteerde evaluaties (details.import) zonder interne scouting: scores en antwoorden verhuizen naar details.isc */
update public.evaluations e set
  details = (e.details - 'open' - 'strengths' - 'workpoints' - 'goals' - 'oud' - 'oud_txt') || jsonb_build_object('isc', jsonb_strip_nulls(jsonb_build_object(
    'scores', e.scores,
    'open', coalesce(e.details->'open', '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('algemeen_sterk', e.details->'strengths', 'algemeen_werk', e.details->'workpoints', 'doelstelling', e.details->'goals')),
    'oud', e.details->'oud', 'oud_txt', e.details->'oud_txt', 'by', e.details->'by', 'date', to_jsonb(e.date)))),
  scores = '{}'::jsonb
where e.details ? 'import' and not e.details ? 'isc';

/* 3. de tijdelijke fiche per leeftijd "Interne scouting" opruimen */
update public.teams t set criteria = '["# Techniek","Techniek (controle over de bal) | Houdt de bal dicht bij de voet, met beide voeten, ook onder druk","Passing | Zuiver en op het juiste moment passen, ook met de zwakke voet","Balaanname | Eerste aanname weg van de druk en in de looprichting","Dribbel en 1v1 | Durft en kan een tegenstander uitspelen","Afwerking | Rustig en gericht afwerken, met beide voeten","# Spelinzicht","Positiespel | Staat aanspeelbaar en maakt het veld breed en diep","Keuzes aan de bal | Kiest op het juiste moment tussen dribbel, pass en schot","Omschakeling | Reageert meteen bij balverlies en balwinst","Verdedigen | Zet druk, sluit passlijnen en wint duels","# Fysiek","Conditie | Houdt het tempo vol tot het einde","Snelheid en wendbaarheid | Snel vertrekken, draaien en stoppen","Coördinatie | Beweegt soepel en blijft in evenwicht","# Mentaal en team","Coaching | Praat op het veld en helpt medespelers","Inzet | Werkt hard en geeft nooit op","Concentratie | Blijft gefocust op training en wedstrijd","Zelfvertrouwen | Durft de bal te vragen en fouten te maken","Bijdrage aan de ploeg | Speelt voor de ploeg en steunt anderen","Leerbereidheid | Luistert en past tips meteen toe","# Algemeen","Potentieel | Hoe ver kan deze speler nog groeien?"]'::jsonb
where t.id::text in (select jsonb_array_elements_text(p->'teams') from public.clubs c, jsonb_array_elements(coalesce(c.settings->'eval'->'profiles', '[]'::jsonb)) p where p->>'name' = 'Interne scouting' and c.id = t.club_id);
update public.clubs c set settings = jsonb_set(c.settings, '{eval,profiles}', coalesce((select jsonb_agg(p) from jsonb_array_elements(c.settings->'eval'->'profiles') p where p->>'name' <> 'Interne scouting'), '[]'::jsonb))
where c.settings->'eval'->'profiles' @> '[{"name":"Interne scouting"}]'::jsonb;
