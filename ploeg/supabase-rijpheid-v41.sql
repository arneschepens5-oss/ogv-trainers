-- v41: biologische rijpheid per speler + clubtotalen (zonder namen)
-- Veilig om opnieuw uit te voeren.
alter table public.players add column if not exists maturity text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'players_maturity_chk') then
    alter table public.players add constraint players_maturity_chk check (maturity is null or maturity in ('vroeg','normaal','laat'));
  end if;
end $$;

-- Per ploeg: aantal actieve spelers per geboortekwartaal, jaarhelft en rijpheid. Geen namen.
create or replace function public.club_spelersprofiel() returns json language plpgsql stable security definer set search_path to 'public' as $$
declare me public.club_members%rowtype;
begin
  select * into me from public.club_members where user_id = auth.uid() and club_id = public.my_club();
  if not found or not (me.role = 'admin' or me.all_teams or cardinality(me.team_access) > 0) then raise exception 'Alleen voor beheerders en coördinatoren.'; end if;
  return coalesce((select json_agg(x order by x->>'name') from (
    select json_build_object('id', t.id, 'name', t.name, 'category', t.category,
      'players', (select count(*) from public.players p where p.team_id = t.id and p.active),
      'nobirth', (select count(*) from public.players p where p.team_id = t.id and p.active and p.birthdate is null),
      'q1', (select count(*) from public.players p where p.team_id = t.id and p.active and extract(month from p.birthdate) between 1 and 3),
      'q2', (select count(*) from public.players p where p.team_id = t.id and p.active and extract(month from p.birthdate) between 4 and 6),
      'q3', (select count(*) from public.players p where p.team_id = t.id and p.active and extract(month from p.birthdate) between 7 and 9),
      'q4', (select count(*) from public.players p where p.team_id = t.id and p.active and extract(month from p.birthdate) between 10 and 12),
      'vroeg', (select count(*) from public.players p where p.team_id = t.id and p.active and p.maturity = 'vroeg'),
      'normaal', (select count(*) from public.players p where p.team_id = t.id and p.active and p.maturity = 'normaal'),
      'laat', (select count(*) from public.players p where p.team_id = t.id and p.active and p.maturity = 'laat')) x
    from public.teams t
    where t.club_id = me.club_id and (me.role = 'admin' or me.all_teams or t.id = any(me.team_access))) s), '[]'::json);
end $$;
revoke all on function public.club_spelersprofiel() from public, anon;
grant execute on function public.club_spelersprofiel() to authenticated;
