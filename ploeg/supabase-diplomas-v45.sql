-- v45: diploma's per trainer aanvinken en het diploma (pdf of foto) uploaden. Voer eerst v40 uit. Veilig om opnieuw uit te voeren.
-- Het diploma zelf is privé: alleen de trainer zelf en de beheerders van de club kunnen het openen.
alter table public.trainer_profiles add column if not exists dipl jsonb not null default '{}'::jsonb;  -- { "uefa_c": {"y": 2025, "file": "pad", "name": "diploma.pdf"} }

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trainer-docs', 'trainer-docs', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- pad: <club_id>/<user_id>/<diploma>-xxxx.pdf
create or replace function public.doc_club(pad text) returns uuid language sql immutable as $$
  select case when split_part(pad, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then split_part(pad, '/', 1)::uuid end $$;
revoke all on function public.doc_club(text) from public;
grant execute on function public.doc_club(text) to authenticated;
drop policy if exists "diploma lezen" on storage.objects;
drop policy if exists "diploma toevoegen" on storage.objects;
drop policy if exists "diploma wijzigen" on storage.objects;
drop policy if exists "diploma verwijderen" on storage.objects;
create policy "diploma lezen" on storage.objects for select to authenticated
  using (bucket_id = 'trainer-docs' and public.doc_club(name) = public.my_club() and (split_part(name, '/', 2) = auth.uid()::text or public.is_admin()));
create policy "diploma toevoegen" on storage.objects for insert to authenticated
  with check (bucket_id = 'trainer-docs' and public.doc_club(name) = public.my_club() and (split_part(name, '/', 2) = auth.uid()::text or public.is_admin()));
create policy "diploma wijzigen" on storage.objects for update to authenticated
  using (bucket_id = 'trainer-docs' and public.doc_club(name) = public.my_club() and (split_part(name, '/', 2) = auth.uid()::text or public.is_admin()));
create policy "diploma verwijderen" on storage.objects for delete to authenticated
  using (bucket_id = 'trainer-docs' and public.doc_club(name) = public.my_club() and (split_part(name, '/', 2) = auth.uid()::text or public.is_admin()));

-- Logo's van tegenstanders: één lijst per club, door alle trainers aan te vullen (link of kleine afbeelding).
create table if not exists public.club_logos (
  club_id    uuid not null default public.my_club() references public.clubs(id) on delete cascade,
  key        text not null,
  name       text,
  url        text not null check (length(url) < 200000 and (url like 'https://%' or url like 'data:image/%')),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (club_id, key));
alter table public.club_logos enable row level security;
drop policy if exists "logos club" on public.club_logos;
create policy "logos club" on public.club_logos for all to authenticated using (club_id = public.my_club()) with check (club_id = public.my_club());
grant select, insert, update, delete on public.club_logos to authenticated;
