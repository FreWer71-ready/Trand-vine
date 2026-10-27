-- Tester av schema, triggrar och RLS. Avbryter vid första fel.
\set ON_ERROR_STOP on
\set QUIET on

-- Två användare
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'anna@example.com', '{"full_name": "Anna A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bo@example.com', '{}');

do $$ begin
  assert (select display_name from profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Anna A', 'profil från full_name';
  assert (select display_name from profiles where id = '00000000-0000-0000-0000-00000000000b') = 'bo', 'profil från e-post';
end $$;

-- Importerat vin med startbetyg (som service role)
insert into wines (id, name, producer, region, color, grapes, source, xwines_id) values
  ('10000000-0000-0000-0000-000000000001', 'Barolo Bricco', 'Cantina Rossi', 'Piemonte', 'red', '{Nebbiolo}', 'xwines', 'x1');
insert into vintages (id, wine_id, year, seed_avg_rating, seed_rating_count) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 2016, 4.00, 2);

-- Som Anna
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

-- Får lägga till vin och streckkod, men inte förfalska startbetyg
insert into wines (id, name, created_by) values
  ('10000000-0000-0000-0000-000000000002', 'Husets Rött', '00000000-0000-0000-0000-00000000000a');
insert into vintages (wine_id, year) values ('10000000-0000-0000-0000-000000000002', null);
insert into wine_barcodes (ean, wine_id, source, confirmed_by) values
  ('4006381333931', '10000000-0000-0000-0000-000000000001', 'openfoodfacts', '00000000-0000-0000-0000-00000000000a');

do $$ begin
  begin
    insert into vintages (wine_id, year, seed_avg_rating, seed_rating_count)
      values ('10000000-0000-0000-0000-000000000002', 2020, 5, 1000);
    raise exception 'borde nekas: förfalskat startbetyg';
  exception when insufficient_privilege then null;
  end;
  begin
    update wines set name = 'Hackat' where id = '10000000-0000-0000-0000-000000000001';
    raise exception 'borde nekas: användare ändrar registret';
  exception when insufficient_privilege then null;
  end;
  begin
    perform refresh_vintage_rating_for('20000000-0000-0000-0000-000000000001');
    raise exception 'borde nekas: intern funktion anropad direkt';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Flaska som gåva med betyg 5 → community-betyg (4*2 + 5) / 3 = 4.33
insert into bottles (id, vintage_id, acquisition_type, gift_from, status, consumed_at, rating) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'gift', 'Mamma', 'consumed', '2025-12-24', 5);
insert into bottles (vintage_id, acquisition_type, price, currency) values
  ('20000000-0000-0000-0000-000000000001', 'purchase', 450, 'SEK');

do $$ begin
  assert (select avg_rating from vintages where id = '20000000-0000-0000-0000-000000000001') = 4.33, 'medelbetyg efter Annas betyg';
  assert (select rating_count from vintages where id = '20000000-0000-0000-0000-000000000001') = 3, 'antal betyg';
  assert (select count(*) from my_wine_history('10000000-0000-0000-0000-000000000001')) = 2, 'Annas historik';
  assert (select count(*) from search_wines('barolo')) = 1, 'sökning';
  assert (select count(*) from search_wines('rossi bricco')) = 1, 'sökning på producent';
end $$;

-- Ändrat betyg ersätter det gamla, ingen dubbelräkning
update bottles set rating = 3 where id = '30000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select avg_rating from vintages where id = '20000000-0000-0000-0000-000000000001') = 3.67, 'ändrat betyg';
  assert (select rating_count from vintages where id = '20000000-0000-0000-0000-000000000001') = 3, 'ingen dubbelräkning';
end $$;

-- Som Bo: ser inte Annas flaskor eller betyg, men ser medelbetyget
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert (select count(*) from bottles) = 0, 'Bo ser inte Annas flaskor';
  assert (select count(*) from ratings) = 0, 'Bo ser inte Annas betyg';
  assert (select count(*) from my_wine_history('10000000-0000-0000-0000-000000000001')) = 0, 'Bo har ingen historik';
  assert (select avg_rating from vintages where id = '20000000-0000-0000-0000-000000000001') = 3.67, 'Bo ser medelbetyget';
  assert (select count(*) from wine_barcodes where ean = '4006381333931') = 1, 'Bo får träff på Annas streckkod';
  update bottles set rating = 1;
  assert not found, 'Bo kan inte ändra Annas flaskor';
  begin
    insert into bottles (user_id, vintage_id, acquisition_type)
      values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001', 'purchase');
    raise exception 'borde nekas: flaska åt annan användare';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
\echo 'Alla databastester passerade'
