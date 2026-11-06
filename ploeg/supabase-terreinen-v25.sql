-- Databaseversie 25: een terrein dat je zelf (of met "automatisch indelen") kiest, wordt niet meer overschreven bij "RBFA bijwerken".
create or replace function public.zet_terreininfo(ev uuid, p jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.heeft_recht('terreinen') then raise exception 'Je hebt geen recht om de terreinen in te delen. Vraag het aan de beheerder.'; end if;
  update public.events set
    location   = case when p ? 'location'   then nullif(p->>'location', '')        else location end,
    rbfa_loc   = case when p ? 'location'   then false                              else rbfa_loc end,
    start_time = case when p ? 'start_time' then nullif(p->>'start_time', '')::time else start_time end,
    end_time   = case when p ? 'end_time'   then nullif(p->>'end_time', '')::time   else end_time end,
    field_part = case when p ? 'field_part' then nullif(p->>'field_part', '')       else field_part end,
    kk_home    = case when p ? 'kk_home'    then nullif(p->>'kk_home', '')          else kk_home end,
    kk_away    = case when p ? 'kk_away'    then nullif(p->>'kk_away', '')          else kk_away end,
    referee    = case when p ? 'referee'    then nullif(p->>'referee', '')          else referee end
  where id = ev;
  return found;
end $$;
revoke execute on function public.zet_terreininfo(uuid, jsonb) from public, anon;
grant execute on function public.zet_terreininfo(uuid, jsonb) to authenticated, service_role;
