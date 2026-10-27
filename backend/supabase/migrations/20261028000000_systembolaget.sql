-- Systembolagets sortiment i vinregistret: sök på svenska namn och på
-- artikelnummer (hyllkanten, kvittot, systembolaget.se), och förifyll pris,
-- storlek och årgång när ett sådant vin väljs. Streckkoder finns inte i datan.

alter table public.wines add column systembolaget_nr text unique;

create table public.systembolaget_products (
  product_number text primary key,   -- 7614901, står i webbadressen
  short_number text not null,        -- 76149, står på hyllkanten och kvittot
  wine_id uuid not null references public.wines (id) on delete cascade,
  vintage smallint check (vintage between 1800 and 2200),
  volume_ml integer check (volume_ml > 0),
  price numeric(10, 2) check (price >= 0),
  updated_at timestamptz not null default now()
);

create index systembolaget_products_short on public.systembolaget_products (short_number);
create index systembolaget_products_wine on public.systembolaget_products (wine_id);

alter table public.systembolaget_products enable row level security;
create policy "read systembolaget" on public.systembolaget_products
  for select to authenticated using (true);
grant select on public.systembolaget_products to authenticated;

-- Sökningen träffar nu också artikelnummer; ett exakt nummer kommer först.
create or replace function public.search_wines(q text, max_results int default 20)
returns setof public.wines
language sql stable
set search_path = public, extensions
as $$
  with term as (
    select lower(public.immutable_unaccent(q)) as t, nullif(regexp_replace(q, '\s', '', 'g'), '') as nr
  )
  select w.*
  from wines w, term
  where w.search_text % term.t
     or w.search_text ilike '%' || term.t || '%'
     or (term.nr ~ '^\d{4,9}$' and w.id in (
          select p.wine_id from systembolaget_products p
          where p.short_number = term.nr or p.product_number = term.nr))
  order by
    (term.nr ~ '^\d{4,9}$' and w.id in (
      select p.wine_id from systembolaget_products p
      where p.short_number = term.nr or p.product_number = term.nr)) desc,
    similarity(w.search_text, term.t) desc
  limit least(max_results, 50)
$$;

-- Import (endast servern): rader från packages/importers/src/systembolagetMap.ts
-- som JSON. Används av funktionen import-xwines och av importverktyget.
-- Kan köras om; befintliga viner och priser uppdateras.

-- Utan temporär tabell: raderna läses två gånger direkt ur JSON.
create function private.import_systembolaget(rows jsonb) returns integer
language plpgsql
set search_path = ''
as $$
declare n integer;
begin
  insert into public.wines (systembolaget_nr, name, producer, country, region, appellation,
                            color, grapes, abv, food_pairings, image_url, source)
  select x."productNumber", x.name, x.producer, x.country, x.region, x.appellation,
         x.color::public.wine_color, coalesce(x.grapes, '{}'), x.abv, coalesce(x.food, '{}'), x."imageUrl", 'systembolaget'
  from jsonb_to_recordset(rows) as x(
    "productNumber" text, name text, producer text, country text, region text, appellation text,
    color text, grapes text[], abv numeric, food text[], "imageUrl" text)
  on conflict (systembolaget_nr) do update set
    name = excluded.name, producer = excluded.producer, country = excluded.country,
    region = excluded.region, appellation = excluded.appellation, color = excluded.color,
    grapes = excluded.grapes, abv = excluded.abv, food_pairings = excluded.food_pairings,
    image_url = excluded.image_url;

  insert into public.systembolaget_products (product_number, short_number, wine_id, vintage, volume_ml, price)
  select x."productNumber", x."shortNumber", w.id, x.vintage, x."volumeMl", x.price
  from jsonb_to_recordset(rows) as x(
    "productNumber" text, "shortNumber" text, vintage smallint, "volumeMl" integer, price numeric)
  join public.wines w on w.systembolaget_nr = x."productNumber"
  on conflict (product_number) do update set
    short_number = excluded.short_number, wine_id = excluded.wine_id, vintage = excluded.vintage,
    volume_ml = excluded.volume_ml, price = excluded.price, updated_at = now();
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function private.import_systembolaget(jsonb) from public, anon, authenticated;
