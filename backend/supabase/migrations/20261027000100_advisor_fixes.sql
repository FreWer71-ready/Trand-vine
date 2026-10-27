-- Rättningar efter Supabase-kontrollerna (security/performance advisors).

-- Fast search_path på funktioner.
alter function public.immutable_unaccent(text) set search_path = extensions, public;
alter function public.my_wine_history(uuid) set search_path = public;

-- auth.uid() utvärderas en gång per fråga i stället för per rad.
drop policy "own profile" on profiles;
create policy "own profile" on profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy "add wines" on wines;
create policy "add wines" on wines for insert to authenticated
  with check (created_by = (select auth.uid()) and source = 'user');

drop policy "add barcodes" on wine_barcodes;
create policy "add barcodes" on wine_barcodes for insert to authenticated
  with check (confirmed_by = (select auth.uid()));

drop policy "own bottles" on bottles;
create policy "own bottles" on bottles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy "own ratings" on ratings;
create policy "own ratings" on ratings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy "own bottle photos" on storage.objects;
create policy "own bottle photos" on storage.objects for all to authenticated
  using (bucket_id = 'bottle-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'bottle-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Index för främmande nycklar.
create index ratings_vintage on ratings (vintage_id);
create index wine_barcodes_confirmed_by on wine_barcodes (confirmed_by);
create index wines_created_by on wines (created_by);
