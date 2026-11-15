-- FootballCoachHub · v52 · zelfevaluatie per leeftijd
-- De beheerder kan in Clubinstellingen › Evaluaties groepen ploegen een eigen zelfevaluatie geven.
-- Deze functie geeft ouders en spelers dan de vragen van hun eigen ploeg, anders die van de club.
-- Veilig om meerdere keren uit te voeren.
create or replace function public.parent_zelf(tok uuid) returns json
language plpgsql stable security definer set search_path to 'public' as $function$
declare p public.players%rowtype; s jsonb; self jsonb; prof jsonb;
begin
  select * into p from public.players where (parent_token = tok or player_token = tok) and active is not false;
  if not found then return null; end if;
  select c.settings into s from public.teams t join public.clubs c on c.id = t.club_id where t.id = p.team_id;
  self := s->'eval'->'self';
  select x into prof from jsonb_array_elements(coalesce(s->'eval'->'profiles', '[]'::jsonb)) x where coalesce(x->'teams', '[]'::jsonb) ? p.team_id::text limit 1;
  if prof is not null then self := coalesce(prof->'self', '{}'::jsonb); end if;
  if coalesce((self->>'on')::boolean, false) is not true then return json_build_object('on', false); end if;
  /* enkel de vragen en de namen van de momenten, niets anders uit de clubinstellingen */
  return json_build_object('on', true, 'self', self,
    'moments', (select json_agg(m->>'naam') from jsonb_array_elements(coalesce(s->'eval'->'moments', '[]'::jsonb)) m),
    'open', coalesce((select json_agg(o.moment order by o.moment) from public.eval_zelf_open o where o.team_id = p.team_id), '[]'::json),
    'mine', coalesce((select json_agg(json_build_object('moment', z.moment, 'answers', z.answers, 'by', z.by, 'updated_at', z.updated_at) order by z.moment) from public.eval_zelf z where z.player_id = p.id), '[]'::json));
end $function$;
revoke all on function public.parent_zelf(uuid) from public;
grant execute on function public.parent_zelf(uuid) to anon, authenticated;
