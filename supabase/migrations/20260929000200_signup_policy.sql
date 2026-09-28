-- The sign-up switch. Closed by default. Plan step 2, task 3.
--
-- Supabase Auth calls public.hook_before_user_created before it creates a user who
-- arrives through the public API: email and password, or Google. So the switch cannot
-- be skipped by calling Supabase directly from a browser. The admin API does not run
-- the hook, and it needs the secret key, which only the server holds.

create table private.signup_policy (
  -- A primary key that can only be true allows exactly one row.
  id boolean primary key default true check (id),
  open boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table private.signup_policy is
  'One row. When open is false only addresses in private.signup_allowlist may register.';

insert into private.signup_policy (id, open) values (true, false);

create table private.signup_allowlist (
  email text primary key check (email = lower(email) and length(email) between 3 and 320),
  note text not null check (length(note) between 1 and 200),
  created_at timestamptz not null default now()
);

comment on table private.signup_allowlist is
  'Addresses that may register while sign-up is closed. Stored in lower case.';

-- Supabase Auth runs the hook as supabase_auth_admin. It may read these two tables and
-- nothing else in this schema.
grant usage on schema private to supabase_auth_admin;
grant select on private.signup_policy, private.signup_allowlist to supabase_auth_admin;

create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_email text := lower(coalesce(event -> 'user' ->> 'email', ''));
  v_open boolean;
begin
  select p.open into v_open from private.signup_policy p;

  if coalesce(v_open, false) then
    return '{}'::jsonb;
  end if;

  if v_email <> '' and exists (
    select 1 from private.signup_allowlist a where a.email = v_email
  ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Sign-up is closed. Knitwright is not open to new accounts yet.'
    )
  );
end;
$$;

comment on function public.hook_before_user_created(jsonb) is
  'Auth hook. Refuses new users while sign-up is closed, unless the address is allowed.';

revoke all on function public.hook_before_user_created(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;

-- Whether the sign-up form should be shown. Safe for anyone to read.
create function public.signup_is_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.open from private.signup_policy p), false);
$$;

revoke all on function public.signup_is_open() from public;
grant execute on function public.signup_is_open() to anon, authenticated, service_role;

-- Opens or closes sign-up. Server only.
create function public.set_signup_open(p_open boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_open is null then
    raise exception 'set_signup_open: a value is required' using errcode = '22023';
  end if;

  update private.signup_policy set open = p_open, updated_at = now() where id;
  return p_open;
end;
$$;

revoke all on function public.set_signup_open(boolean) from public, anon, authenticated;
grant execute on function public.set_signup_open(boolean) to service_role;

-- Lets one address register while sign-up is closed. Server only.
create function public.allow_signup_email(p_email text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.signup_allowlist (email, note)
  values (lower(trim(p_email)), p_note)
  on conflict (email) do update set note = excluded.note;
end;
$$;

revoke all on function public.allow_signup_email(text, text) from public, anon, authenticated;
grant execute on function public.allow_signup_email(text, text) to service_role;
