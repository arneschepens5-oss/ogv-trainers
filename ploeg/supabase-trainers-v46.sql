-- v46: meerdere RBFA-ploegen per ploeg (bv. PU9 A en B), aanwezigheid van trainers en het recht "Betalingen".
-- Voer eerst v43 uit (club_set_rechten). Veilig om opnieuw uit te voeren.

-- 1. meerdere RBFA-ploegen per ploeg in de app, elk met een vast groepje: [{"id": "123", "squad": "A"}, ...]
alter table public.teams add column if not exists rbfa_links jsonb;

-- 2. aanwezigheid van trainers per training of wedstrijd (tkey = user_id of e-mailadres van de trainer)
create table if not exists public.trainer_att (
  event_id   uuid not null references public.events(id) on delete cascade,
  team_id    uuid not null references public.teams(id) on delete cascade,
  tkey       text not null check (length(tkey) between 3 and 200),
  present    boolean not null,
  by_name    text,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (event_id, tkey));
create index if not exists trainer_att_team on public.trainer_att(team_id);
alter table public.trainer_att enable row level security;
drop policy if exists "trainersaanwezigheid ploeg" on public.trainer_att;
create policy "trainersaanwezigheid ploeg" on public.trainer_att for all to authenticated
  using (public.is_trainer(team_id) or public.is_team_admin(team_id)) with check (public.is_trainer(team_id) or public.is_team_admin(team_id));
grant select, insert, update, delete on public.trainer_att to authenticated;

-- 3. recht "betalingen" (bv. de penningmeester) naast scouting, terreinen en het uitzetten van interne scouting
create or replace function public.club_set_rechten(uid uuid, r text[]) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'Alleen voor beheerders van de club.'; end if;
  update public.club_members
     set rechten = coalesce((select array_agg(distinct x) from unnest(coalesce(r, '{}')) x where x in ('scouting', 'terreinen', 'intscout_uit', 'betalingen')), '{}')
   where user_id = uid and club_id = public.my_club();
end $$;

-- 4. overzicht voor de betalingen: activiteiten, trainers en hun aanwezigheid. Geen spelersgegevens.
create or replace function public.club_betalingen(d1 date, d2 date) returns json language plpgsql stable security definer set search_path to 'public' as $$
declare c uuid := public.my_club();
begin
  if not (public.is_admin() or exists (select 1 from public.club_members m where m.user_id = auth.uid() and m.club_id = c and 'betalingen' = any(m.rechten))) then
    raise exception 'Alleen voor wie het recht Betalingen heeft.'; end if;
  return json_build_object(
    'teams', coalesce((select json_agg(json_build_object('id', t.id, 'name', t.name, 'category', t.category)) from public.teams t where t.club_id = c), '[]'::json),
    'trainers', coalesce((select json_agg(json_build_object('team_id', tt.team_id, 'user_id', tt.user_id, 'email', coalesce(tt.email, tp.email), 'name', tp.name))
      from public.team_trainers tt join public.teams t on t.id = tt.team_id left join public.trainer_profiles tp on tp.user_id = tt.user_id where t.club_id = c), '[]'::json),
    'events', coalesce((select json_agg(json_build_object('id', e.id, 'team_id', e.team_id, 'type', e.type, 'date', e.date, 'start_time', e.start_time, 'opponent', e.opponent,
        'cancelled', e.cancelled or coalesce(e.rbfa_state, '') = 'afgelast', 'squad', e.report->>'squad'))
      from public.events e join public.teams t on t.id = e.team_id where t.club_id = c and e.date between d1 and d2 and e.type in ('training', 'wedstrijd')), '[]'::json),
    'att', coalesce((select json_agg(json_build_object('event_id', a.event_id, 'tkey', a.tkey, 'present', a.present))
      from public.trainer_att a join public.events e on e.id = a.event_id join public.teams t on t.id = a.team_id where t.club_id = c and e.date between d1 and d2), '[]'::json));
end $$;
revoke all on function public.club_betalingen(date, date) from public, anon;
grant execute on function public.club_betalingen(date, date) to authenticated;
