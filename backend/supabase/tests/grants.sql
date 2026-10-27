-- Det Supabase ger rollerna som standard och som migrationen inte själv sätter.
-- Tabellrättigheter kommer från migrationen, så testerna visar att de räcker.
grant usage on schema auth, storage, extensions to authenticated, service_role;
grant execute on all functions in schema auth to authenticated, service_role;
grant all on all tables in schema storage to authenticated, service_role;
grant all on all tables in schema public to service_role;
