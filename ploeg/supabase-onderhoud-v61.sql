-- v61 onderhoud & beveiliging (al uitgevoerd op productie op 20-11-2026)
alter table public.push_keys add column if not exists cron_key text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
select cron.alter_job((select jobid from cron.job where jobname = 'ogv-meldingen'), command := $c$ select net.http_post(
    url := 'https://intswyovpwiigdwmgjfz.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', (select cron_key from public.push_keys where id = 1)),
    body := jsonb_build_object('kind', 'tick')) $c$);
revoke execute on function public.my_club() from public, anon;
revoke execute on function public.is_platform_admin() from public, anon;
revoke execute on function public.in_my_club(uuid) from public, anon;
revoke execute on function public.is_team_admin(uuid) from public, anon;
grant execute on function public.my_club(), public.is_platform_admin(), public.in_my_club(uuid), public.is_team_admin(uuid) to authenticated, service_role;
select cron.schedule('cron-opruimen', '17 3 * * *', $c$ delete from cron.job_run_details where end_time < now() - interval '7 days' $c$);
alter policy "eigen meldingen" on public.push_subs using (user_id = (select auth.uid()));
alter policy "eigen items" on public.trainer_items using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "feedback geven" on public.feedback with check (user_id = (select auth.uid()));
alter policy "shared_items_own" on public.shared_items using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
alter policy "trainerprofiel toevoegen" on public.trainer_profiles with check ((club_id = my_club()) and ((user_id = (select auth.uid())) or is_admin()));
alter policy "trainerprofiel verwijderen" on public.trainer_profiles using ((club_id = my_club()) and ((user_id = (select auth.uid())) or is_admin()));
alter policy "trainerprofiel wijzigen" on public.trainer_profiles using ((club_id = my_club()) and ((user_id = (select auth.uid())) or is_admin())) with check ((club_id = my_club()) and ((user_id = (select auth.uid())) or is_admin()));
create index if not exists player_absence_team on public.player_absence(team_id);
create index if not exists player_measures_team on public.player_measures(team_id);
create index if not exists player_scout_team on public.player_scout(team_id);
create index if not exists push_subs_club on public.push_subs(club_id);
create index if not exists push_subs_player on public.push_subs(player_id);
create index if not exists push_subs_user on public.push_subs(user_id);
