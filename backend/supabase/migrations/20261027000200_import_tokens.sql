-- Engångsnycklar för Supabase-funktionen import-xwines. Schemat private är
-- inte exponerat via API:t; bara databasens ägare kan skapa nycklar.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.import_tokens (
  token text primary key default encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);

-- pg_net låter databasen starta import-xwines (net.http_post). Saknas
-- tillägget, t.ex. i lokala tester, hoppas det över.
do $$ begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net finns inte här: %', sqlerrm;
end $$;
