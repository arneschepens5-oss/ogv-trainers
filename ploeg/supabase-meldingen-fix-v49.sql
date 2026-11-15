-- FootballCoachHub · v49 · meldingen: toegang voor de meldingsfunctie
-- Waarom: in dit Supabase-project krijgt de server-rol (service_role) geen automatische toegang tot nieuwe tabellen.
-- De meldingsfunctie kon daardoor haar sleutels niet aanmaken en niets lezen ("Aanzetten" mislukte).
-- Enkel de server-functie gebruikt deze rol; ouders en trainers krijgen hierdoor NIETS extra te zien.
-- Veilig om meerdere keren uit te voeren.

-- lezen: wat de functie nodig heeft om te bepalen wie welke melding krijgt
grant select on public.teams, public.team_trainers, public.players, public.events,
  public.rsvp, public.attendance, public.player_absence to service_role;

-- de eigen tabellen van de meldingen
grant select, insert on public.push_keys to service_role;
grant select, update, delete on public.push_subs to service_role;
grant select, insert on public.notif_sent to service_role;
