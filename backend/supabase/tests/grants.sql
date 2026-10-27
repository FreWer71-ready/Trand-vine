-- Supabase ger rollerna dessa rättigheter som standard.
grant usage on schema public, auth, storage to authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant all on all tables in schema storage to authenticated, service_role;
grant execute on all functions in schema public, auth, storage to authenticated, service_role;
