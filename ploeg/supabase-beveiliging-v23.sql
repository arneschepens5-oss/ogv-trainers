-- =====================================================================
-- Databaseversie 23: beveiliging opruimen (uit te voeren door de beheerder in de SQL-editor).
-- 1. Functies met beheerrechten zijn niet meer op te roepen zonder in te loggen.
--    Alleen de vijf functies van de ouder-/spelersapp blijven open (die werken met de persoonlijke link).
-- 2. Kleine vaste instelling voor ping().
-- 3. Indexen op koppelingen, zodat lijsten sneller laden als er meer gegevens bijkomen.
-- Veilig om meerdere keren uit te voeren.
-- =====================================================================

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.proname not in ('parent_view', 'parent_rsvp', 'parent_update', 'parent_ask', 'parent_evaluaties')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;

alter function public.ping() set search_path = public;

create index if not exists attendance_player_idx      on public.attendance (player_id);
create index if not exists rsvp_player_idx            on public.rsvp (player_id);
create index if not exists rsvp_team_idx              on public.rsvp (team_id);
create index if not exists goals_player_idx           on public.goals (player_id);
create index if not exists parent_messages_player_idx on public.parent_messages (player_id);
create index if not exists team_trainers_user_idx     on public.team_trainers (user_id);
create index if not exists feedback_user_idx          on public.feedback (user_id);
