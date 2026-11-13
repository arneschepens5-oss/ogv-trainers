-- OGV Trainers / FootballCoachHub · v34 · beveiliging opgeschoond + zelf je account verwijderen.
-- Veilig om opnieuw uit te voeren.

/* 1. triggerfuncties kan niemand rechtstreeks oproepen (ze lopen enkel automatisch mee) */
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.prosecdef and p.prorettype = 'trigger'::regtype loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

/* 2. functies die een ingelogde gebruiker vereisen: niet voor bezoekers zonder account
      (de ouderpagina gebruikt enkel parent_* en die blijven open; de kleine controlefuncties zoals is_member geven voor bezoekers gewoon "nee") */
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.prosecdef and p.prorettype <> 'trigger'::regtype
             and p.proname not like 'parent\_%'
             and p.proname not in ('in_my_club', 'is_member', 'is_admin', 'is_coach', 'is_trainer', 'is_team_admin', 'is_platform_admin', 'heeft_recht', 'my_club', 'shares_ratings') loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;

/* 3. zelf je account verwijderen (wettelijk verplicht recht op verwijdering, en vereist door de app-winkels) */
create or replace function public.delete_my_account() returns text language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); c record;
begin
  if me is null then raise exception 'Je bent niet ingelogd.'; end if;
  /* een club mag niet zonder beheerder vallen als er nog andere leden zijn */
  for c in select m.club_id, cl.name from public.club_members m join public.clubs cl on cl.id = m.club_id
           where m.user_id = me and m.role = 'admin' loop
    if not exists (select 1 from public.club_members x where x.club_id = c.club_id and x.role = 'admin' and x.user_id <> me)
       and exists (select 1 from public.club_members x where x.club_id = c.club_id and x.user_id <> me) then
      raise exception 'Je bent de enige beheerder van %. Duid eerst in Beheer > Toegang een andere beheerder aan.', c.name;
    end if;
  end loop;
  /* lidmaatschappen, ploegtoewijzingen, eigen oefeningen en borden verdwijnen mee (ON DELETE CASCADE);
     gegevens van de club (spelers, verslagen, evaluaties) blijven van de club */
  delete from auth.users where id = me;
  return 'verwijderd';
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

/* controle: welke functies kunnen bezoekers zonder account nog oproepen (enkel parent_* en de controlefuncties) */
select p.proname from pg_proc p
where p.pronamespace = 'public'::regnamespace and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
order by 1;
