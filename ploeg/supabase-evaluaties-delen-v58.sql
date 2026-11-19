-- v58: de trainer kiest per moment wat ouders en spelers zien van de evaluatie.
-- toon: 'scores' (per onderdeel), 'groepen' (enkel het gemiddelde per groep), 'sterk' (sterktes en werkpunten), 'doelen'.
-- Leeg of niet ingevuld = alles, zoals vroeger. Veilig om opnieuw uit te voeren.
alter table public.eval_publicaties add column if not exists toon text[];

create or replace function public.set_eval_toon(t uuid, m integer, toon text[]) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_trainer(t) or public.is_team_admin(t)) then raise exception 'Alleen trainers van deze ploeg of de beheerder.'; end if;
  update public.eval_publicaties set toon = set_eval_toon.toon where team_id = t and moment = m;
  return found;
end $$;
grant execute on function public.set_eval_toon(uuid, integer, text[]) to authenticated;

create or replace function public.parent_evaluaties(tok uuid) returns json
language plpgsql security definer set search_path = public as $$
declare p public.players%rowtype; s jsonb;
begin
  select * into p from public.players where (parent_token = tok or player_token = tok) and active is not false;
  if not found then return null; end if;
  select c.settings into s from public.teams t join public.clubs c on c.id = t.club_id where t.id = p.team_id;
  /* Enkel wat de trainer voor dat moment deelde. Nooit: privénotitie, vragen van de club, niveau, advies, oudergesprek. */
  return json_build_object(
    'criteria', (select t.criteria from public.teams t where t.id = p.team_id),
    'moments', (select json_agg(m->>'naam') from jsonb_array_elements(coalesce(s->'eval'->'moments', '[]'::jsonb)) m),
    'scale', coalesce(s->'eval'->>'scale', 'woorden'),
    'evals', coalesce((select json_agg(json_build_object('moment', ev.moment, 'date', ev.date, 'toon', coalesce(pub.toon, array['scores','sterk','doelen']),
                'scores', case when pub.toon is null or pub.toon && array['scores','groepen'] then ev.scores else '{}'::jsonb end,
                'strengths', case when pub.toon is null or 'sterk' = any(pub.toon) then ev.details->>'strengths' end,
                'workpoints', case when pub.toon is null or 'sterk' = any(pub.toon) then ev.details->>'workpoints' end,
                'goals', case when pub.toon is null or 'doelen' = any(pub.toon) then ev.details->>'goals' end)
              order by ev.moment)
      from public.evaluations ev join public.eval_publicaties pub on pub.team_id = p.team_id and pub.moment = ev.moment
      where ev.player_id = p.id and ev.team_id = p.team_id), '[]'::json));
end $$;
