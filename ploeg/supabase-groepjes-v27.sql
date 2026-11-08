-- Databaseversie 27: bij elk cijfer en elke opmerking bewaren welke trainer het invulde.
-- Nodig wanneer twee trainers samen één ploeg opvolgen (bv. PU9 met groepje A en B).
alter table public.attendance add column if not exists rated_by    text;
alter table public.attendance add column if not exists rated_by_id uuid;
