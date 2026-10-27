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
end $$;
\echo 'Importtester passerade'
