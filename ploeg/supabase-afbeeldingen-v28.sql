-- Databaseversie 28: afbeeldingen van oefeningen binnen een gedeelde training zijn zichtbaar voor alle clubleden
-- (voorheen enkel de afbeelding van een losse gedeelde oefening).
drop policy if exists "gedeelde afbeeldingen lezen" on storage.objects;
create policy "gedeelde afbeeldingen lezen" on storage.objects for select to authenticated
  using (bucket_id = 'trainer-files' and public.is_member() and exists (
    select 1 from public.trainer_items t
     where t.shared and (t.data ->> 'img_path' = objects.name
        or t.data -> 'items' @> jsonb_build_array(jsonb_build_object('img_path', objects.name)))));
