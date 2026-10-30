-- Druvsorter och vinområden från Wikidata (CC0), med namn på svenska och
-- engelska, synonymer och länkar till Wikipedia. Fylls av funktionen
-- wikidata-sync och kan köras om för att uppdatera. Kompletterar den
-- faktagranskade kunskapsbanken i packages/core/src/knowledge.ts.

create table public.wd_grapes (
  wikidata_id text primary key,
  name_en text,
  name_sv text,
  origin_country text,
  wiki_en text,
  wiki_sv text,
  -- Namn och synonymer i gemener utan accenter, för matchning mot vinets druvor.
  match_names text[] not null default '{}',
  updated_at timestamptz not null default now()
);
create index wd_grapes_names on public.wd_grapes using gin (match_names);

create table public.wd_regions (
  wikidata_id text primary key,
  name_en text,
  name_sv text,
  country text,
  wiki_en text,
  wiki_sv text,
  match_names text[] not null default '{}',
  updated_at timestamptz not null default now()
);
create index wd_regions_names on public.wd_regions using gin (match_names);

alter table public.wd_grapes enable row level security;
alter table public.wd_regions enable row level security;
create policy "read wd grapes" on public.wd_grapes for select to authenticated using (true);
create policy "read wd regions" on public.wd_regions for select to authenticated using (true);
grant select on public.wd_grapes, public.wd_regions to authenticated;

-- Import (endast servern). rows: [{id, en, sv, origin, wikiEn, wikiSv, names: [...]}]
create function private.import_wikidata(kind text, rows jsonb) returns integer
language plpgsql
set search_path = ''
as $$
declare n integer;
begin
  if kind = 'grapes' then
    insert into public.wd_grapes (wikidata_id, name_en, name_sv, origin_country, wiki_en, wiki_sv, match_names)
    select x.id, x.en, x.sv, x.origin, x."wikiEn", x."wikiSv", coalesce(x.names, '{}')
    from jsonb_to_recordset(rows) as x(id text, en text, sv text, origin text, "wikiEn" text, "wikiSv" text, names text[])
    on conflict (wikidata_id) do update set
      name_en = excluded.name_en, name_sv = excluded.name_sv, origin_country = excluded.origin_country,
      wiki_en = excluded.wiki_en, wiki_sv = excluded.wiki_sv, match_names = excluded.match_names, updated_at = now();
  elsif kind = 'regions' then
    insert into public.wd_regions (wikidata_id, name_en, name_sv, country, wiki_en, wiki_sv, match_names)
    select x.id, x.en, x.sv, x.origin, x."wikiEn", x."wikiSv", coalesce(x.names, '{}')
    from jsonb_to_recordset(rows) as x(id text, en text, sv text, origin text, "wikiEn" text, "wikiSv" text, names text[])
    on conflict (wikidata_id) do update set
      name_en = excluded.name_en, name_sv = excluded.name_sv, country = excluded.country,
      wiki_en = excluded.wiki_en, wiki_sv = excluded.wiki_sv, match_names = excluded.match_names, updated_at = now();
  else
    raise exception 'kind must be grapes or regions' using errcode = '22023';
  end if;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function private.import_wikidata(text, jsonb) from public, anon, authenticated;

-- Uppslag för flasksidan: druvor och område som matchar vinets namn.
create function public.wikidata_lookup(grape_names text[], place_names text[])
returns jsonb
language sql stable
set search_path = public, extensions
as $$
  with g as (select array_agg(lower(public.immutable_unaccent(n))) as a from unnest(grape_names) n),
       p as (select array_agg(lower(public.immutable_unaccent(n))) as a from unnest(place_names) n)
  select jsonb_build_object(
    'grapes', coalesce((select jsonb_agg(to_jsonb(x) - 'match_names' - 'updated_at')
                        from (select w.* from wd_grapes w, g where w.match_names && g.a limit 5) x), '[]'::jsonb),
    'regions', coalesce((select jsonb_agg(to_jsonb(x) - 'match_names' - 'updated_at')
                         from (select r.* from wd_regions r, p where r.match_names && p.a limit 3) x), '[]'::jsonb)
  )
$$;

grant execute on function public.wikidata_lookup(text[], text[]) to authenticated;
