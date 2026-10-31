-- Snabbare sökning. Den tidigare versionen lade söktexten i en CTE som
-- joinades mot wines, så trigramindexet inte användes inne i funktionen:
-- ~2,3 s per sökning, och etikettläsningens samtidiga sökningar slog i
-- tidsgränsen. Med söktexten som variabel tar en sökning ~70 ms.
-- Ett artikelnummer från Systembolaget ger bara den träffen.

create or replace function public.search_wines(q text, max_results int default 20)
returns setof public.wines
language plpgsql stable
set search_path = public, extensions
as $$
declare
  t text := lower(public.immutable_unaccent(coalesce(q, '')));
  nr text := nullif(regexp_replace(coalesce(q, ''), '\s', '', 'g'), '');
begin
  -- Artikelnummer från Systembolaget (hyllkant, kvitto, webbadress).
  if nr ~ '^\d{4,9}$' then
    return query
      select w.* from wines w
      where w.id in (select p.wine_id from systembolaget_products p
                     where p.short_number = nr or p.product_number = nr)
      limit least(max_results, 50);
    if found then return; end if;
  end if;
  -- Text: söktexten som variabel, så att trigramindexet används.
  return query
    select w.* from wines w
    where w.search_text % t or w.search_text ilike '%' || t || '%'
    order by similarity(w.search_text, t) desc
    limit least(max_results, 50);
end $$;
