-- OGV Trainers / FootballCoachHub · v39 · foto per speler.
-- De foto staat in een privé-map (geen openbare link). Alleen de trainers en beheerders van de ploeg zien en wijzigen ze.
-- De app verkleint elke foto tot 480 x 480 pixels en vraagt eerst bevestiging dat de ouders akkoord zijn. Veilig om opnieuw uit te voeren.

alter table public.players add column if not exists photo text;
alter table public.players add column if not exists photo_ok boolean;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('player-photos', 'player-photos', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

/* pad = <ploeg-id>/<bestandsnaam>; de eerste map moet een geldig ploeg-id zijn waar je trainer of beheerder van bent */
create or replace function public.foto_ploeg(pad text) returns uuid language sql immutable as $$
  select case when split_part(pad, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then split_part(pad, '/', 1)::uuid end $$;

drop policy if exists "spelersfoto lezen" on storage.objects;
drop policy if exists "spelersfoto toevoegen" on storage.objects;
drop policy if exists "spelersfoto wijzigen" on storage.objects;
drop policy if exists "spelersfoto verwijderen" on storage.objects;
create policy "spelersfoto lezen" on storage.objects for select to authenticated
  using (bucket_id = 'player-photos' and public.foto_ploeg(name) is not null and public.in_my_club(public.foto_ploeg(name)));
create policy "spelersfoto toevoegen" on storage.objects for insert to authenticated
  with check (bucket_id = 'player-photos' and public.foto_ploeg(name) is not null and (public.is_trainer(public.foto_ploeg(name)) or public.is_team_admin(public.foto_ploeg(name))));
create policy "spelersfoto wijzigen" on storage.objects for update to authenticated
  using (bucket_id = 'player-photos' and public.foto_ploeg(name) is not null and (public.is_trainer(public.foto_ploeg(name)) or public.is_team_admin(public.foto_ploeg(name))));
create policy "spelersfoto verwijderen" on storage.objects for delete to authenticated
  using (bucket_id = 'player-photos' and public.foto_ploeg(name) is not null and (public.is_trainer(public.foto_ploeg(name)) or public.is_team_admin(public.foto_ploeg(name))));
revoke all on function public.foto_ploeg(text) from public;
grant execute on function public.foto_ploeg(text) to authenticated;

/* controle: bucket is privé en de vier regels bestaan */
select (select not public from storage.buckets where id = 'player-photos') as bucket_prive,
       (select count(*) from pg_policies where schemaname = 'storage' and policyname like 'spelersfoto%') as regels;
