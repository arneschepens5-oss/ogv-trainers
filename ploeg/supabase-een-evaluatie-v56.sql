-- v56: één evaluatie. De aparte interne scouting (details.isc) wordt samengevoegd in de evaluatie zelf.
-- De app doet dit ook al bij het openen; dit script maakt het definitief in de database. Veilig om opnieuw uit te voeren.
-- Bestaande scores en antwoorden in de evaluatie gaan altijd voor; niets wordt overschreven.

update public.evaluations e set
  scores = coalesce(e.details->'isc'->'scores', '{}'::jsonb) || coalesce(e.scores, '{}'::jsonb),
  details = (e.details - 'isc') || jsonb_strip_nulls(jsonb_build_object(
    'open', ((coalesce(e.details->'isc'->'open', '{}'::jsonb) - 'algemeen_sterk' - 'algemeen_werk' - 'doelstelling') || coalesce(e.details->'open', '{}'::jsonb)),
    'strengths', coalesce(e.details->'strengths', e.details->'isc'->'open'->'algemeen_sterk'),
    'workpoints', coalesce(e.details->'workpoints', e.details->'isc'->'open'->'algemeen_werk'),
    'goals', coalesce(e.details->'goals', e.details->'isc'->'open'->'doelstelling'),
    'oud', coalesce(e.details->'oud', e.details->'isc'->'oud'),
    'oud_txt', coalesce(e.details->'oud_txt', e.details->'isc'->'oud_txt'),
    'by', coalesce(e.details->'by', e.details->'isc'->'by')))
where e.details ? 'isc';

-- oude namen van onderdelen ook onder de naam van de clubfiche zetten (de oude blijven bewaard)
with m(o, n) as (values ('Balaanname','Eerste gerichte aanname'), ('Dribbel en 1v1','Dribbel'), ('Keuzes aan de bal','Keuze aan de bal'),
  ('Omschakeling','Omschakeling en reactie'), ('Positiespel','Positiespel B+'), ('Verdedigen','Verdedigend gedrag'), ('Inzet','Werkkracht en inzet'),
  ('Conditie','Uithouding'), ('Snelheid en wendbaarheid','Wendbaarheid'), ('Coaching','Verbale communicatie'), ('Bijdrage aan de ploeg','Teamgeest'),
  ('Techniek (controle over de bal)','Balvastheid en balbescherming'))
update public.evaluations e set scores = (select jsonb_object_agg(m.n, e.scores->m.o) from m where e.scores ? m.o and not e.scores ? m.n) || e.scores
where exists (select 1 from m where e.scores ? m.o and not e.scores ? m.n);
