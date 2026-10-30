-- Inbjudningskod och admin (som festkoden och adminsidan i Fredrik55).
--
-- Appen kräver en inbjudningskod från admin innan man kan lägga till flaskor.
-- Koden löses in en gång per konto (profiles.approved_at). Admin hanterar
-- koder och användare i appen under /admin. Admin är de e-postadresser som
-- står i private.admin_emails och som loggat in med e-postkod.

create table private.admin_emails (
  email text primary key check (email = lower(email))
);

create table private.invite_codes (
  code text primary key check (code ~ '^[A-Z0-9-]{4,32}$'),
  note text,
  max_uses integer check (max_uses > 0),       -- null = obegränsat
  uses integer not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Spärr mot gissning: misslyckade försök per användare.
create table private.invite_attempts (
  user_id uuid not null,
  created_at timestamptz not null default now()
);
create index invite_attempts_user on private.invite_attempts (user_id, created_at);

alter table public.profiles
  add column approved_at timestamptz,
  add column invite_code text;

-- Användare får bara ändra namn och språk själva, inte sin behörighet.
revoke update on public.profiles from authenticated;
grant update (display_name, locale) on public.profiles to authenticated;

-- De som redan använder appen behåller sin källare.
update public.profiles set approved_at = now(), invite_code = 'FORE-KOD' where approved_at is null;

create function public.is_admin() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u join private.admin_emails a on a.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
  )
$$;

create function public.is_approved() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select approved_at is not null from public.profiles where id = auth.uid()), false)
      or public.is_admin()
$$;

-- Ingen ny flaska, vin, årgång, streckkod eller betyg utan godkänd kod.
-- Restriktiva policyer läggs ovanpå de befintliga (alla måste vara uppfyllda).
create policy "approved bottles" on public.bottles as restrictive for insert to authenticated
  with check ((select public.is_approved()));
create policy "approved bottle updates" on public.bottles as restrictive for update to authenticated
  using ((select public.is_approved()));
create policy "approved wines" on public.wines as restrictive for insert to authenticated
  with check ((select public.is_approved()));
create policy "approved vintages" on public.vintages as restrictive for insert to authenticated
  with check ((select public.is_approved()));
create policy "approved barcodes" on public.wine_barcodes as restrictive for insert to authenticated
  with check ((select public.is_approved()));
create policy "approved ratings" on public.ratings as restrictive for insert to authenticated
  with check ((select public.is_approved()));

-- Lös in en kod: 'ok' | 'invalid' | 'used_up' | 'expired' | 'too_many_attempts'.
create function public.redeem_invite(input text) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  c private.invite_codes;
  normalized text := upper(regexp_replace(coalesce(input, ''), '\s', '', 'g'));
begin
  if auth.uid() is null then return 'invalid'; end if;
  if (select approved_at is not null from public.profiles where id = auth.uid()) then return 'ok'; end if;
  if (select count(*) from private.invite_attempts
      where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
    return 'too_many_attempts';
  end if;

  select * into c from private.invite_codes where code = normalized for update;
  if not found or not c.active then
    insert into private.invite_attempts (user_id) values (auth.uid());
    return 'invalid';
  end if;
  if c.expires_at is not null and c.expires_at < now() then return 'expired'; end if;
  if c.max_uses is not null and c.uses >= c.max_uses then return 'used_up'; end if;

  update private.invite_codes set uses = uses + 1 where code = c.code;
  update public.profiles set approved_at = now(), invite_code = c.code where id = auth.uid();
  return 'ok';
end $$;

-- Flytta flaskor från ett anonymt konto när man loggar in på ett befintligt.
-- Den anonyma enheten skapar en biljett före inloggningen och löser in den efteråt.
create table private.transfer_tickets (
  ticket text primary key,
  from_user uuid not null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create function public.create_transfer_ticket() returns text
language plpgsql security definer
set search_path = ''
as $$
declare t text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if auth.uid() is null then return null; end if;
  insert into private.transfer_tickets (ticket, from_user) values (t, auth.uid());
  return t;
end $$;

create function public.claim_transfer(input text) returns integer
language plpgsql security definer
set search_path = ''
as $$
declare src uuid; n integer;
begin
  update private.transfer_tickets set used_at = now()
  where ticket = input and used_at is null and created_at > now() - interval '1 hour'
  returning from_user into src;
  if src is null or src = auth.uid() then return 0; end if;
  update public.bottles set user_id = auth.uid() where user_id = src;
  get diagnostics n = row_count;
  -- Betyg: behåll det nya kontots betyg om båda har betygsatt samma årgång.
  insert into public.ratings (user_id, vintage_id, score)
  select auth.uid(), vintage_id, score from public.ratings where user_id = src
  on conflict (user_id, vintage_id) do nothing;
  -- Den som löst in en kod som anonym behåller godkännandet.
  update public.profiles p set approved_at = coalesce(p.approved_at, s.approved_at), invite_code = coalesce(p.invite_code, s.invite_code)
  from public.profiles s where s.id = src and p.id = auth.uid();
  return n;
end $$;

-- Admin ---------------------------------------------------------------------

create function public.admin_overview() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'stats', jsonb_build_object(
      'users', (select count(*) from public.profiles),
      'approved', (select count(*) from public.profiles where approved_at is not null),
      'bottles', (select coalesce(sum(quantity), 0) from public.bottles where status = 'in_cellar'),
      'wines', (select count(*) from public.wines)),
    'codes', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from private.invite_codes c), '[]'::jsonb),
    'users', coalesce((select jsonb_agg(u order by u->>'created_at' desc) from (
      select jsonb_build_object(
        'id', p.id, 'name', p.display_name, 'email', au.email, 'anonymous', coalesce(au.is_anonymous, false),
        'approved_at', p.approved_at, 'invite_code', p.invite_code, 'created_at', p.created_at,
        'last_sign_in_at', au.last_sign_in_at,
        'bottles', (select coalesce(sum(b.quantity), 0) from public.bottles b where b.user_id = p.id and b.status = 'in_cellar')
      ) as u
      from public.profiles p join auth.users au on au.id = p.id
      order by p.created_at desc limit 500) x), '[]'::jsonb));
end $$;

-- Skapa kod; utan angiven kod slumpas en, t.ex. VIN-7K3Q9P.
create function public.admin_create_code(new_code text default null, note text default null,
                                         max_uses integer default null, expires_at timestamptz default null)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare c text := upper(regexp_replace(coalesce(new_code, ''), '\s', '', 'g'));
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if c = '' then
    c := 'VIN-' || upper(substr(translate(encode(extensions.gen_random_bytes(8), 'base64'), '+/=0O1IL', ''), 1, 6));
  end if;
  insert into private.invite_codes (code, note, max_uses, expires_at)
  values (c, nullif(trim(note), ''), max_uses, expires_at);
  return c;
end $$;

create function public.admin_set_code_active(target text, is_active boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  update private.invite_codes set active = is_active where code = target;
end $$;

-- Ge eller ta bort en användares tillgång. Källaren finns kvar men kan inte ändras.
create function public.admin_set_user_access(target uuid, has_access boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  update public.profiles
  set approved_at = case when has_access then coalesce(approved_at, now()) else null end,
      invite_code = case when has_access then coalesce(invite_code, 'ADMIN') else invite_code end
  where id = target;
end $$;

revoke execute on function public.is_admin(), public.is_approved(), public.redeem_invite(text),
  public.create_transfer_ticket(), public.claim_transfer(text), public.admin_overview(),
  public.admin_create_code(text, text, integer, timestamptz), public.admin_set_code_active(text, boolean),
  public.admin_set_user_access(uuid, boolean)
  from public, anon;
grant execute on function public.is_admin(), public.is_approved(), public.redeem_invite(text),
  public.create_transfer_ticket(), public.claim_transfer(text), public.admin_overview(),
  public.admin_create_code(text, text, integer, timestamptz), public.admin_set_code_active(text, boolean),
  public.admin_set_user_access(uuid, boolean)
  to authenticated;
