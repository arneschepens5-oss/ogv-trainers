-- v43: interne scouting voor de hele club. Voer eerst v42 uit. Veilig om opnieuw uit te voeren.
-- Standaard ziet elke trainer van de club alle spelers in de interne scouting. De beheerder kan dat per persoon uitzetten
-- (in Beheer › Leden: vinkje "Interne scouting van de hele club"). Dat wordt bewaard als het recht 'intscout_uit'.
-- Trainers van een andere ploeg krijgen bewust GEEN contactgegevens van ouders, ouderlinks, notities of foto's: enkel naam,
-- ploeg, geboortedatum, positie, voet, rijpheid, het scoutingprofiel, scoutingrapporten en lengte/gewicht.

create or replace function public.club_set_rechten(uid uuid, r text[]) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  update public.club_members
     set rechten = coalesce((select array_agg(distinct x) from unnest(coalesce(r, '{}')) x where x in ('scouting', 'terreinen', 'intscout_uit')), '{}')
   where user_id = uid and club_id = public.my_club();
end $$;

create or replace function public.club_intscout() returns json language plpgsql stable security definer set search_path to 'public' as $$
declare me public.club_members%rowtype;
begin
  select * into me from public.club_members where user_id = auth.uid() and club_id = public.my_club();
  if not found then raise exception 'Je bent geen lid van deze club.'; end if;
  if me.role <> 'admin' and 'intscout_uit' = any(me.rechten) then raise exception 'De beheerder heeft de interne scouting van de hele club voor jou uitgezet.'; end if;
  return json_build_object(
    'teams', coalesce((select json_agg(json_build_object('id', t.id, 'name', t.name, 'category', t.category, 'format', t.format, 'season', t.season)) from public.teams t where t.club_id = me.club_id), '[]'::json),
    'players', coalesce((select json_agg(json_build_object('id', p.id, 'team_id', p.team_id, 'first_name', p.first_name, 'last_name', p.last_name, 'number', p.number,
        'birthdate', p.birthdate, 'position', p.position, 'foot', p.foot, 'active', p.active, 'maturity', p.maturity, 'scout', p.scout,
        'photo', case when public.is_trainer(p.team_id) or public.is_team_admin(p.team_id) then p.photo end))
      from public.players p join public.teams t on t.id = p.team_id where t.club_id = me.club_id and p.active), '[]'::json),
    'reports', coalesce((select json_agg(json_build_object('id', s.id, 'player_id', s.player_id, 'team_id', s.team_id, 'date', s.date, 'title', s.title, 'notes', s.notes,
        'strengths', s.strengths, 'workpoints', s.workpoints, 'by_name', s.by_name))
      from public.player_scout s join public.teams t on t.id = s.team_id where t.club_id = me.club_id), '[]'::json),
    'measures', coalesce((select json_agg(json_build_object('player_id', m.player_id, 'date', m.date, 'height_cm', m.height_cm, 'weight_kg', m.weight_kg))
      from public.player_measures m join public.teams t on t.id = m.team_id where t.club_id = me.club_id), '[]'::json));
end $$;
revoke all on function public.club_intscout() from public, anon;
grant execute on function public.club_intscout() to authenticated;
