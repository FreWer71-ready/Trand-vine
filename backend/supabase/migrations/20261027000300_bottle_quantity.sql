-- Flera likadana flaskor registreras som en post med antal.

alter table public.bottles
  add column quantity integer not null default 1 check (quantity > 0);

-- Tar en flaska ur en post: drucken eller bortgiven. Finns det fler kvar
-- minskas antalet och flaskan som tas ut blir en egen rad i historiken, med
-- samma anskaffningsuppgifter. Returnerar id för den uttagna flaskan.
-- Körs med anroparens rättigheter, så RLS gäller som vanligt.
create function public.take_bottle(
  target uuid,
  new_status public.bottle_status,
  on_date date,
  with_whom text default null,
  food text default null,
  score smallint default null,
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

revoke execute on function public.take_bottle from public, anon;
grant execute on function public.take_bottle to authenticated;
