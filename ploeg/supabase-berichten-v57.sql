-- v57: berichten naar bepaalde spelers (en hun ouders) sturen in plaats van naar de hele ploeg.
-- Leeg = zoals vroeger: de hele ploeg of de hele club. Veilig om opnieuw uit te voeren.
alter table public.messages add column if not exists to_players uuid[];

-- parent_view: ouders en spelers zien een persoonlijk bericht enkel als het voor hun kind is
do $$ declare r record; d text; begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'parent_view' and p.prosrc like '%from public.messages m where (m.team_id = p.team_id%'
             and p.prosrc not like '%m.to_players%' loop
    d := replace(pg_get_functiondef(r.oid), 'from public.messages m where (m.team_id = p.team_id',
                 'from public.messages m where (m.to_players is null or p.id = any(m.to_players)) and (m.team_id = p.team_id');
    execute d;
  end loop;
end $$;
