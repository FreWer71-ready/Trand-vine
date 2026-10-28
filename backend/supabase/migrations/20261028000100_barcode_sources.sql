-- Källor med streckkoder (Alko, Vinmonopolet) och etikettläsning.

-- Källans eget produktnummer, unikt per källa.
alter table public.wines add column external_ref text;
create unique index wines_source_ref on public.wines (source, external_ref);

-- Import (endast servern): rader från packages/importers/src/externalWine.ts
-- som JSON. Vinet uppdateras om det redan finns; streckkoder som någon
-- användare redan kopplat till ett vin behålls. Kan köras om.
create function private.import_external(src text, rows jsonb) returns integer
language plpgsql
set search_path = ''
as $$
declare n integer;
begin
  insert into public.wines (source, external_ref, name, producer, country, region, color, grapes, abv)
  select src, x.ref, x.name, x.producer, x.country, x.region, x.color::public.wine_color,
         coalesce(x.grapes, '{}'), x.abv
  from jsonb_to_recordset(rows) as x(
    ref text, name text, producer text, country text, region text, color text, grapes text[], abv numeric)
  on conflict (source, external_ref) do update set
    name = excluded.name, producer = excluded.producer, country = excluded.country,
    region = excluded.region, color = excluded.color, grapes = excluded.grapes, abv = excluded.abv;

  insert into public.wine_barcodes (ean, wine_id, source, bottle_size_ml)
  select e.ean, w.id, src, x."volumeMl"
  from jsonb_to_recordset(rows) as x(ref text, eans text[], "volumeMl" integer)
  cross join lateral unnest(x.eans) as e(ean)
  join public.wines w on w.source = src and w.external_ref = x.ref
  where e.ean ~ '^\d{8,14}$'
  on conflict (ean) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function private.import_external(text, jsonb) from public, anon, authenticated;

-- Etikettläsning (Google Vision): en rad per läsning, för att hålla
-- användningen inom gratiskvoten. Läses och skrivs bara av serverfunktionen.
create table private.label_reads (
  user_id uuid not null,
  created_at timestamptz not null default now()
);
create index label_reads_user_time on private.label_reads (user_id, created_at);
create index label_reads_time on private.label_reads (created_at);
