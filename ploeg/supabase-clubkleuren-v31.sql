-- OGV Trainers / FootballCoachHub · v31 · clubkleur ook op de ouderpagina. Veilig om opnieuw uit te voeren.
do $$
declare d text;
begin
  select pg_get_functiondef('public.parent_view(uuid)'::regprocedure) into d;
  if position($q$'logo', c.settings->>'logo')$q$ in d) > 0 and position($q$'color', c.settings->>'color'$q$ in d) = 0 then
    d := replace(d, $q$'logo', c.settings->>'logo')$q$, $q$'logo', c.settings->>'logo', 'color', c.settings->>'color')$q$);
    execute d;
  end if;
end $$;
