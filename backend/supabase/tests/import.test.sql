-- Körs efter att X-Wines testdata och LWIN-exempel importerats två gånger.
\set ON_ERROR_STOP on
\set QUIET on
do $$
begin
  assert (select count(*) from wines where source = 'xwines' and xwines_id <> 'x1') = 100, 'X-Wines: 100 viner (ingen dubblering vid omkörning)';
  assert (select count(*) from wines where source = 'lwin') = 3, 'LWIN: 3 viner';
  assert (select color from wines where lwin = '1111111') = 'fortified', 'LWIN-färg';
  assert (select grapes from wines where xwines_id = '100062') = '{Merlot}', 'druvor';
  assert 'red_meat' = any (select unnest(food_pairings) from wines where xwines_id = '100062'), 'mat';
  assert (select count(*) from vintages v join wines w on w.id = v.wine_id where w.source = 'xwines') > 0, 'årgångar med betyg';
  -- Visat medelbetyg = startbetyg när inga användare betygsatt ännu.
  -- (Schematestets vin 'x1' har användarbetyg och räknas inte.)
  assert not exists (select 1 from vintages v join wines w on w.id = v.wine_id
                     where v.seed_rating_count > 0 and w.xwines_id <> 'x1'
                     and (avg_rating is distinct from seed_avg_rating or rating_count <> seed_rating_count)),
         'avg_rating synkat med startbetyg';
  assert (select count(*) from wine_ratings) > 0, 'betyg på vinnivå';
  assert (select count(*) from search_wines('margaux')) >= 1, 'sökning i LWIN';
  -- Systembolaget: tre viner (öl, vinlåda och dubblett bortfiltrerade), ingen dubblering vid omkörning.
  assert (select count(*) from wines where source = 'systembolaget') = 3, 'Systembolaget: 3 viner';
  assert (select count(*) from systembolaget_products) = 3, 'Systembolaget: 3 artiklar';
  assert (select (price, vintage, volume_ml) from systembolaget_products where product_number = '5570901')
    = (999::numeric(10,2), 2018::smallint, 750), 'pris, årgång och storlek';
end $$;

-- Källor med streckkoder: vin + streckkod, omkörning uppdaterar, befintlig koppling behålls.
do $$ begin perform private.import_external('alko', '[{"ref":"906458","eans":["7350084980013","4006381333931"],"name":"Fair & Square Red","producer":"La Riojana","country":"Argentina","region":"La Rioja","color":"red","grapes":["Syrah"],"abv":13,"vintage":2024,"volumeMl":750}]'::jsonb); end $$;
do $$ begin perform private.import_external('alko', '[{"ref":"906458","eans":["7350084980013"],"name":"Fair and Square Red","producer":"La Riojana","country":"Argentina","region":null,"color":"red","grapes":[],"abv":13,"vintage":null,"volumeMl":750}]'::jsonb); end $$;
do $$
begin
  assert (select count(*) from wines where source = 'alko') = 1, 'Alko: ett vin';
  assert (select name from wines where source = 'alko') = 'Fair and Square Red', 'Alko: uppdaterat namn';
  assert (select w.source from wine_barcodes b join wines w on w.id = b.wine_id where b.ean = '7350084980013') = 'alko', 'Alko: streckkod';
  assert (select w.source from wine_barcodes b join wines w on w.id = b.wine_id where b.ean = '4006381333931') = 'xwines', 'befintlig koppling behålls';
end $$;

-- Wikidata: import (två gånger) och uppslag på synonymer utan accenter.
do $$ begin
  perform private.import_wikidata('grapes', '[{"id":"Q213332","en":"Zinfandel","sv":"Zinfandel","origin":"Croatia","wikiEn":"https://en.wikipedia.org/wiki/Zinfandel","wikiSv":null,"names":["zinfandel","primitivo","tribidrag","crljenak kastelanski"]}]'::jsonb);
  perform private.import_wikidata('grapes', '[{"id":"Q213332","en":"Zinfandel","sv":"Zinfandel","origin":"Croatia","wikiEn":"https://en.wikipedia.org/wiki/Zinfandel","wikiSv":"https://sv.wikipedia.org/wiki/Zinfandel","names":["zinfandel","primitivo","tribidrag","crljenak kastelanski"]}]'::jsonb);
  perform private.import_wikidata('regions', '[{"id":"Q1071629","en":"Rioja","sv":null,"origin":"Spain","wikiEn":"https://en.wikipedia.org/wiki/Rioja_(wine)","wikiSv":null,"names":["rioja","rioja doca"]}]'::jsonb);
  assert (select count(*) from wd_grapes) = 1, 'Wikidata: en druva';
end $$;

-- Sökning som inloggad användare: kort nummer (hyllkant), långt nummer (webbadress) och namn.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
begin
  assert (select name from search_wines('55709') limit 1) = 'Amarone della Valpolicella', 'kort artikelnummer';
  assert (select name from search_wines(' 5570901 ') limit 1) = 'Amarone della Valpolicella', 'långt artikelnummer';
  assert (select count(*) from search_wines('commandaria')) = 1, 'sökning på namn';
  assert (select count(*) from systembolaget_products) = 3, 'användare läser artiklar';
  assert (select wikidata_lookup(array['Primitivo'], array['Rioja']) -> 'grapes' -> 0 ->> 'wiki_sv') = 'https://sv.wikipedia.org/wiki/Zinfandel', 'Wikidata: druva via synonym';
  assert (select wikidata_lookup(array['Crljenak Kaštelanski'], array[]::text[]) -> 'grapes' -> 0 ->> 'name_en') = 'Zinfandel', 'Wikidata: utan accenter';
  assert (select wikidata_lookup(array[]::text[], array['RIOJA']) -> 'regions' -> 0 ->> 'country') = 'Spain', 'Wikidata: område';
  begin
    perform private.import_wikidata('grapes', '[]'::jsonb);
    raise exception 'borde nekas: wikidata-import som användare';
  exception when insufficient_privilege then null;
  end;
  begin
    perform private.import_external('alko', '[]'::jsonb);
    raise exception 'borde nekas: extern import som användare';
  exception when insufficient_privilege then null;
  end;
  begin
    perform private.import_systembolaget('[]'::jsonb);
    raise exception 'borde nekas: import som användare';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'Importtester passerade'
