-- =====================================================================
-- Evaluaties openbaar maken voor ouders en spelers (per ploeg, per moment).
-- Trainers kiezen zelf welk evaluatiemoment zichtbaar wordt (bv. winterstop/kerst = 3,
-- einde seizoen = 5). Zolang een moment niet gepubliceerd is, blijft het verborgen.
-- Ouders/spelers zien alleen: scores per onderdeel (bv. Spelinzicht 3/5), sterktes,
-- werkpunten en doelen. Privénotitie, niveau, advies en oudergesprek blijven intern.
-- Uit te voeren in de Supabase SQL-editor door de beheerder.
-- =====================================================================

create table if not exists public.eval_publicaties (
  team_id      uuid not null references public.teams(id) on delete cascade,
  moment       integer not null check (moment between 1 and 5),
  published_at timestamptz not null default now(),
  primary key (team_id, moment)
);
alter table public.eval_publicaties enable row level security;

drop policy if exists "eval publicaties lezen" on public.eval_publicaties;
create policy "eval publicaties lezen" on public.eval_publicaties for select to authenticated
  using (public.is_member());

drop policy if exists "eval publicaties beheren" on public.eval_publicaties;
create policy "eval publicaties beheren" on public.eval_publicaties for all to authenticated
  using (public.is_trainer(team_id)) with check (public.is_trainer(team_id));

-- Trainer (of beheerder) zet een moment aan of uit.
create or replace function public.set_eval_publicatie(t uuid, m integer, aan boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_trainer(t) then raise exception 'Alleen trainers van deze ploeg.'; end if;
  if m not between 1 and 5 then return false; end if;
  if aan then
    insert into public.eval_publicaties(team_id, moment) values (t, m) on conflict do nothing;
  else
    delete from public.eval_publicaties where team_id = t and moment = m;
  end if;
  return true;
end $$;
grant execute on function public.set_eval_publicatie(uuid, integer, boolean) to authenticated;

-- Ouder of speler (via de persoonlijke link) haalt de gepubliceerde evaluaties op.
create or replace function public.parent_evaluaties(tok uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare p public.players%rowtype;
begin
  select * into p from public.players where (parent_token = tok or player_token = tok) and active is not false;
  if not found then return null; end if;
  /* Alleen scores per onderdeel, sterktes, werkpunten en doelen.
     NIET: privénotitie (comment), niveau t.o.v. de ploeg, advies volgend seizoen, oudergesprek. */
  return json_build_object(
    'criteria', (select t.criteria from public.teams t where t.id = p.team_id),
    'evals', coalesce((select json_agg(json_build_object('moment', ev.moment, 'date', ev.date, 'scores', ev.scores,
                'strengths', ev.details->>'strengths', 'workpoints', ev.details->>'workpoints', 'goals', ev.details->>'goals')
              order by ev.moment)
      from public.evaluations ev
      where ev.player_id = p.id and ev.team_id = p.team_id
        and ev.moment in (select pub.moment from public.eval_publicaties pub where pub.team_id = p.team_id)), '[]'::json));
end $$;
grant execute on function public.parent_evaluaties(uuid) to anon, authenticated;
