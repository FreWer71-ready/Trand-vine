-- Betyg med en decimal (t.ex. 3,5 eller 4,2) i stället för hela stjärnor.
-- Gamla heltalsbetyg behålls som de är (4 blir 4,0).

-- Triggern lyssnar på kolumnen och måste tas bort medan typen ändras.
drop trigger bottles_rating on public.bottles;

alter table public.bottles alter column rating type numeric(2, 1);
alter table public.ratings alter column score type numeric(2, 1);

create trigger bottles_rating
  after insert or update of rating on public.bottles
  for each row execute function public.bottle_rating_to_ratings();

-- Funktioner med betyget i signaturen byggs om med den nya typen.
drop function public.my_wine_history(uuid);
create function public.my_wine_history(target_wine uuid)
returns table (
  bottle_id uuid, year smallint, status public.bottle_status, acquisition_type public.acquisition_type,
  acquired_at date, gift_from text, consumed_at date, consumed_with text,
  consumed_food text, rating numeric, notes text
)
language sql stable
set search_path = ''
as $$
  select b.id, v.year, b.status, b.acquisition_type, b.acquired_at, b.gift_from,
         b.consumed_at, b.consumed_with, b.consumed_food, b.rating, b.notes
  from public.bottles b
  join public.vintages v on v.id = b.vintage_id
  where v.wine_id = target_wine and b.user_id = (select auth.uid())
  order by coalesce(b.consumed_at, b.acquired_at, b.created_at::date) desc
$$;
revoke execute on function public.my_wine_history(uuid) from public, anon;
grant execute on function public.my_wine_history(uuid) to authenticated;

drop function public.take_bottle(uuid, public.bottle_status, date, text, text, smallint, text);
create function public.take_bottle(
  target uuid,
  new_status public.bottle_status,
  on_date date,
  with_whom text default null,
  food text default null,
  score numeric default null,
  note text default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  b public.bottles;
  taken uuid;
begin
  if new_status = 'in_cellar' then
    raise exception 'new_status must be consumed or given_away' using errcode = '22023';
  end if;

  select * into b from public.bottles
  where id = target and status = 'in_cellar'
  for update;
  if not found then
    raise exception 'bottle not in cellar' using errcode = 'P0002';
  end if;

  if b.quantity = 1 then
    update public.bottles set
      status = new_status, consumed_at = on_date, consumed_with = with_whom,
      consumed_food = food, rating = score, notes = note
    where id = target;
    return target;
  end if;

  update public.bottles set quantity = quantity - 1 where id = target;
  insert into public.bottles (
    user_id, vintage_id, size_ml, acquisition_type, acquired_at, price, currency,
    store, gift_from, occasion_note, location, quantity,
    status, consumed_at, consumed_with, consumed_food, rating, notes
  ) values (
    b.user_id, b.vintage_id, b.size_ml, b.acquisition_type, b.acquired_at, b.price, b.currency,
    b.store, b.gift_from, b.occasion_note, b.location, 1,
    new_status, on_date, with_whom, food, score, note
  ) returning id into taken;
  return taken;
end $$;

revoke execute on function public.take_bottle(uuid, public.bottle_status, date, text, text, numeric, text) from public, anon;
grant execute on function public.take_bottle(uuid, public.bottle_status, date, text, text, numeric, text) to authenticated;

notify pgrst, 'reload schema';
