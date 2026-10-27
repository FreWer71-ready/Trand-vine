-- Trand-vine: grundschema.
-- Vinregistret (wines, vintages, wine_barcodes) är gemensamt och växer när
-- användare bekräftar nya streckkoder. Flaskor och betyg ägs av användaren.

create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- unaccent() är inte IMMUTABLE och kan därför inte användas direkt i index.
create or replace function public.immutable_unaccent(text)
returns text language sql immutable parallel safe strict
as $$ select public.unaccent('public.unaccent'::regdictionary, $1) $$;

create type wine_color as enum ('red', 'white', 'rose', 'sparkling', 'dessert', 'fortified');
create type acquisition_type as enum ('purchase', 'gift', 'tasting', 'inheritance', 'trade', 'other');
create type bottle_status as enum ('in_cellar', 'consumed', 'given_away', 'broken');

-- Profil ----------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 50),
  locale text not null default 'en' check (locale in ('sv', 'en')),
  created_at timestamptz not null default now()
);

-- Skapa profil automatiskt vid registrering. Visningsnamn tas från
-- inloggningsleverantören eller e-postens första del.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    left(coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1),
      'Vinvän'
    ), 50)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Vinregister -----------------------------------------------------------------

create table wines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  producer text,
  country text,
  region text,
  appellation text,
  color wine_color,
  grapes text[] not null default '{}',
  abv numeric(4, 1) check (abv between 0 and 30),
  image_url text,
  lwin text unique,
  xwines_id text unique,
  source text not null default 'user', -- user | lwin | xwines | openfoodfacts | upcitemdb
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  search_text text generated always as (
    lower(public.immutable_unaccent(coalesce(producer, '') || ' ' || name || ' ' || coalesce(region, '')))
  ) stored
);

create index wines_search_trgm on wines using gin (search_text gin_trgm_ops);

create table vintages (
  id uuid primary key default gen_random_uuid(),
  wine_id uuid not null references wines (id) on delete cascade,
  year smallint check (year between 1800 and 2200), -- null = icke-årgångsvin
  -- Startbetyg från importerade dataset (X-Wines), 1–5.
  seed_avg_rating numeric(3, 2),
  seed_rating_count integer not null default 0,
  -- Medelbetyg som visas: startbetyg + appens användare. Underhålls av trigger.
  avg_rating numeric(3, 2),
  rating_count integer not null default 0
);

create unique index vintages_wine_year on vintages (wine_id, coalesce(year, 0));

create table wine_barcodes (
  ean text primary key check (ean ~ '^\d{8,14}$'),
  wine_id uuid not null references wines (id) on delete cascade,
  bottle_size_ml integer check (bottle_size_ml > 0),
  source text not null,
  confirmed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index wine_barcodes_wine on wine_barcodes (wine_id);

-- Flaskor ---------------------------------------------------------------------

create table bottles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vintage_id uuid not null references vintages (id),
  size_ml integer not null default 750 check (size_ml > 0),
  acquisition_type acquisition_type not null,
  acquired_at date,
  price numeric(10, 2) check (price >= 0),
  currency char(3),
  store text,
  gift_from text,
  occasion_note text,
  location text,
  status bottle_status not null default 'in_cellar',
  consumed_at date,
  consumed_with text,
  consumed_food text,
  rating smallint check (rating between 1 and 5),
  notes text,
  photo_path text,
  created_at timestamptz not null default now()
);

create index bottles_user on bottles (user_id, status);
create index bottles_vintage on bottles (vintage_id);

-- Community-betyg: ett betyg per användare och årgång (senaste gäller).
create table ratings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vintage_id uuid not null references vintages (id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (user_id, vintage_id)
);

create function public.refresh_vintage_rating() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  vid uuid := coalesce(new.vintage_id, old.vintage_id);
begin
  update vintages v set
    rating_count = v.seed_rating_count + agg.n,
    avg_rating = case
      when v.seed_rating_count + agg.n = 0 then null
      else round(
        (coalesce(v.seed_avg_rating, 0) * v.seed_rating_count + agg.total)
        / (v.seed_rating_count + agg.n), 2)
    end
  from (select count(*) as n, coalesce(sum(score), 0) as total
        from ratings where vintage_id = vid) agg
  where v.id = vid;
  return null;
end $$;

create trigger ratings_refresh
  after insert or update or delete on ratings
  for each row execute function public.refresh_vintage_rating();

-- När en flaska får ett betyg räknas det in i community-betyget.
create function public.bottle_rating_to_ratings() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.rating is not null and new.rating is distinct from old.rating then
    insert into ratings (user_id, vintage_id, score)
    values (new.user_id, new.vintage_id, new.rating)
    on conflict (user_id, vintage_id)
      do update set score = excluded.score, updated_at = now();
  end if;
  return new;
end $$;

create trigger bottles_rating
  after insert or update of rating on bottles
  for each row execute function public.bottle_rating_to_ratings();

-- Sökning (för etikett-OCR och manuell sökning) ------------------------------

create function public.search_wines(q text, max_results int default 20)
returns setof wines
language sql stable
as $$
  select w.*
  from wines w
  where w.search_text % lower(public.immutable_unaccent(q))
     or w.search_text ilike '%' || lower(public.immutable_unaccent(q)) || '%'
  order by similarity(w.search_text, lower(public.immutable_unaccent(q))) desc
  limit least(max_results, 50)
$$;

-- Historik: alla mina flaskor av samma vin, alla årgångar.
create function public.my_wine_history(target_wine uuid)
returns table (
  bottle_id uuid, year smallint, status bottle_status, acquisition_type acquisition_type,
  acquired_at date, gift_from text, consumed_at date, consumed_with text,
  consumed_food text, rating smallint, notes text
)
language sql stable
as $$
  select b.id, v.year, b.status, b.acquisition_type, b.acquired_at, b.gift_from,
         b.consumed_at, b.consumed_with, b.consumed_food, b.rating, b.notes
  from bottles b
  join vintages v on v.id = b.vintage_id
  where v.wine_id = target_wine and b.user_id = auth.uid()
  order by coalesce(b.consumed_at, b.acquired_at, b.created_at::date) desc
$$;

-- Behörigheter (RLS) ----------------------------------------------------------

alter table profiles enable row level security;
alter table wines enable row level security;
alter table vintages enable row level security;
alter table wine_barcodes enable row level security;
alter table bottles enable row level security;
alter table ratings enable row level security;

create policy "own profile" on profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Vinregistret: alla inloggade läser och får lägga till. Ändringar och
-- borttag görs endast av servern (service role), så registret inte förstörs.
create policy "read wines" on wines for select to authenticated using (true);
create policy "add wines" on wines for insert to authenticated
  with check (created_by = auth.uid() and source = 'user');

create policy "read vintages" on vintages for select to authenticated using (true);
create policy "add vintages" on vintages for insert to authenticated
  with check (seed_rating_count = 0 and seed_avg_rating is null and rating_count = 0 and avg_rating is null);

create policy "read barcodes" on wine_barcodes for select to authenticated using (true);
create policy "add barcodes" on wine_barcodes for insert to authenticated
  with check (confirmed_by = auth.uid());

create policy "own bottles" on bottles
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Enskilda betyg är privata; alla ser bara medelvärdet i vintages.
create policy "own ratings" on ratings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Flaskfoton -----------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('bottle-photos', 'bottle-photos', false)
  on conflict do nothing;

-- Sökväg: <user_id>/<filnamn>
create policy "own bottle photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'bottle-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'bottle-photos' and (storage.foldername(name))[1] = auth.uid()::text);
