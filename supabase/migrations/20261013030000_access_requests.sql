-- Requests for access while sign-up is by invitation only. The landing page's "Get started" leads
-- to the sign-up page, which says sign-up is invite-only for now and offers this form.
--
-- Anyone may ask, with no account. No browser writes to the table: the server checks the bot check
-- and its rate limit, then keeps the request through request_access, which only the server's own
-- key may run. One request is kept per email address: asking again keeps the first and returns
-- its id, so the answer cannot tell anyone whether an address has asked before. Only platform
-- admins (decision 0024) read the requests, on the leads page.

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null unique
    check (length(email) between 3 and 320 and email = lower(btrim(email)) and position('@' in email) > 1),
  name text not null check (length(name) between 1 and 80 and name = btrim(name)),
  organisation text not null default '' check (length(organisation) <= 80 and organisation = btrim(organisation)),
  organisation_type text check (organisation_type in ('club', 'school', 'brand', 'gym', 'event')),
  message text not null default '' check (length(message) <= 1000),
  created_at timestamptz not null default now()
);

comment on table public.access_requests is
  'Requests for access while sign-up is by invitation. Written by the server only; read by platform admins.';

create index access_requests_created_idx on public.access_requests (created_at desc);

revoke all on public.access_requests from public, anon, authenticated, service_role;
grant select on public.access_requests to authenticated, service_role;
alter table public.access_requests enable row level security;

create policy "platform admins read access requests"
  on public.access_requests for select to authenticated
  using (private.is_platform_admin());

-- There are no insert, update or delete policies, on purpose.

-- Keeps one request. The app has checked every field already; the checks here are the last line.
create function public.request_access(
  p_email text,
  p_name text,
  p_organisation text,
  p_organisation_type text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := btrim(coalesce(p_name, ''));
  v_organisation text := btrim(coalesce(p_organisation, ''));
  v_type text := nullif(btrim(coalesce(p_organisation_type, '')), '');
  v_message text := btrim(coalesce(p_message, ''));
  v_id uuid;
begin
  if length(v_email) < 3 or length(v_email) > 320 or position('@' in v_email) < 2 then
    raise exception 'Enter an email address.' using errcode = '22023';
  end if;
  if length(v_name) < 1 or length(v_name) > 80 then
    raise exception 'A name has 1 to 80 characters.' using errcode = '22023';
  end if;
  if length(v_organisation) > 80 then
    raise exception 'An organisation name has at most 80 characters.' using errcode = '22023';
  end if;
  if v_type is not null and v_type not in ('club', 'school', 'brand', 'gym', 'event') then
    raise exception 'That is not a type of organisation.' using errcode = '22023';
  end if;
  if length(v_message) > 1000 then
    raise exception 'A message has at most 1000 characters.' using errcode = '22023';
  end if;

  insert into public.access_requests (email, name, organisation, organisation_type, message)
  values (v_email, v_name, v_organisation, v_type, v_message)
  on conflict (email) do nothing
  returning id into v_id;

  if v_id is null then
    select r.id into v_id from public.access_requests r where r.email = v_email;
  end if;
  return v_id;
end;
$$;

-- Only the server's own key may run it. A browser, signed in or not, is refused.
revoke all on function public.request_access(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.request_access(text, text, text, text, text) to service_role;
