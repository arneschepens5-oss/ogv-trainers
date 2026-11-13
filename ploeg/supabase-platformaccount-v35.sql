-- OGV Trainers / FootballCoachHub · v35 · footballcoachhub@gmail.com wordt beheerder van het platform.
-- Dit account kan elke club instellen (naam, kleuren, logo, evaluaties, onderdelen, beheerder, clubcode, RBFA)
-- maar is lid van geen enkele club en ziet dus geen spelers, ploegen, verslagen of evaluaties.
-- Mag uitgevoerd worden vóór of na het aanmaken van het account. Veilig om opnieuw uit te voeren.

/* 1. e-mailadressen die beheerder van het platform worden zodra ze een account hebben */
create table if not exists public.platform_invites (email text primary key, created_at timestamptz default now());
alter table public.platform_invites enable row level security;   -- geen policies: enkel via de database zelf
insert into public.platform_invites(email) values ('footballcoachhub@gmail.com') on conflict do nothing;

/* 2. bij een nieuw account met zo'n adres: meteen beheerder van het platform */
create or replace function public.platform_on_signup() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if exists (select 1 from public.platform_invites where email = lower(new.email)) then
    insert into public.platform_admins(user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function public.platform_on_signup() from public, anon, authenticated;
drop trigger if exists platform_on_signup on auth.users;
create trigger platform_on_signup after insert on auth.users for each row execute function public.platform_on_signup();

/* 3. bestaat het account al: nu meteen */
insert into public.platform_admins(user_id)
select u.id from auth.users u join public.platform_invites i on i.email = lower(u.email)
on conflict do nothing;

/* 4. zo'n account hoort bij geen enkele club (veiligheid: geen toegang tot clubgegevens) */
delete from public.club_members m using auth.users u, public.platform_invites i
where m.user_id = u.id and i.email = lower(u.email);

/* controle: wie is beheerder van het platform, en bij hoeveel clubs is die lid */
select u.email, (select count(*) from public.club_members m where m.user_id = u.id) as clubs
from public.platform_admins p join auth.users u on u.id = p.user_id order by u.email;
