-- Consent records and logo rights. Decision 0025; the Platform and Store Guide, pages 10 and 14.
--
-- 1. Marketing email needs consent first (Australia's Spam Act 2003; the UK's PECR). Each choice a
--    person makes is one row in public.consent_events, which is only ever added to. The person's
--    choice is the latest row; no row means no. Nothing in this migration sends email.
-- 2. Artwork that goes on a garment needs the uploader to confirm they own it or may use it.
--    The confirmation is kept on the file's own row.
--
-- The words a person agreed to are kept with every record. They come from
-- private.consent_wordings, never from the caller, so a record cannot claim words nobody saw.
-- lib/consent/wording.ts holds the same rows, and a test checks they match.

create table private.consent_wordings (
  version text primary key check (version ~ '^[a-z0-9-]{1,64}$'),
  purpose text not null check (purpose in ('marketing_email', 'logo_rights')),
  -- 'opt-in' words may be answered yes or no. 'withdrawal' words can only record a no.
  kind text not null check (kind in ('opt-in', 'withdrawal', 'confirmation')),
  wording text not null check (length(wording) between 1 and 500),
  created_at timestamptz not null default now()
);

comment on table private.consent_wordings is
  'The exact words shown for each consent or confirmation, by version. Never edit a version once shown: add a new one.';

insert into private.consent_wordings (version, purpose, kind, wording) values
  ('marketing-email-v1', 'marketing_email', 'opt-in',
   'Email me about new templates, season deadlines and offers. You can stop at any time.'),
  ('marketing-email-unsubscribe-v1', 'marketing_email', 'withdrawal',
   'Stop emails from Knitwright about new templates, season deadlines and offers.'),
  ('logo-rights-v1', 'logo_rights', 'confirmation',
   'I own this logo or have permission to use it on garments.');

revoke all on private.consent_wordings from public, anon, authenticated;

-- Wordings may be added but never changed or removed, so old records keep their meaning.
create function private.refuse_wording_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'A consent wording can never be changed or removed. Add a new version.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

create trigger consent_wordings_are_append_only
  before update or delete on private.consent_wordings
  for each row execute function private.refuse_wording_change();

create trigger consent_wordings_are_not_truncated
  before truncate on private.consent_wordings
  for each statement execute function private.refuse_wording_change();

revoke all on function private.refuse_wording_change() from public, anon, authenticated;

-- One row for each choice a person made about a kind of email.
create table public.consent_events (
  id uuid primary key default gen_random_uuid(),
  -- Removed with the account: once the person is gone there is no one to email.
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null check (purpose in ('marketing_email')),
  granted boolean not null,
  wording text not null,
  wording_version text not null references private.consent_wordings (version),
  source text not null check (source in ('sign-up', 'settings', 'unsubscribe')),
  created_at timestamptz not null default clock_timestamp(),
  -- An unsubscribe link can only say no.
  check (source <> 'unsubscribe' or not granted)
);

comment on table public.consent_events is
  'Consent to marketing email, one row per choice. Append-only: see private.refuse_consent_change. The latest row is the choice; no row means no.';

create index consent_events_user_idx on public.consent_events (user_id, purpose, created_at desc);

-- A person may read their own choices and nothing else. Nobody writes but the server, through
-- record_consent below, and the sign-up trigger.
revoke all on public.consent_events from public, anon, authenticated, service_role;
grant select on public.consent_events to authenticated, service_role;

alter table public.consent_events enable row level security;

create policy "people read their own consent records"
  on public.consent_events for select to authenticated
  using (user_id = (select auth.uid()));

-- There are no insert, update or delete policies, on purpose.

-- A second lock, as on the history of a design. The one thing it lets through is the delete
-- that follows from deleting the account: by then the user row is already gone.
create function private.refuse_consent_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and not exists (select 1 from auth.users u where u.id = old.user_id) then
    return old;
  end if;
  raise exception 'A consent record can never be changed or removed.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

create trigger consent_events_are_append_only
  before update or delete on public.consent_events
  for each row execute function private.refuse_consent_change();

create trigger consent_events_are_not_truncated
  before truncate on public.consent_events
  for each statement execute function private.refuse_consent_change();

revoke all on function private.refuse_consent_change() from public, anon, authenticated;

-- Records one choice. The server has already identified the person: from their session for
-- Settings and sign-up, from a signed link for an unsubscribe. The words are taken from the
-- wording table by version. A sign-up choice is recorded only for someone never asked before,
-- so signing up again with an existing address changes nothing. Answers whether a row was
-- written. A person who no longer exists gets no row and no error: there is no one to email.
create function public.record_consent(
  p_user_id uuid,
  p_purpose text,
  p_granted boolean,
  p_wording_version text,
  p_source text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wording private.consent_wordings%rowtype;
begin
  if p_user_id is null or p_granted is null then
    raise exception 'record_consent: a person and an answer are required' using errcode = '22023';
  end if;

  select * into v_wording from private.consent_wordings w
  where w.version = p_wording_version and w.purpose = p_purpose and w.kind in ('opt-in', 'withdrawal');
  if not found then
    raise exception 'record_consent: unknown wording for this purpose' using errcode = '22023';
  end if;
  if v_wording.kind = 'withdrawal' and p_granted then
    raise exception 'record_consent: these words can only record a no' using errcode = '22023';
  end if;

  -- One choice at a time for each person, so "only if never asked" holds under a double click.
  perform pg_advisory_xact_lock(hashtextextended('consent:' || p_user_id::text, 0));

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    return false;
  end if;

  if p_source = 'sign-up' and exists (
    select 1 from public.consent_events e where e.user_id = p_user_id and e.purpose = p_purpose
  ) then
    return false;
  end if;

  insert into public.consent_events (user_id, purpose, granted, wording, wording_version, source)
  values (p_user_id, p_purpose, p_granted, v_wording.wording, v_wording.version, p_source);
  return true;
end;
$$;

revoke all on function public.record_consent(uuid, text, boolean, text, text)
  from public, anon, authenticated;
grant execute on function public.record_consent(uuid, text, boolean, text, text) to service_role;

-- The email sign-up path. The form's choice travels in the new account's profile
-- (raw_user_meta_data -> 'marketing_email' = {"granted": bool, "version": text}), because the
-- account does not exist until the sign-in service makes it. This records it at that moment.
-- Anyone can call the sign-in service directly and put anything there, so the words are still
-- taken from the wording table, and only for the person's own new account. Anything malformed
-- is ignored: a bad choice must never stop an account being made, and ignoring it means no.
-- Later reads must use consent_events, never the profile.
create function private.record_signup_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_choice jsonb := new.raw_user_meta_data -> 'marketing_email';
  v_wording private.consent_wordings%rowtype;
begin
  if v_choice is null or jsonb_typeof(v_choice) <> 'object'
     or jsonb_typeof(v_choice -> 'granted') <> 'boolean'
     or jsonb_typeof(v_choice -> 'version') <> 'string' then
    return new;
  end if;

  select * into v_wording from private.consent_wordings w
  where w.version = v_choice ->> 'version' and w.purpose = 'marketing_email' and w.kind = 'opt-in';
  if not found then
    return new;
  end if;

  insert into public.consent_events (user_id, purpose, granted, wording, wording_version, source)
  values (new.id, 'marketing_email', (v_choice ->> 'granted')::boolean, v_wording.wording, v_wording.version, 'sign-up');
  return new;
end;
$$;

create trigger record_signup_consent
  after insert on auth.users
  for each row execute function private.record_signup_consent();

revoke all on function private.record_signup_consent() from public, anon, authenticated;

-- Logo rights, kept on the file's row. Only artwork carries them; the upload route refuses
-- artwork without them. Rows stored before this change have none.
alter table public.files
  add column rights_confirmed_by uuid references auth.users (id) on delete set null,
  add column rights_confirmed_at timestamptz,
  add column rights_wording_version text references private.consent_wordings (version),
  add constraint files_rights_together
    check ((rights_confirmed_at is null) = (rights_wording_version is null)),
  add constraint files_rights_only_on_artwork
    check (rights_confirmed_at is null or kind = 'artwork'),
  add constraint files_rights_wording_is_logo_rights
    check (rights_wording_version is null or rights_wording_version like 'logo-rights-%');

comment on column public.files.rights_confirmed_at is
  'When the uploader confirmed they own this artwork or may use it on garments. Artwork only.';
