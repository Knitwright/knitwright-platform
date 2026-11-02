-- Committee links and roster sign-up (spec F-T3 and F-T4, plan v5 Z7, decision 0087).
--
-- Two kinds of public link, both built on the share-link idiom of decision 0026, which this file
-- reuses rather than repeats: the token is 256 random bits, never stored, and looked up through
-- `private.share_token_hash`; an unknown, expired or revoked token takes one path and gives one
-- answer, nothing; a visitor is known only by the hash of the link and the random key in their
-- cookie; every write goes through a function only the server's own key may run.
--
--   * A committee link shows up to three saved versions of one design, read only, and takes pin
--     comments on a point of a panel, an A/B/C vote and an approval given under a name. The kit
--     manager then locks the approved version, which moves that version to status `approved`
--     through `public.set_design_status` (plan v5 X4). An approval is a record, not a flag: who,
--     under what name, at what time, against which version, and it can never be changed or removed.
--   * A roster sign-up link belongs to one season of one club. A player gives a name for the shirt,
--     a number and a size. The manager pastes the list of people they are waiting on, sees who has
--     answered and who has not, and chases the rest.
--
-- Nothing a token opens reaches past what its link is for. A committee token opens its design's
-- shared versions and nothing else; a sign-up token opens the season's name and the sport's number
-- range and never another player's answer, never the roster, never the club's designs.
-- `tests/integration/committee-signup.test.ts` proves each of those.
--
-- Every limit and range here is a row, not a literal: the link windows, the number range per sport,
-- the name length per zone and the chase wording. Each carries the rule that explains it, or
-- `R-GAP-000` where the rulebook has no entry yet (decision 0067).

-- ---------------------------------------------------------------------------------------------
-- The data behind the rules
-- ---------------------------------------------------------------------------------------------

-- How long a public link lasts, per kind. F-T3 says a committee link expires after 30 days; the
-- sign-up window is the same number until the owner says otherwise.
create table public.public_link_windows (
  kind text primary key check (kind in ('committee', 'roster_signup')),
  days integer not null check (days between 1 and 365),
  rule_id text not null check (rule_id ~ '^R-[A-Z]+-[0-9]{3}$'),
  -- Says plainly where the number came from, so nobody reads a placeholder as a decision.
  note text not null check (length(note) between 1 and 200)
);

comment on table public.public_link_windows is
  'How many days a committee link or a roster sign-up link lasts. Data, not a constant in code.';

insert into public.public_link_windows (kind, days, rule_id, note) values
  ('committee', 30, 'R-GAP-000', 'From the build pack F-T3 ("links expire after 30 days"); no rulebook entry yet'),
  ('roster_signup', 30, 'R-GAP-000', 'Knitwright default, matched to the committee link; not reviewed by the owner');

-- The numbers a sport allows. F-T4: 0 to 99 by default, configurable per sport.
create table public.sport_number_rules (
  sport text primary key check (sport ~ '^[a-z][a-z0-9-]{1,30}$'),
  label text not null check (length(label) between 1 and 40),
  lowest integer not null check (lowest >= 0),
  highest integer not null check (highest <= 999),
  -- Whether a leading zero is kept, as "07" rather than "7". Some codes print one.
  leading_zero_allowed boolean not null default true,
  rule_id text not null check (rule_id ~ '^R-[A-Z]+-[0-9]{3}$'),
  note text not null check (length(note) between 1 and 200),
  check (lowest <= highest)
);

comment on table public.sport_number_rules is
  'The shirt numbers each sport allows. Every row is a labelled Knitwright default until a league rule is on file.';

insert into public.sport_number_rules (sport, label, lowest, highest, rule_id, note) values
  ('default', 'Any sport', 0, 99, 'R-GAP-000', 'From the build pack F-T4 ("numbers are 0-99 by default"); no rulebook entry yet'),
  ('football', 'Football', 1, 99, 'R-GAP-000', 'Knitwright default, not checked against any league rule book'),
  ('rugby', 'Rugby', 1, 99, 'R-GAP-000', 'Knitwright default, not checked against any league rule book'),
  ('netball', 'Netball', 0, 99, 'R-GAP-000', 'Knitwright default, not checked against any league rule book'),
  ('hockey', 'Hockey', 0, 99, 'R-GAP-000', 'Knitwright default, not checked against any league rule book'),
  ('basketball', 'Basketball', 0, 99, 'R-GAP-000', 'Knitwright default, not checked against any league rule book');

-- How long a name or a number may be in each place it is printed. The zones are the places
-- lib/garment/names-numbers.ts names.
create table public.shirt_zone_limits (
  zone text primary key check (zone in ('back-name', 'back-number', 'front-number', 'leg-number')),
  label text not null check (length(label) between 1 and 60),
  max_characters integer not null check (max_characters between 1 and 40),
  rule_id text not null check (rule_id ~ '^R-[A-Z]+-[0-9]{3}$'),
  note text not null check (length(note) between 1 and 200)
);

comment on table public.shirt_zone_limits is
  'The longest name or number each printed zone takes. back-name quotes R-PER-001; the rest have no rulebook entry yet.';

insert into public.shirt_zone_limits (zone, label, max_characters, rule_id, note) values
  ('back-name', 'Name across the upper back', 12, 'R-PER-001', 'R-PER-001 for JSY-SS-01: "60 mm cap height, top 70 mm below the back neck, max 12 characters"'),
  ('back-number', 'Number on the back', 2, 'R-GAP-000', 'Two digits, from the 0-99 range of F-T4; R-PER-002 gives the height, not the length'),
  ('front-number', 'Number on the front', 2, 'R-GAP-000', 'Two digits, from the 0-99 range of F-T4; R-PER-003 gives the height, not the length'),
  ('leg-number', 'Number on the leg', 2, 'R-GAP-000', 'Two digits, from the 0-99 range of F-T4; no rulebook entry names this zone');

-- The words a manager sends when they chase a player. Data, so the wording can change without a
-- deploy, and so the same words go out by WhatsApp and by email.
create table public.chase_templates (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{1,40}$'),
  channel text not null check (channel in ('whatsapp', 'email')),
  -- Empty for WhatsApp, which has no subject.
  subject text not null check (length(subject) <= 120),
  body text not null check (length(body) between 1 and 1000),
  note text not null check (length(note) between 1 and 200)
);

comment on table public.chase_templates is
  'What a manager sends to a player who has not answered. {player}, {club}, {season} and {link} are filled in.';

insert into public.chase_templates (id, channel, subject, body, note) values
  ('first-ask-whatsapp', 'whatsapp', '',
   'Hi {player}, {club} needs your shirt name, number and size for {season}. It takes a minute: {link}',
   'Knitwright default wording, not reviewed by the owner'),
  ('first-ask-email', 'email', '{club}: your kit details for {season}',
   'Hi {player},' || chr(10) || chr(10) || '{club} needs your shirt name, number and size for {season}.' || chr(10) || chr(10) || 'Open this link and fill it in:' || chr(10) || '{link}' || chr(10) || chr(10) || 'The link works until it runs out or is withdrawn. Reply to this message if anything is wrong.',
   'Knitwright default wording, not reviewed by the owner');

-- Nobody writes these from a browser, and only the server's own key reads them: the pages they
-- feed are drawn on the server.
revoke all on public.public_link_windows, public.sport_number_rules, public.shirt_zone_limits, public.chase_templates
  from public, anon, authenticated, service_role;
grant select on public.public_link_windows, public.sport_number_rules, public.shirt_zone_limits, public.chase_templates
  to service_role;

alter table public.public_link_windows enable row level security;
alter table public.sport_number_rules enable row level security;
alter table public.shirt_zone_limits enable row level security;
alter table public.chase_templates enable row level security;

-- No policy on any of the four, on purpose: no browser role reaches them at all.

-- How long a link of this kind lasts, in days. Raises rather than guessing when the row is missing.
create function private.public_link_days(p_kind text)
returns integer
language plpgsql
stable
set search_path = ''
as $$
declare
  v_days integer;
begin
  select w.days into v_days from public.public_link_windows w where w.kind = p_kind;
  if v_days is null then
    raise exception 'No link window is set for %.', p_kind using errcode = '22023';
  end if;
  return v_days;
end;
$$;

revoke all on function private.public_link_days(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Committee links (F-T3)
-- ---------------------------------------------------------------------------------------------

create table public.committee_links (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  project_id uuid not null,
  -- SHA-256 of the token, as a share link keeps it. The token itself is never stored.
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at),
  unique (id, brand_id),
  foreign key (project_id, brand_id) references public.projects (id, brand_id) on delete cascade
);

comment on table public.committee_links is
  'A link that shows up to three versions of one design to a committee with no account. Token hashes only. Written by the server only.';

create index committee_links_project_idx on public.committee_links (project_id, created_at desc);
create index committee_links_brand_idx on public.committee_links (brand_id);

-- The versions a link shows, as the slots the committee votes between.
create table public.committee_link_versions (
  link_id uuid not null,
  brand_id uuid not null,
  slot text not null check (slot in ('A', 'B', 'C')),
  version integer not null check (version >= 1),
  primary key (link_id, slot),
  -- One version cannot fill two slots of the same link.
  unique (link_id, version),
  foreign key (link_id, brand_id) references public.committee_links (id, brand_id) on delete cascade
);

comment on table public.committee_link_versions is
  'Which saved version each A/B/C slot of a committee link shows. Written by the server only.';

create index committee_link_versions_brand_idx on public.committee_link_versions (brand_id);

-- A comment pinned to a point on a panel. The point is held the way a design comment holds one
-- (decision 0063): a panel id and a distance in millimetres across and down, so the same pin can
-- be drawn on a drawing of any size. Append only: nothing changes or removes a pin.
create table public.committee_pins (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null,
  brand_id uuid not null,
  visitor_hash bytea not null check (octet_length(visitor_hash) = 32),
  -- The version the pin was left against, so a pin never floats free of what was on screen.
  version integer not null check (version >= 1),
  name text not null check (length(name) between 1 and 60 and name = btrim(name)),
  panel_id text not null check (panel_id ~ '^[a-z][a-z0-9-]{0,63}$'),
  x_mm numeric(7, 1) not null check (x_mm >= 0 and x_mm <= 5000),
  y_mm numeric(7, 1) not null check (y_mm >= 0 and y_mm <= 5000),
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  foreign key (link_id, brand_id) references public.committee_links (id, brand_id) on delete cascade
);

comment on table public.committee_pins is
  'Comments a committee pinned to a point on a panel. Append only, written by the server only.';

create index committee_pins_link_idx on public.committee_pins (link_id, created_at desc);
create index committee_pins_brand_idx on public.committee_pins (brand_id);

-- One vote per browser per link, which that browser may change, exactly as a share answer may be
-- changed (decision 0026). The tally is a guide, not a ballot.
create table public.committee_votes (
  link_id uuid not null,
  brand_id uuid not null,
  visitor_hash bytea not null check (octet_length(visitor_hash) = 32),
  slot text not null check (slot in ('A', 'B', 'C')),
  name text not null check (length(name) between 1 and 60 and name = btrim(name)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (link_id, visitor_hash),
  foreign key (link_id, brand_id) references public.committee_links (id, brand_id) on delete cascade
);

comment on table public.committee_votes is
  'An A/B/C vote from one browser through one committee link. Written by the server only.';

create index committee_votes_brand_idx on public.committee_votes (brand_id);

-- An approval is a record, not a flag (plan v5 Z7): who approved, under what name, at what time,
-- against which version. A trigger below refuses every change and every removal.
create table public.committee_approvals (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null,
  brand_id uuid not null,
  project_id uuid not null,
  version integer not null check (version >= 1),
  name text not null check (length(name) between 1 and 60 and name = btrim(name)),
  -- Optional: F-T3 asks for a name and takes an email if one is offered.
  email text check (email is null or (length(email) between 3 and 254 and email = lower(btrim(email)))),
  visitor_hash bytea not null check (octet_length(visitor_hash) = 32),
  approved_at timestamptz not null default now(),
  -- One browser approves one version of one link once. A second press changes nothing.
  unique (link_id, visitor_hash, version),
  foreign key (link_id, brand_id) references public.committee_links (id, brand_id) on delete cascade
);

comment on table public.committee_approvals is
  'Who approved which version of a design, under what name and when. Immutable once written.';

create index committee_approvals_link_idx on public.committee_approvals (link_id, approved_at desc);
create index committee_approvals_brand_idx on public.committee_approvals (brand_id);

-- The kit manager's own record of locking a version. Append only, like the approval it points at.
create table public.committee_locks (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null,
  brand_id uuid not null,
  project_id uuid not null,
  version integer not null check (version >= 1),
  -- The approval the manager acted on, when there was one. Null for a version the manager locked
  -- with no approval recorded against it, which the screen says plainly.
  approval_id uuid references public.committee_approvals (id) on delete set null,
  locked_by uuid references auth.users (id) on delete set null,
  locked_at timestamptz not null default now(),
  unique (project_id, version),
  foreign key (link_id, brand_id) references public.committee_links (id, brand_id) on delete cascade
);

comment on table public.committee_locks is
  'Each time a kit manager locked an approved version. Immutable once written.';

create index committee_locks_brand_idx on public.committee_locks (brand_id);

-- ---------------------------------------------------------------------------------------------
-- Roster sign-up (F-T4)
-- ---------------------------------------------------------------------------------------------

create table public.roster_signup_links (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  season_id uuid not null,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  -- Which sport's number range applies. Always a row of sport_number_rules.
  sport text not null references public.sport_number_rules (sport),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at),
  unique (id, brand_id),
  foreign key (season_id, brand_id) references public.club_seasons (id, brand_id) on delete cascade
);

comment on table public.roster_signup_links is
  'A link a player fills in with their shirt name, number and size. One per season. Token hashes only.';

create index roster_signup_links_season_idx on public.roster_signup_links (season_id, created_at desc);
create index roster_signup_links_brand_idx on public.roster_signup_links (brand_id);

-- The people a manager is waiting on: the pasted or imported list. Personal data, removed with the
-- season and with the club.
create table public.roster_signup_requests (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  season_id uuid not null,
  -- The person's name as the manager wrote it, which is how an answer is matched to them.
  name text not null check (length(name) between 1 and 40 and name = btrim(name) and name !~ '[[:cntrl:]]'),
  -- The same name folded for matching: lower case, single spaces. Written by the function.
  match_key text not null check (length(match_key) between 1 and 40),
  -- How to chase them, when the manager has it. Either may be empty.
  phone text not null default '' check (phone = '' or phone ~ '^\+?[0-9]{6,20}$'),
  email text not null default '' check (email = '' or (length(email) between 3 and 254 and email = lower(btrim(email)))),
  created_at timestamptz not null default now(),
  unique (season_id, match_key),
  foreign key (season_id, brand_id) references public.club_seasons (id, brand_id) on delete cascade
);

comment on table public.roster_signup_requests is
  'The players a club is waiting on for this season. Personal data; removed with the season.';

create index roster_signup_requests_brand_idx on public.roster_signup_requests (brand_id);

-- What a player sent. One answer per browser per link, which that browser may change.
create table public.roster_signup_entries (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null,
  brand_id uuid not null,
  season_id uuid not null,
  visitor_hash bytea not null check (octet_length(visitor_hash) = 32),
  -- The name as it goes on the shirt. Length checked per zone before it is written.
  name_on_shirt text not null check (length(name_on_shirt) between 1 and 40 and name_on_shirt = btrim(name_on_shirt) and name_on_shirt !~ '[[:cntrl:]]'),
  match_key text not null check (length(match_key) between 1 and 40),
  -- Digits as printed, so "07" and "7" stay different.
  number text not null check (number ~ '^[0-9]{1,3}$'),
  size_label text not null check (length(size_label) between 1 and 16),
  wearer_group text not null check (wearer_group in ('mens', 'womens', 'junior', 'unisex')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (link_id, visitor_hash),
  foreign key (link_id, brand_id) references public.roster_signup_links (id, brand_id) on delete cascade,
  foreign key (season_id, brand_id) references public.club_seasons (id, brand_id) on delete cascade
);

comment on table public.roster_signup_entries is
  'What players sent through a sign-up link. Personal data; removed with the season. Written by the server only.';

create index roster_signup_entries_link_idx on public.roster_signup_entries (link_id, created_at);
create index roster_signup_entries_season_idx on public.roster_signup_entries (season_id);
create index roster_signup_entries_brand_idx on public.roster_signup_entries (brand_id);

-- ---------------------------------------------------------------------------------------------
-- Who may reach what
-- ---------------------------------------------------------------------------------------------

-- A member of the brand reads their own club's rows and writes none of them. The server's own key
-- reads too, and writes only through the functions below. Deleting a design, a season or a brand
-- removes these through their keys.
revoke all on
  public.committee_links, public.committee_link_versions, public.committee_pins, public.committee_votes,
  public.committee_approvals, public.committee_locks, public.roster_signup_links,
  public.roster_signup_requests, public.roster_signup_entries
  from public, anon, authenticated, service_role;

grant select on
  public.committee_links, public.committee_link_versions, public.committee_pins, public.committee_votes,
  public.committee_approvals, public.committee_locks, public.roster_signup_links,
  public.roster_signup_requests, public.roster_signup_entries
  to authenticated, service_role;

-- No role is granted insert, update or delete on any of the nine. Deleting a design, a season or a
-- brand still removes their rows: a cascade runs as the table's owner, which no API role is.

alter table public.committee_links enable row level security;
alter table public.committee_link_versions enable row level security;
alter table public.committee_pins enable row level security;
alter table public.committee_votes enable row level security;
alter table public.committee_approvals enable row level security;
alter table public.committee_locks enable row level security;
alter table public.roster_signup_links enable row level security;
alter table public.roster_signup_requests enable row level security;
alter table public.roster_signup_entries enable row level security;

create policy "members read their brand's committee links"
  on public.committee_links for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's committee link versions"
  on public.committee_link_versions for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's committee pins"
  on public.committee_pins for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's committee votes"
  on public.committee_votes for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's committee approvals"
  on public.committee_approvals for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's committee locks"
  on public.committee_locks for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their club's sign-up links"
  on public.roster_signup_links for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their club's sign-up requests"
  on public.roster_signup_requests for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their club's sign-up entries"
  on public.roster_signup_entries for select to authenticated
  using (private.is_member(brand_id));

-- There is no insert, update or delete policy on any of the nine, on purpose.

-- An approval and a lock are records. Nothing changes or removes one, not even the table's owner
-- through a function, so the only way to undo an approval is to record another.
-- The one exception, as the credit ledger has it (decision 0044): a row goes when its link has
-- already gone, which is what a cascade from a deleted design or brand does. Nothing else.
create function private.refuse_committee_record_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Emptying the table has no row to look at, so it is refused outright.
  if tg_op = 'TRUNCATE' then
    raise exception 'A committee comment, vote record, approval or lock is a record and never changes.'
      using errcode = 'P0001', hint = 'append_only';
  end if;
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.committee_links l where l.id = old.link_id) then
      return old;
    end if;
  -- A cascade that removes an approval also sets its lock's approval_id to null on the way out.
  -- That is one update, inside the same cascade, on a row that is going anyway; without this the
  -- cascade would fail and a design with both an approval and a lock could never be deleted.
  elsif not exists (select 1 from public.committee_links l where l.id = new.link_id) then
    return new;
  end if;
  raise exception 'A committee comment, vote record, approval or lock is a record and never changes.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

revoke all on function private.refuse_committee_record_change() from public, anon, authenticated;

create trigger committee_approvals_append_only
  before update or delete on public.committee_approvals
  for each row execute function private.refuse_committee_record_change();

create trigger committee_approvals_not_truncated
  before truncate on public.committee_approvals
  for each statement execute function private.refuse_committee_record_change();

create trigger committee_locks_append_only
  before update or delete on public.committee_locks
  for each row execute function private.refuse_committee_record_change();

create trigger committee_locks_not_truncated
  before truncate on public.committee_locks
  for each statement execute function private.refuse_committee_record_change();

create trigger committee_pins_append_only
  before update or delete on public.committee_pins
  for each row execute function private.refuse_committee_record_change();

create trigger committee_pins_not_truncated
  before truncate on public.committee_pins
  for each statement execute function private.refuse_committee_record_change();

-- ---------------------------------------------------------------------------------------------
-- Opening a token
-- ---------------------------------------------------------------------------------------------

-- The one committee link a token opens: not revoked and not expired. One lookup by the unique
-- hash, so an unknown token, a revoked link and an expired one take the same path.
create function private.open_committee_link(p_token text)
returns public.committee_links
language sql
stable
security definer
set search_path = ''
as $$
  select l.*
  from public.committee_links l
  where l.token_hash = private.share_token_hash(p_token)
    and l.revoked_at is null
    and l.expires_at > now();
$$;

revoke all on function private.open_committee_link(text) from public, anon, authenticated;

create function private.open_roster_signup_link(p_token text)
returns public.roster_signup_links
language sql
stable
security definer
set search_path = ''
as $$
  select l.*
  from public.roster_signup_links l
  where l.token_hash = private.share_token_hash(p_token)
    and l.revoked_at is null
    and l.expires_at > now();
$$;

revoke all on function private.open_roster_signup_link(text) from public, anon, authenticated;

-- The visitor a browser is, for one link. The hash includes the link, so it cannot follow a
-- browser from one link to another.
create function private.link_visitor_hash(p_link_id uuid, p_visitor_key text)
returns bytea
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_visitor_key is null or p_visitor_key !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'A visitor key is 43 characters.' using errcode = '22023';
  end if;
  return sha256(convert_to(p_link_id::text || ':' || p_visitor_key, 'UTF8'));
end;
$$;

revoke all on function private.link_visitor_hash(uuid, text) from public, anon, authenticated;

-- The name folded for matching one person's answer to the person a manager asked. Hidden characters
-- go first, so this agrees with the cleaned name that is actually stored, and with the same folding
-- the browser does (`lib/clubs/signup/paste.ts`).
create function private.roster_match_key(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(
    lower(regexp_replace(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g')), '\s+', ' ', 'g')),
    40
  );
$$;

revoke all on function private.roster_match_key(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- The limits, as functions so one place holds each number
-- ---------------------------------------------------------------------------------------------

-- The most committee links one design may have open at once.
create function private.committee_links_open_limit()
returns integer language sql immutable set search_path = '' as $$ select 10 $$;

-- The most versions one committee link may show. F-T3 says up to three.
create function private.committee_slots_limit()
returns integer language sql immutable set search_path = '' as $$ select 3 $$;

-- The most pins and the most votes one committee link takes.
create function private.committee_pins_limit()
returns integer language sql immutable set search_path = '' as $$ select 300 $$;

create function private.committee_votes_limit()
returns integer language sql immutable set search_path = '' as $$ select 300 $$;

-- The most people one season may be waiting on, and the most answers one sign-up link takes.
create function private.signup_requests_limit()
returns integer language sql immutable set search_path = '' as $$ select 200 $$;

create function private.signup_entries_limit()
returns integer language sql immutable set search_path = '' as $$ select 300 $$;

revoke all on function private.committee_links_open_limit() from public, anon, authenticated;
revoke all on function private.committee_slots_limit() from public, anon, authenticated;
revoke all on function private.committee_pins_limit() from public, anon, authenticated;
revoke all on function private.committee_votes_limit() from public, anon, authenticated;
revoke all on function private.signup_requests_limit() from public, anon, authenticated;
revoke all on function private.signup_entries_limit() from public, anon, authenticated;

-- A committee link of a brand the user belongs to. A link that is missing and another brand's link
-- give the same answer.
create function private.member_committee_link(p_link_id uuid, p_user_id uuid)
returns public.committee_links
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_link public.committee_links;
begin
  select * into v_link from public.committee_links l where l.id = p_link_id;
  if not found or not private.belongs_to(p_user_id, v_link.brand_id) then
    raise exception 'That link does not exist.' using errcode = 'P0002';
  end if;
  return v_link;
end;
$$;

revoke all on function private.member_committee_link(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Making and withdrawing a committee link
-- ---------------------------------------------------------------------------------------------

-- Makes a link that shows the given saved versions, in the order given, as slots A, B and C. The
-- server makes the token and passes it here once; only its hash is kept.
create function public.create_committee_link(
  p_project_id uuid,
  p_user_id uuid,
  p_token text,
  p_versions integer[]
)
returns table (id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_link_id uuid;
  v_expires timestamptz;
  v_count integer := coalesce(array_length(p_versions, 1), 0);
  v_slots text[] := array['A', 'B', 'C'];
  v_index integer;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'A share token is 43 characters.' using errcode = '22023';
  end if;
  if v_count < 1 or v_count > private.committee_slots_limit() then
    raise exception 'A committee link shows 1 to 3 versions.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_versions) as u(version) where u.version is null or u.version < 1) then
    raise exception 'A version is a whole number of at least 1.' using errcode = '22023';
  end if;
  if (select count(distinct u.version) from unnest(p_versions) as u(version)) <> v_count then
    raise exception 'Each version can be shown once.' using errcode = '22023';
  end if;

  select * into v_project from public.projects p where p.id = p_project_id for update;
  if not found or not private.belongs_to(p_user_id, v_project.brand_id) then
    raise exception 'That design does not exist.' using errcode = 'P0002';
  end if;
  if not private.can_manage_kit(p_user_id, v_project.brand_id) then
    raise exception 'Your role in this club does not allow that.' using errcode = '42501';
  end if;

  if exists (
    select 1 from unnest(p_versions) as u(version)
    where not exists (
      select 1 from public.spec_versions s where s.project_id = p_project_id and s.version = u.version
    )
  ) then
    raise exception 'That version of the design does not exist.' using errcode = 'P0002';
  end if;

  if (
    select count(*) from public.committee_links l
    where l.project_id = p_project_id and l.revoked_at is null and l.expires_at > now()
  ) >= private.committee_links_open_limit() then
    raise exception 'This design has as many committee links as it may have. Withdraw one first.'
      using errcode = 'P0001', hint = 'too_many_links';
  end if;

  v_expires := now() + make_interval(days => private.public_link_days('committee'));
  insert into public.committee_links as l (brand_id, project_id, token_hash, created_by, expires_at)
  values (v_project.brand_id, p_project_id, private.share_token_hash(p_token), p_user_id, v_expires)
  returning l.id into v_link_id;

  for v_index in 1 .. v_count loop
    insert into public.committee_link_versions (link_id, brand_id, slot, version)
    values (v_link_id, v_project.brand_id, v_slots[v_index], p_versions[v_index]);
  end loop;

  return query select v_link_id, v_expires;
end;
$$;

-- Stops a committee link working. Withdrawing a withdrawn link changes nothing, and the comments,
-- votes and approvals left through it stay on the design.
create function public.revoke_committee_link(p_link_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.committee_links;
begin
  v_link := private.member_committee_link(p_link_id, p_user_id);
  if not private.can_manage_kit(p_user_id, v_link.brand_id) then
    raise exception 'Your role in this club does not allow that.' using errcode = '42501';
  end if;
  update public.committee_links l
  set revoked_at = coalesce(l.revoked_at, now())
  where l.id = p_link_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- What the committee page is drawn from
-- ---------------------------------------------------------------------------------------------

-- One row per slot the link shows. The brand is returned for the server, which reads the brand's
-- size charts and pictures to draw each version. A visitor is shown only the design's name, the
-- club's name, the drawings and the colours and fabrics, exactly as a share page shows them.
create function public.open_committee(p_token text)
returns table (
  link_id uuid,
  brand_id uuid,
  brand_name text,
  project_name text,
  expires_at timestamptz,
  slot text,
  version integer,
  is_current boolean,
  spec jsonb,
  saved_at timestamptz,
  locked_version integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.brand_id, b.name, p.name, l.expires_at, cv.slot, cv.version,
         cv.version = p.current_version, v.spec, v.created_at,
         (select k.version from public.committee_locks k where k.project_id = l.project_id limit 1)
  from private.open_committee_link(p_token) l
  join public.projects p on p.id = l.project_id and p.brand_id = l.brand_id
  join public.brands b on b.id = l.brand_id
  join public.committee_link_versions cv on cv.link_id = l.id
  join public.spec_versions v on v.project_id = l.project_id and v.version = cv.version
  where l.id is not null
  order by cv.slot;
$$;

-- Keeps a comment pinned to a point on a panel. Append only: a second pin from the same browser is
-- a second comment, as a thread of design comments would be (decision 0063).
create function public.committee_pin(
  p_token text,
  p_visitor_key text,
  p_name text,
  p_version integer,
  p_panel_id text,
  p_x_mm numeric,
  p_y_mm numeric,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.committee_links;
  v_visitor bytea;
  v_name text := btrim(coalesce(p_name, ''));
  v_body text := btrim(coalesce(p_body, ''));
begin
  v_link := private.open_committee_link(p_token);
  if v_link.id is null then
    raise exception 'That link does not exist.' using errcode = 'P0002';
  end if;
  v_visitor := private.link_visitor_hash(v_link.id, p_visitor_key);

  if length(v_name) < 1 or length(v_name) > 60 then
    raise exception 'A name has 1 to 60 characters.' using errcode = '22023';
  end if;
  if length(v_body) < 1 or length(v_body) > 2000 then
    raise exception 'A comment has 1 to 2000 characters.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.committee_link_versions cv where cv.link_id = v_link.id and cv.version = p_version
  ) then
    raise exception 'That version is not on this link.' using errcode = '22023';
  end if;

  -- Pins on one link are taken in turn, so the count below cannot be passed by two at once.
  perform 1 from public.committee_links l where l.id = v_link.id for update;
  if (select count(*) from public.committee_pins c where c.link_id = v_link.id) >= private.committee_pins_limit() then
    raise exception 'This link has taken as many comments as it can.'
      using errcode = 'P0001', hint = 'too_many_pins';
  end if;

  insert into public.committee_pins (link_id, brand_id, visitor_hash, version, name, panel_id, x_mm, y_mm, body)
  values (v_link.id, v_link.brand_id, v_visitor, p_version, v_name, p_panel_id, p_x_mm, p_y_mm, v_body);
end;
$$;

-- Keeps one browser's A/B/C vote. Voting again replaces the vote; it never adds one.
create function public.committee_vote(
  p_token text,
  p_visitor_key text,
  p_name text,
  p_slot text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.committee_links;
  v_visitor bytea;
  v_name text := btrim(coalesce(p_name, ''));
begin
  v_link := private.open_committee_link(p_token);
  if v_link.id is null then
    raise exception 'That link does not exist.' using errcode = 'P0002';
  end if;
  v_visitor := private.link_visitor_hash(v_link.id, p_visitor_key);

  if length(v_name) < 1 or length(v_name) > 60 then
    raise exception 'A name has 1 to 60 characters.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.committee_link_versions cv where cv.link_id = v_link.id and cv.slot = p_slot
  ) then
    raise exception 'That choice is not on this link.' using errcode = '22023';
  end if;

  perform 1 from public.committee_links l where l.id = v_link.id for update;
  if not exists (
    select 1 from public.committee_votes c where c.link_id = v_link.id and c.visitor_hash = v_visitor
  ) and (
    select count(*) from public.committee_votes c where c.link_id = v_link.id
  ) >= private.committee_votes_limit() then
    raise exception 'This link has taken as many votes as it can.'
      using errcode = 'P0001', hint = 'too_many_votes';
  end if;

  insert into public.committee_votes as c (link_id, brand_id, visitor_hash, slot, name)
  values (v_link.id, v_link.brand_id, v_visitor, p_slot, v_name)
  on conflict (link_id, visitor_hash) do update
  set slot = excluded.slot, name = excluded.name, updated_at = now();
end;
$$;

-- Records an approval: who, under what name, when and against which version. Immutable once
-- written, so the same browser pressing Approve twice on the same version changes nothing.
create function public.committee_approve(
  p_token text,
  p_visitor_key text,
  p_name text,
  p_email text,
  p_version integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.committee_links;
  v_visitor bytea;
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_id uuid;
begin
  v_link := private.open_committee_link(p_token);
  if v_link.id is null then
    raise exception 'That link does not exist.' using errcode = 'P0002';
  end if;
  v_visitor := private.link_visitor_hash(v_link.id, p_visitor_key);

  if length(v_name) < 1 or length(v_name) > 60 then
    raise exception 'A name has 1 to 60 characters.' using errcode = '22023';
  end if;
  if v_email is not null and (length(v_email) < 3 or length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'That is not an email address.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.committee_link_versions cv where cv.link_id = v_link.id and cv.version = p_version
  ) then
    raise exception 'That version is not on this link.' using errcode = '22023';
  end if;

  select a.id into v_id
  from public.committee_approvals a
  where a.link_id = v_link.id and a.visitor_hash = v_visitor and a.version = p_version;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.committee_approvals as a
    (link_id, brand_id, project_id, version, name, email, visitor_hash)
  values (v_link.id, v_link.brand_id, v_link.project_id, p_version, v_name, v_email, v_visitor)
  returning a.id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Locking the approved version
-- ---------------------------------------------------------------------------------------------

-- The kit manager locks one version of the design. The lock is a record of its own, and the
-- version moves to status `approved` through set_design_status (plan v5 X4), which refuses a
-- version that has never been checked against a factory profile.
create function public.committee_lock_version(
  p_link_id uuid,
  p_user_id uuid,
  p_version integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.committee_links;
  v_status public.design_statuses;
  v_approval uuid;
  v_lock uuid;
begin
  v_link := private.member_committee_link(p_link_id, p_user_id);
  if not private.can_manage_kit(p_user_id, v_link.brand_id) then
    raise exception 'Your role in this club does not allow that.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.committee_link_versions cv where cv.link_id = v_link.id and cv.version = p_version
  ) then
    raise exception 'That version is not on this link.' using errcode = '22023';
  end if;

  perform 1 from public.projects p where p.id = v_link.project_id for update;

  if exists (select 1 from public.committee_locks k where k.project_id = v_link.project_id) then
    raise exception 'A version of this design is already locked.'
      using errcode = 'P0001', hint = 'already_locked';
  end if;

  select * into v_status
  from public.design_statuses d
  where d.project_id = v_link.project_id and d.version = p_version and d.brand_id = v_link.brand_id;
  if not found then
    raise exception 'This version has not been checked against a factory profile yet.'
      using errcode = 'P0001', hint = 'not_checked';
  end if;

  -- The newest approval of this version through this link, when there is one. A manager may lock a
  -- version nobody approved; the screen says so rather than pretending an approval exists.
  select a.id into v_approval
  from public.committee_approvals a
  where a.link_id = v_link.id and a.version = p_version
  order by a.approved_at desc, a.id desc
  limit 1;

  insert into public.committee_locks as k (link_id, brand_id, project_id, version, approval_id, locked_by)
  values (v_link.id, v_link.brand_id, v_link.project_id, p_version, v_approval, p_user_id)
  returning k.id into v_lock;

  perform public.set_design_status(
    v_link.project_id, v_link.brand_id, p_user_id, p_version, 'approved',
    v_status.profile_id, v_status.findings_hash
  );
  return v_lock;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Roster sign-up links (F-T4)
-- ---------------------------------------------------------------------------------------------

create function private.member_signup_link(p_link_id uuid, p_user_id uuid)
returns public.roster_signup_links
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_link public.roster_signup_links;
begin
  select * into v_link from public.roster_signup_links l where l.id = p_link_id;
  if not found or not private.belongs_to(p_user_id, v_link.brand_id) then
    raise exception 'That link does not exist.' using errcode = 'P0002';
  end if;
  return v_link;
end;
$$;

revoke all on function private.member_signup_link(uuid, uuid) from public, anon, authenticated;

-- Makes the season's sign-up link. One link is open per season at a time: making another withdraws
-- the one before it, so a manager can always say which address they sent out.
create function public.create_roster_signup_link(
  p_brand_id uuid,
  p_user_id uuid,
  p_season_id uuid,
  p_token text,
  p_sport text
)
returns table (id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link_id uuid;
  v_expires timestamptz;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'A share token is 43 characters.' using errcode = '22023';
  end if;
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'Your role in this club does not allow that.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.club_seasons s where s.id = p_season_id and s.brand_id = p_brand_id
  ) then
    raise exception 'That season does not exist.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.sport_number_rules r where r.sport = p_sport) then
    raise exception 'That sport has no number rule.' using errcode = '22023';
  end if;

  update public.roster_signup_links l
  set revoked_at = now()
  where l.season_id = p_season_id and l.revoked_at is null;

  v_expires := now() + make_interval(days => private.public_link_days('roster_signup'));
  insert into public.roster_signup_links as l (brand_id, season_id, token_hash, sport, created_by, expires_at)
  values (p_brand_id, p_season_id, private.share_token_hash(p_token), p_sport, p_user_id, v_expires)
  returning l.id into v_link_id;

  return query select v_link_id, v_expires;
end;
$$;

create function public.revoke_roster_signup_link(p_link_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.roster_signup_links;
begin
  v_link := private.member_signup_link(p_link_id, p_user_id);
  if not private.can_manage_kit(p_user_id, v_link.brand_id) then
    raise exception 'Your role in this club does not allow that.' using errcode = '42501';
  end if;
  update public.roster_signup_links l
  set revoked_at = coalesce(l.revoked_at, now())
  where l.id = p_link_id;
end;
$$;

-- Replaces the list of people the club is waiting on for this season, in one step. Each entry is
-- {"name": "...", "phone": "...", "email": "..."}; a name repeated under two spellings that fold to
-- the same key is kept once, which is how a duplicate is flagged rather than written twice.
create function public.set_roster_signup_requests(
  p_brand_id uuid,
  p_user_id uuid,
  p_season_id uuid,
  p_people jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'Your role in this club does not allow that.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.club_seasons s where s.id = p_season_id and s.brand_id = p_brand_id
  ) then
    raise exception 'That season does not exist.' using errcode = 'P0002';
  end if;
  if p_people is null or jsonb_typeof(p_people) <> 'array' then
    raise exception 'Give a list of people.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_people) > private.signup_requests_limit() then
    raise exception 'A season may be waiting on as many people as it is.'
      using errcode = 'P0001', hint = 'too_many_requests';
  end if;

  delete from public.roster_signup_requests r where r.season_id = p_season_id and r.brand_id = p_brand_id;

  -- Everything is cut to what the columns take rather than trusted to arrive that way: the browser
  -- cleans a name and a number too (lib/clubs/signup/paste.ts), but a club's own pasted list must
  -- never be able to fail the whole call on one odd line.
  with wanted as (
    select distinct on (private.roster_match_key(person->>'name'))
      btrim(left(regexp_replace(btrim(coalesce(person->>'name', '')), '[[:cntrl:]]', '', 'g'), 40)) as name,
      private.roster_match_key(person->>'name') as match_key,
      case
        when regexp_replace(coalesce(person->>'phone', ''), '[^+0-9]', '', 'g') ~ '^\+?[0-9]{6,20}$'
        then regexp_replace(coalesce(person->>'phone', ''), '[^+0-9]', '', 'g')
        else ''
      end as phone,
      case
        when lower(btrim(coalesce(person->>'email', ''))) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
         and length(btrim(coalesce(person->>'email', ''))) between 3 and 254
        then lower(btrim(person->>'email'))
        else ''
      end as email
    from jsonb_array_elements(p_people) as t(person)
    where length(private.roster_match_key(person->>'name')) > 0
    order by private.roster_match_key(person->>'name')
  )
  insert into public.roster_signup_requests (brand_id, season_id, name, match_key, phone, email)
  select p_brand_id, p_season_id, w.name, w.match_key, w.phone, w.email from wanted w;

  select count(*) into v_count
  from public.roster_signup_requests r
  where r.season_id = p_season_id and r.brand_id = p_brand_id;
  return v_count;
end;
$$;

-- What the sign-up page is drawn from: the club's name, the season's name, the sport's number
-- range and the longest name the shirt's back takes. Nothing about any other player, nothing about
-- the roster, and nothing about the club's designs.
create function public.open_roster_signup(p_token text)
returns table (
  link_id uuid,
  brand_id uuid,
  club_name text,
  season_name text,
  expires_at timestamptz,
  sport text,
  sport_label text,
  lowest integer,
  highest integer,
  leading_zero_allowed boolean,
  number_rule_id text,
  name_max_characters integer,
  name_rule_id text
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.brand_id, b.name, s.name, l.expires_at, l.sport, r.label,
         r.lowest, r.highest, r.leading_zero_allowed, r.rule_id, z.max_characters, z.rule_id
  from private.open_roster_signup_link(p_token) l
  join public.club_seasons s on s.id = l.season_id and s.brand_id = l.brand_id
  join public.brands b on b.id = l.brand_id
  join public.sport_number_rules r on r.sport = l.sport
  join public.shirt_zone_limits z on z.zone = 'back-name'
  where l.id is not null;
$$;

-- Keeps one player's answer. The same browser answering again replaces its answer. The number is
-- checked against the sport's range and the name against the back zone's length; profanity is
-- screened before this is called (lib/moderation, plan v5 X8).
create function public.roster_signup_submit(
  p_token text,
  p_visitor_key text,
  p_name text,
  p_number text,
  p_size_label text,
  p_wearer_group text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.roster_signup_links;
  v_visitor bytea;
  v_name text := btrim(coalesce(p_name, ''));
  v_number text := btrim(coalesce(p_number, ''));
  v_rule public.sport_number_rules;
  v_zone public.shirt_zone_limits;
begin
  v_link := private.open_roster_signup_link(p_token);
  if v_link.id is null then
    raise exception 'That link does not exist.' using errcode = 'P0002';
  end if;
  v_visitor := private.link_visitor_hash(v_link.id, p_visitor_key);

  select * into v_zone from public.shirt_zone_limits z where z.zone = 'back-name';
  if length(v_name) < 1 or length(v_name) > v_zone.max_characters then
    raise exception 'A shirt name has 1 to % characters.', v_zone.max_characters using errcode = '22023';
  end if;

  select * into v_rule from public.sport_number_rules r where r.sport = v_link.sport;
  if v_number !~ '^[0-9]{1,3}$' then
    raise exception 'A number is digits only.' using errcode = '22023';
  end if;
  if v_number::integer < v_rule.lowest or v_number::integer > v_rule.highest then
    raise exception 'A % number is % to %.', v_rule.label, v_rule.lowest, v_rule.highest using errcode = '22023';
  end if;
  if not v_rule.leading_zero_allowed and length(v_number) > 1 and left(v_number, 1) = '0' then
    raise exception 'A % number does not start with a zero.', v_rule.label using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_size_label, ''))) < 1 then
    raise exception 'Choose a size.' using errcode = '22023';
  end if;
  if p_wearer_group not in ('mens', 'womens', 'junior', 'unisex') then
    raise exception 'Choose who the kit is cut for.' using errcode = '22023';
  end if;

  perform 1 from public.roster_signup_links l where l.id = v_link.id for update;
  if not exists (
    select 1 from public.roster_signup_entries e where e.link_id = v_link.id and e.visitor_hash = v_visitor
  ) and (
    select count(*) from public.roster_signup_entries e where e.link_id = v_link.id
  ) >= private.signup_entries_limit() then
    raise exception 'This link has taken as many answers as it can.'
      using errcode = 'P0001', hint = 'too_many_entries';
  end if;

  insert into public.roster_signup_entries as e
    (link_id, brand_id, season_id, visitor_hash, name_on_shirt, match_key, number, size_label, wearer_group)
  values (
    v_link.id, v_link.brand_id, v_link.season_id, v_visitor, v_name,
    private.roster_match_key(v_name), v_number, btrim(p_size_label), p_wearer_group
  )
  on conflict (link_id, visitor_hash) do update
  set name_on_shirt = excluded.name_on_shirt,
      match_key = excluded.match_key,
      number = excluded.number,
      size_label = excluded.size_label,
      wearer_group = excluded.wearer_group,
      updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Only the server's own key may run these. A browser, signed in or not, is refused.
-- ---------------------------------------------------------------------------------------------

revoke all on function public.create_committee_link(uuid, uuid, text, integer[]) from public, anon, authenticated;
revoke all on function public.revoke_committee_link(uuid, uuid) from public, anon, authenticated;
revoke all on function public.open_committee(text) from public, anon, authenticated;
revoke all on function public.committee_pin(text, text, text, integer, text, numeric, numeric, text) from public, anon, authenticated;
revoke all on function public.committee_vote(text, text, text, text) from public, anon, authenticated;
revoke all on function public.committee_approve(text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.committee_lock_version(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.create_roster_signup_link(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.revoke_roster_signup_link(uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_roster_signup_requests(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.open_roster_signup(text) from public, anon, authenticated;
revoke all on function public.roster_signup_submit(text, text, text, text, text, text) from public, anon, authenticated;

grant execute on function public.create_committee_link(uuid, uuid, text, integer[]) to service_role;
grant execute on function public.revoke_committee_link(uuid, uuid) to service_role;
grant execute on function public.open_committee(text) to service_role;
grant execute on function public.committee_pin(text, text, text, integer, text, numeric, numeric, text) to service_role;
grant execute on function public.committee_vote(text, text, text, text) to service_role;
grant execute on function public.committee_approve(text, text, text, text, integer) to service_role;
grant execute on function public.committee_lock_version(uuid, uuid, integer) to service_role;
grant execute on function public.create_roster_signup_link(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.revoke_roster_signup_link(uuid, uuid) to service_role;
grant execute on function public.set_roster_signup_requests(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.open_roster_signup(text) to service_role;
grant execute on function public.roster_signup_submit(text, text, text, text, text, text) to service_role;
