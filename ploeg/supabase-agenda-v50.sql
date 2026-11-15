-- FootballCoachHub · v50 · agenda koppelen (Google Agenda, iPhone, Outlook)
-- Elke trainer krijgt een persoonlijke, geheime agendalink. Ouders gebruiken de code van hun bestaande ouderlink.
-- Voer eerst v49 uit. Veilig om meerdere keren uit te voeren.

create table if not exists public.trainer_cal (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now());
alter table public.trainer_cal enable row level security;
revoke all on public.trainer_cal from anon, authenticated;
grant select on public.trainer_cal to service_role;   -- enkel de agendafunctie op de server leest dit

-- geeft de eigen agendacode (en maakt ze aan als ze nog niet bestaat); nieuw = true maakt een nieuwe (de oude werkt dan niet meer)
create or replace function public.cal_token(nieuw boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare tk uuid;
begin
  if auth.uid() is null then raise exception 'Niet aangemeld'; end if;
  if nieuw then delete from public.trainer_cal where user_id = auth.uid(); end if;
  insert into public.trainer_cal(user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select token into tk from public.trainer_cal where user_id = auth.uid();
  return tk;
end $$;
revoke all on function public.cal_token(boolean) from public, anon;
grant execute on function public.cal_token(boolean) to authenticated;

-- de agendafunctie leest ploegen, spelers en activiteiten (al toegestaan door v49, hier voor de zekerheid)
grant select on public.teams, public.team_trainers, public.players, public.events to service_role;
