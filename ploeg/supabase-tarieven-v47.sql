-- v47: vergoeding per trainer. Wie het recht "Betalingen" heeft (of beheerder is), stelt het bedrag per training en per wedstrijd
-- in per trainer; tkey '*' is het standaardtarief van de club. Andere trainers zien deze bedragen niet. Voer eerst v46 uit.
create table if not exists public.trainer_rates (
  club_id      uuid not null default public.my_club() references public.clubs(id) on delete cascade,
  tkey         text not null check (length(tkey) between 1 and 200),
  per_training numeric(6,2) check (per_training is null or per_training between 0 and 999),
  per_match    numeric(6,2) check (per_match is null or per_match between 0 and 999),
  updated_by   uuid default auth.uid(),
  updated_at   timestamptz not null default now(),
  primary key (club_id, tkey));
alter table public.trainer_rates enable row level security;
drop policy if exists "tarieven betalingen" on public.trainer_rates;
create policy "tarieven betalingen" on public.trainer_rates for all to authenticated
  using (club_id = public.my_club() and public.heeft_recht('betalingen')) with check (club_id = public.my_club() and public.heeft_recht('betalingen'));
grant select, insert, update, delete on public.trainer_rates to authenticated;
