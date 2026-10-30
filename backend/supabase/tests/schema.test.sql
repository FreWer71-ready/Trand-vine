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

-- Inbjudningskod (som admin/servern) och Anna som admin
insert into private.invite_codes (code, max_uses) values ('TEST-KOD1', 1);
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-00000000000a';

-- Som Anna
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

-- Utan kod får man inte lägga till något; med kod går det
do $$ begin
  assert not is_approved(), 'ny användare saknar tillgång';
  begin
    insert into wines (name, created_by) values ('Före kod', '00000000-0000-0000-0000-00000000000a');
  exception when insufficient_privilege then null;
  end;
  begin
    update profiles set approved_at = now() where id = '00000000-0000-0000-0000-00000000000a';
    raise exception 'borde nekas: sätta egen behörighet';
  exception when insufficient_privilege then null;
  end;
  assert redeem_invite('fel-kod') = 'invalid', 'fel kod';
  assert redeem_invite(' test-kod1 ') = 'ok', 'rätt kod, skiftläge och mellanslag spelar ingen roll';
  assert is_approved(), 'godkänd efter kod';
  assert not is_admin(), 'inte admin än';
end $$;
reset role;
insert into private.admin_emails (email) values ('anna@example.com');
set role authenticated;
do $$ begin
  assert is_admin(), 'Anna är admin';
  assert (admin_overview() -> 'stats' ->> 'approved')::int = 1, 'adminöversikt';
  assert admin_create_code(null, 'Till Bo', 2, null) like 'VIN-%', 'slumpad kod';
  perform admin_create_code('bo-1', null, null, null);
end $$;

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
insert into bottles (id, vintage_id, acquisition_type, price, currency) values
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'purchase', 450, 'SEK');

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

-- Tre flaskor som en post; dricker en → posten har två kvar, den druckna blir egen rad
insert into bottles (id, vintage_id, acquisition_type, price, currency, store, quantity) values
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'purchase', 300, 'SEK', 'Systembolaget', 3);
do $$
declare taken uuid;
begin
  taken := take_bottle('30000000-0000-0000-0000-000000000003', 'consumed', '2026-01-01', 'Bo', null, 3::smallint, null);
  assert taken <> '30000000-0000-0000-0000-000000000003', 'ny rad för uttagen flaska';
  assert (select quantity from bottles where id = '30000000-0000-0000-0000-000000000003') = 2, 'två kvar';
  assert (select status from bottles where id = '30000000-0000-0000-0000-000000000003') = 'in_cellar', 'posten ligger kvar';
  assert (select (status, quantity, store, consumed_with, rating) from bottles where id = taken)
    = ('consumed'::bottle_status, 1, 'Systembolaget'::text, 'Bo'::text, 3::smallint), 'uttagen flaska';
  perform take_bottle('30000000-0000-0000-0000-000000000003', 'given_away', '2026-01-02');
  taken := take_bottle('30000000-0000-0000-0000-000000000003', 'consumed', '2026-01-03');
  assert taken = '30000000-0000-0000-0000-000000000003', 'sista flaskan tar posten själv';
  assert (select status from bottles where id = taken) = 'consumed', 'posten drucken';
  assert (select count(*) from bottles where store = 'Systembolaget') = 3, 'tre rader i historiken';
  begin
    perform take_bottle('30000000-0000-0000-0000-000000000003', 'consumed', '2026-01-04');
    raise exception 'borde nekas: tom post';
  exception when no_data_found then null;
  end;
  begin
    insert into bottles (vintage_id, acquisition_type, quantity) values ('20000000-0000-0000-0000-000000000001', 'purchase', 0);
    raise exception 'borde nekas: antal 0';
  exception when check_violation then null;
  end;
end $$;

-- Bo: kod som redan är förbrukad, för många försök, admin nekas
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert redeem_invite('TEST-KOD1') = 'used_up', 'förbrukad kod';
  for i in 1..10 loop perform redeem_invite('gissning'); end loop;
  assert redeem_invite('BO-1') = 'too_many_attempts', 'spärr mot gissning';
  begin
    perform admin_overview();
    raise exception 'borde nekas: admin';
  exception when insufficient_privilege then null;
  end;
  begin
    perform admin_create_code('HACK', null, null, null);
    raise exception 'borde nekas: skapa kod';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
delete from private.invite_attempts;
set role authenticated;
do $$ begin
  assert redeem_invite('BO-1') = 'ok', 'Bo löser in sin kod';
end $$;

-- Flytt av källare från anonymt konto: Bo (anonym enhet) → Anna (befintligt konto)
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into bottles (id, vintage_id, acquisition_type) values
  ('30000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-000000000001', 'purchase');
create temp table ticket as select create_transfer_ticket() as t;
grant select on ticket to authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert claim_transfer((select t from ticket)) = 1, 'en flaska flyttad';
  assert claim_transfer((select t from ticket)) = 0, 'biljetten kan bara användas en gång';
  assert (select user_id from bottles where id = '30000000-0000-0000-0000-0000000000b1') = '00000000-0000-0000-0000-00000000000a', 'flaskan är Annas';
end $$;
reset role;
update bottles set user_id = '00000000-0000-0000-0000-00000000000b' where id = '30000000-0000-0000-0000-0000000000b1';
delete from bottles where id = '30000000-0000-0000-0000-0000000000b1';
set role authenticated;

-- Admin tar bort Bos tillgång
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select admin_set_user_access('00000000-0000-0000-0000-00000000000b', false) \gset
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert not is_approved(), 'Bo har inte längre tillgång';
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
    perform take_bottle('30000000-0000-0000-0000-000000000002', 'consumed', '2026-01-01');
    raise exception 'borde nekas: Bo tar Annas flaska';
  exception when no_data_found then null;
  end;
  reset role;
  assert (select status from bottles where id = '30000000-0000-0000-0000-000000000002') = 'in_cellar', 'Annas flaska orörd';
  set role authenticated;
  begin
    insert into bottles (user_id, vintage_id, acquisition_type)
      values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001', 'purchase');
    raise exception 'borde nekas: flaska åt annan användare';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
\echo 'Alla databastester passerade'
