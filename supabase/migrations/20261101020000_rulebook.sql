-- Rulebook and "Why?" v1 (plan v5, workstream X2, decision 0067; spec F-S5 v1 and decision 11).
--
-- rulebook_entries is the knowledge behind every "Why?". One row is one VERSION of one rule: an edit adds the
-- next version and never overwrites, and the newest version is the one shown. The content of a version can
-- never change; the one change allowed is a draft becoming confirmed (with who and when). Nothing is deleted.
-- rulebook_gaps counts each question or check code that has no entry, so the team knows what to write next.
--
-- Signed-in people read rulebook_entries (every column but who wrote or confirmed a version); visitors read
-- nothing. Nobody in a browser reads rulebook_gaps or writes either table: the server's key holds SELECT only
-- and writes through the functions below. rulebook_entry_save and rulebook_entry_confirm refuse anyone who is
-- not a platform admin with "not found" (P0002), as platform_setting_set does.
--
-- The seed is the 45 rules of docs/spec/articles/JSY-SS-01/rulebook.md, word for word, all draft, plus
-- R-GAP-000. Title is the "Applies to" column, rule the "Rule" column, body the "Why" column, source_note the
-- "Source" column; source is that note sorted into factory | pattern_master | standard | knitwright
-- (lib/rulebook/markdown.ts, sourceFromNote). The shared families (R-SUB, R-LAB, R-QC, R-COST) carry no article
-- code, which means every article; the others carry JSY-SS-01. lib/rulebook/seed.test.ts compares this file
-- with the rulebook, and tests/integration/rulebook.test.ts compares the database with it.
-- Nothing refers to another workstream's tables, so migrations merge in any order.

create table public.rulebook_entries (
  id uuid primary key default gen_random_uuid(),
  rule_id text not null check (rule_id ~ '^R-[A-Z]{2,8}-[0-9]{3}$'),
  version integer not null check (version >= 1),
  -- Null only for R-GAP-000, which is not about any topic.
  topic text check (topic in ('construction', 'fabric', 'print', 'fit', 'grading', 'labels', 'qc', 'cost', 'pattern', 'personalisation')),
  -- Empty means every article.
  article_codes text[] not null default '{}',
  title text not null check (length(title) between 1 and 300),
  rule text not null check (length(rule) <= 2000),
  body text not null check (length(body) between 1 and 2000),
  best_practice text not null check (length(best_practice) <= 2000),
  source text not null check (source in ('factory', 'pattern_master', 'standard', 'knitwright')),
  source_note text not null default '' check (length(source_note) <= 500),
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  confirmed_by uuid references auth.users (id) on delete set null,
  confirmed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (rule_id, version),
  check ((status = 'draft' and confirmed_at is null and confirmed_by is null) or (status = 'confirmed' and confirmed_at is not null))
);

comment on table public.rulebook_entries is
  'The rulebook behind every "Why?". One row per version of a rule; never overwritten. Written by rulebook_entry_save and rulebook_entry_confirm only.';

create table public.rulebook_gaps (
  code text primary key check (length(code) between 1 and 200),
  context text not null default '' check (length(context) <= 500),
  count integer not null default 1 check (count >= 1),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

comment on table public.rulebook_gaps is
  'Questions and check codes with no rulebook entry, counted. Written by rulebook_gap_log only; read by the server for platform admins.';

-- A version's words never change and no version is removed. Two updates are allowed: a draft becoming
-- confirmed, and the account behind created_by or confirmed_by being erased (on delete set null).
create function private.guard_rulebook_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Nested, so NEW and OLD are read only for a row update (they are not set for a truncate).
  if tg_op = 'UPDATE' then
    if (new.id, new.rule_id, new.version, new.topic, new.article_codes, new.title, new.rule, new.body,
        new.best_practice, new.source, new.source_note, new.created_at)
       is not distinct from
       (old.id, old.rule_id, old.version, old.topic, old.article_codes, old.title, old.rule, old.body,
        old.best_practice, old.source, old.source_note, old.created_at) then
      if old.status = 'draft' and new.status = 'confirmed' and new.created_by is not distinct from old.created_by then
        return new;
      end if;
      if new.status = old.status and new.confirmed_at is not distinct from old.confirmed_at
         and (new.created_by is null or new.created_by = old.created_by)
         and (new.confirmed_by is null or new.confirmed_by = old.confirmed_by) then
        return new;
      end if;
    end if;
  end if;
  raise exception 'A rulebook version can never be changed or removed; save a new version instead.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

revoke all on function private.guard_rulebook_entry() from public, anon, authenticated;

create trigger rulebook_entries_are_versioned
  before update or delete on public.rulebook_entries
  for each row execute function private.guard_rulebook_entry();

create trigger rulebook_entries_are_not_truncated
  before truncate on public.rulebook_entries
  for each statement execute function private.guard_rulebook_entry();

revoke all on public.rulebook_entries, public.rulebook_gaps from public, anon, authenticated, service_role;
grant select on public.rulebook_entries, public.rulebook_gaps to service_role;
grant select (
  id, rule_id, version, topic, article_codes, title, rule, body, best_practice, source, source_note, status,
  confirmed_at, created_at
) on public.rulebook_entries to authenticated;

alter table public.rulebook_entries enable row level security;
alter table public.rulebook_gaps enable row level security;

create policy "signed-in users read the rulebook"
  on public.rulebook_entries for select to authenticated
  using (true);

-- rulebook_gaps has no policy for browsers, on purpose.

-- Adds the next version of a rule (version 1 for a new id), as a draft. Returns the new version number.
create function public.rulebook_entry_save(
  p_actor uuid, p_rule_id text, p_topic text, p_article_codes text[], p_title text, p_rule text, p_body text,
  p_best_practice text, p_source text, p_source_note text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version integer;
begin
  if p_actor is null or not exists (select 1 from public.platform_admins a where a.user_id = p_actor) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  -- Two saves of the same rule at once take turns, so each gets its own version number.
  perform pg_advisory_xact_lock(hashtext('rulebook:' || p_rule_id));
  select coalesce(max(e.version), 0) + 1 into v_version from public.rulebook_entries e where e.rule_id = p_rule_id;
  insert into public.rulebook_entries
    (rule_id, version, topic, article_codes, title, rule, body, best_practice, source, source_note, created_by)
  values
    (p_rule_id, v_version, p_topic, coalesce(p_article_codes, '{}'), p_title, p_rule, p_body, p_best_practice,
     p_source, coalesce(p_source_note, ''), p_actor);
  return v_version;
end;
$$;

revoke all on function public.rulebook_entry_save(uuid, text, text, text[], text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.rulebook_entry_save(uuid, text, text, text[], text, text, text, text, text, text)
  to service_role;

-- Marks one version as confirmed by the factory. Confirming a version already confirmed changes nothing.
create function public.rulebook_entry_confirm(p_actor uuid, p_rule_id text, p_version integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor is null or not exists (select 1 from public.platform_admins a where a.user_id = p_actor) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.rulebook_entries e where e.rule_id = p_rule_id and e.version = p_version) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  update public.rulebook_entries
     set status = 'confirmed', confirmed_by = p_actor, confirmed_at = now()
   where rule_id = p_rule_id and version = p_version and status = 'draft';
end;
$$;

revoke all on function public.rulebook_entry_confirm(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.rulebook_entry_confirm(uuid, text, integer) to service_role;

-- Counts one more meeting with a code that has no entry. The server calls it for any signed-in person who
-- opens a "Why?" with no rule behind it; the action is rate limited.
create function public.rulebook_gap_log(p_code text, p_context text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.rulebook_gaps as g (code, context)
  values (p_code, coalesce(p_context, ''))
  on conflict (code) do update
    set count = g.count + 1,
        last_seen = now(),
        context = coalesce(nullif(excluded.context, ''), g.context);
end;
$$;

revoke all on function public.rulebook_gap_log(text, text) from public, anon, authenticated;
grant execute on function public.rulebook_gap_log(text, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Seed: Rulebook JSY-SS-01, version 0.1 of 25 Oct 2026, "draft for factory review". Every rule is a draft
-- until the factory's pattern master and production manager confirm it.

insert into public.rulebook_entries
  (rule_id, version, topic, article_codes, title, rule, body, best_practice, source, source_note)
values
  ('R-GAP-000', 1, null, '{}'::text[],
   'A check with no rule yet',
   '',
   'No rule written yet; the team has been told',
   '',
   'knitwright', 'Plan v5, workstream X2');

insert into public.rulebook_entries
  (rule_id, topic, article_codes, title, rule, body, best_practice, source, source_note, version)
select v.rule_id, v.topic, v.article_codes, v.title, v.rule, v.body, v.best_practice, v.source, v.source_note, 1
from (values
  ('R-PAT-001', 'pattern', array['JSY-SS-01'],
   'All pieces',
   'Seam allowance 6 mm on overlocked seams, 25 mm body hem, 20 mm sleeve hem, 6 mm on rib',
   'A 4-thread overlock trims and sews about 6 mm; hems need room to fold and coverstitch',
   'Never put critical artwork inside the seam allowance; it gets cut or folded away',
   'knitwright', 'Knitwright draft; factory to confirm their machine settings'),
  ('R-PAT-002', 'pattern', array['JSY-SS-01'],
   'Front, back, sleeves',
   'Sublimated panels are cut flat, not on the fold, and left and right sleeves are separate pieces',
   'Each panel is printed with its own artwork, so a folded or doubled cut would mirror or misplace the print',
   'Design both sleeves; they can differ (e.g. a sponsor on one side only)',
   'standard', 'Sublimation practice'),
  ('R-PAT-003', 'pattern', array['JSY-SS-01'],
   'Parameter `body_length_offset` −30 to +40 mm',
   'Body length can change in 10 mm steps within this range',
   'Beyond this, the proportion of the block changes and the size chart no longer describes the fit',
   'For tucked-in match shirts use 0 or +20; for training tops 0 or −20',
   'knitwright', 'Knitwright draft; range approved only after a sample at each end'),
  ('R-PAT-004', 'pattern', array['JSY-SS-01'],
   'Parameter `sleeve_length_offset` −20 to +40 mm',
   'Sleeve length can change in 10 mm steps within this range',
   'Longer than +40 becomes a different sleeve (elbow length) and needs a new block',
   'Goalkeeper or long-sleeve shirts use article JSY-LS-01, not this offset',
   'knitwright', 'Knitwright draft'),
  ('R-PAT-005', 'pattern', array['JSY-SS-01'],
   'Parameter `back_drop_tail` 0 to 40 mm',
   'The back hem can curve down by up to 40 mm at centre back',
   'A drop tail keeps the shirt tucked during play, but a longer tail needs a different hem operation',
   'Use 20–30 mm for football match shirts',
   'knitwright', 'Knitwright draft'),
  ('R-PAT-006', 'pattern', array['JSY-SS-01'],
   'Notches',
   'Front armhole: 1 notch; back armhole: 2 notches; sleeve: matching notches plus a top notch at the shoulder; CF and CB notches at neck and hem; rib quartered',
   'Notches make the sleeve go in the right way round and stop panels being sewn twisted',
   'Do not remove notches when editing patterns; the factory relies on them',
   'standard', 'Industry standard'),
  ('R-PAT-007', 'pattern', array['JSY-SS-01'],
   'Sleeve cap',
   'Total cap length is 0–6 mm longer than the armhole',
   'Knit fabric needs almost no ease; too much puckers the shoulder, too little pulls the sleeve',
   'Checked automatically in every pattern report',
   'knitwright', 'Knitwright draft'),
  ('R-PAT-008', 'pattern', array['JSY-SS-01'],
   'Neck rib C01',
   'Rib length = neckline seam × 0.85',
   'A rib cut shorter than the neckline is stretched while sewing, so it lies flat and holds its shape',
   'If the factory''s rib is stretchier or tighter, adjust the ratio here and re-sample',
   'standard', 'Industry practice; factory to confirm with their rib'),
  ('R-FIT-001', 'fit', array['JSY-SS-01'],
   'POM A chest, K hem',
   'Regular fit: chest half 520 mm at M, grading 30 mm per size, tolerance ±10 mm',
   'A 104 cm finished chest on a size-M body (about 96–100 cm) gives movement room without flapping',
   'Show customers the garment measurements, not only body sizes; it reduces wrong-size returns',
   'knitwright', 'Knitwright draft; replace with factory block values'),
  ('R-FIT-002', 'fit', array['JSY-SS-01'],
   'POM B body length',
   '720 mm at M, +20 mm per size, ±10 mm',
   'Long enough to tuck in, short enough not to bunch',
   'Measure from the high point of the shoulder, front',
   'knitwright', 'Knitwright draft'),
  ('R-FIT-003', 'fit', array['JSY-SS-01'],
   'POM C shoulder',
   '460 mm at M, +15 mm per size, ±7 mm',
   'The shoulder seam should sit on the shoulder bone; too wide looks sloppy, too narrow restricts the arm',
   'Shoulder grades less than chest because shoulders grow less than chests',
   'standard', 'Grading practice'),
  ('R-FIT-004', 'fit', array['JSY-SS-01'],
   'POM D sleeve length',
   '210 mm at M, +10 mm per size, ±7 mm',
   'Ends mid-bicep, the standard football look',
   'Use the sleeve offset parameter for longer looks rather than editing the pattern',
   'knitwright', 'Knitwright draft'),
  ('R-FIT-005', 'fit', array['JSY-SS-01'],
   'POM E bicep, F opening',
   'Bicep 195 mm half at M, opening 170 mm half, both +10 mm per size, ±5 mm',
   'Enough room for arm movement; the opening tapers so the sleeve doesn''t flare',
   'Tighter sleeves need fabric with stretch (rib cuff K02)',
   'knitwright', 'Knitwright draft'),
  ('R-FIT-006', 'fit', array['JSY-SS-01'],
   'POM G armhole depth',
   '250 mm at M, +10 mm per size, ±7 mm',
   'A deep armhole lets the arm lift without pulling the body up',
   'Don''t shorten it for a "tighter" look; it restricts movement',
   'knitwright', 'Knitwright draft'),
  ('R-FIT-007', 'fit', array['JSY-SS-01'],
   'POM H, I, J neck',
   'Neck width 180 mm at M (+5), front drop 85 mm (+3), back drop 20 mm fixed',
   'The crew neck must pass over the head and sit flat, not choke or gape',
   'V-neck C02 uses a 140 mm front drop',
   'knitwright', 'Knitwright draft'),
  ('R-FIT-008', 'fit', array['JSY-SS-01'],
   'All POMs',
   'Tolerances are checked on QC samples; a piece outside tolerance is a major defect',
   'Tolerances are the promise to the customer that size M is always size M',
   'Tighten tolerances only when the factory proves it can hold them',
   'standard', 'Industry practice'),
  ('R-CON-001', 'construction', array['JSY-SS-01'],
   'Shoulder, sleeve attach',
   '4-thread overlock (ISO 514), 12–14 stitches per inch',
   'Overlock stitches stretch with knit fabric, so seams don''t crack when the shirt is pulled on',
   'Thread colour matches the dominant colour so seams don''t show',
   'standard', 'Industry standard'),
  ('R-CON-002', 'construction', array['JSY-SS-01'],
   'Back neck',
   'The back neck seam is covered with tape and coverstitched',
   'Covers the seam so it doesn''t scratch, and stops the neck stretching out',
   'Tape can be printed or contrast for a branded finish',
   'standard', 'Industry standard'),
  ('R-CON-003', 'construction', array['JSY-SS-01'],
   'Side seams',
   'One continuous overlock seam from body hem to sleeve hem, underarm seams matched',
   'Faster to sew and stronger; matched underarm seams look finished',
   'Allow artwork to wrap across the side seam only if a 3 mm offset is acceptable (R-SUB-004)',
   'standard', 'Industry standard'),
  ('R-CON-004', 'construction', array['JSY-SS-01'],
   'Collar C01',
   '1x1 rib, 20 mm finished, joined at CB, attached with overlock',
   'Rib recovers after stretching over the head and keeps the neck shape',
   'Rib can be sublimated in a club colour or left white',
   'factory', 'Factory to confirm rib source'),
  ('R-CON-005', 'construction', array['JSY-SS-01'],
   'Collar C02',
   'V-neck with 15 mm self-fabric binding and a mitred V',
   'A mitre gives a sharp V point that doesn''t twist',
   'V-necks need a centre-front notch and careful pressing',
   'factory', 'Factory to confirm'),
  ('R-CON-006', 'construction', array['JSY-SS-01'],
   'Collar C03',
   'Crew neck with 15 mm self-fabric binding',
   'Matches the body print exactly, a modern look',
   'Binding must be cut across the stretch so it recovers',
   'factory', 'Factory to confirm'),
  ('R-CON-007', 'construction', array['JSY-SS-01'],
   'Hems K01, body',
   '2-needle coverstitch (ISO 406), 6.4 mm gauge; sleeve 20 mm, body 25 mm',
   'Coverstitch stretches with the fabric and looks clean on both sides',
   'Don''t use a single-needle lockstitch on knit hems; it snaps',
   'standard', 'Industry standard'),
  ('R-CON-008', 'construction', array['JSY-SS-01'],
   'Cuff K02',
   '1x1 rib cuff, 25 mm finished',
   'Holds the sleeve close to the arm, a retro look',
   'Rib cuffs add cost and a sewing step (R-COST-002)',
   'factory', 'Factory to confirm'),
  ('R-CON-009', 'construction', array['JSY-SS-01'],
   'Thread',
   'Needle: poly core-spun Tex 27; looper: textured poly Tex 18',
   'Polyester thread survives sublimation heat and washing; textured looper thread is soft and stretchy',
   'Cotton thread is never used on polyester sportswear',
   'standard', 'Industry practice'),
  ('R-SUB-001', 'print', '{}'::text[],
   'Fabric',
   'Only white polyester-rich fabric (85–100% polyester) is sublimated',
   'Sublimation dye only bonds with polyester; cotton and nylon don''t take it and colours wash out',
   'Want a dark base? Print it; the fabric is still white underneath',
   'standard', 'Process physics'),
  ('R-SUB-002', 'print', '{}'::text[],
   'Print files',
   '10 mm bleed beyond the cut line on every panel',
   'Panels shift slightly when cut; bleed means no white edges',
   'The editor adds bleed automatically; keep backgrounds running to the edge',
   'standard', 'Sublimation practice'),
  ('R-SUB-003', 'print', '{}'::text[],
   'Print files',
   '150 DPI at 1:1, sRGB, not mirrored; the factory''s RIP mirrors for transfer paper',
   '150 DPI is sharp at viewing distance on knit fabric; higher only makes files larger',
   'Upload vector logos (SVG/PDF) where possible; they stay sharp at any size',
   'factory', 'Factory to confirm their RIP settings'),
  ('R-SUB-004', 'print', '{}'::text[],
   'Seam crossings',
   'Artwork that crosses a seam can be offset by up to 3 mm after sewing; critical elements keep 15 mm away from seams',
   'Each panel is printed and cut separately, then sewn; sewing shifts panels slightly',
   'Stripes across seams are fine if a small offset is acceptable; crests, numbers and text are not',
   'standard', 'Sublimation practice'),
  ('R-SUB-005', 'print', '{}'::text[],
   'Colours',
   'Colours are checked against a printed strike-off; tolerance ΔE CMC(2:1) ≤ 1.5',
   'Screens can''t show printed colour exactly; the strike-off is the truth',
   'Pick club colours from the printed swatch book, not from the screen',
   'factory', 'Factory to confirm the tolerance they can hold'),
  ('R-SUB-006', 'print', '{}'::text[],
   'Fabric shrink',
   'Panels are printed oversize to allow for heat-press shrink (placeholder 1.5% length, 1.0% width)',
   'Polyester shrinks slightly in the press; without allowance the cut panels come out small',
   'Shrink % is measured per fabric roll batch by the factory',
   'factory', 'Factory to measure'),
  ('R-SUB-007', 'print', '{}'::text[],
   'Fine detail',
   'Minimum line 0.5 mm, minimum text 6 pt (2 mm cap height)',
   'Knit fabric texture breaks up finer detail',
   'Use bold fonts for small text',
   'standard', 'Sublimation practice'),
  ('R-SUB-008', 'print', '{}'::text[],
   'Black',
   'Rich black is the factory''s own black recipe, not 0/0/0 RGB',
   'Pure black in RGB prints brown or grey on many setups',
   'Use the "Kit black" swatch',
   'factory', 'Factory to confirm'),
  ('R-PER-001', 'personalisation', array['JSY-SS-01'],
   'Back name',
   '60 mm cap height, top 70 mm below the back neck, max 12 characters',
   'Readable from the stands and clear of the collar',
   'Use surnames in capitals; long names shrink to fit the zone',
   'knitwright', 'Knitwright draft'),
  ('R-PER-002', 'personalisation', array['JSY-SS-01'],
   'Back number',
   '220 mm high, top 150 mm below the back neck',
   'Standard size for adult football; readable for referees',
   'Children''s sizes use 180 mm (kids article)',
   'standard', 'Common competition practice; check league rules'),
  ('R-PER-003', 'personalisation', array['JSY-SS-01'],
   'Front number',
   '100 mm high, centre chest or wearer''s right chest',
   'Optional; must not clash with the crest and sponsor',
   'Leave it off if there is a large main sponsor',
   'knitwright', 'Knitwright draft'),
  ('R-PER-004', 'personalisation', array['JSY-SS-01'],
   'Method',
   'Names and numbers are printed in the same sublimation pass',
   'No extra layer to crack or peel, and no extra cost per piece',
   'Outline colours improve contrast on patterned backgrounds',
   'standard', 'Sublimation practice'),
  ('R-LAB-001', 'labels', '{}'::text[],
   'Neck label',
   'Heat-transfer or printed neck label; no sewn neck label',
   'Sewn labels scratch during sport',
   'Brands can add their logo to the neck print',
   'standard', 'Sportswear practice'),
  ('R-LAB-002', 'labels', '{}'::text[],
   'Care label',
   'Permanent care and fibre label in the wearer''s left side seam, 80 mm above the hem, with fibre content, care, origin and size per destination market',
   'UK and Australian law require fibre content and care information on the garment',
   'Labels are generated automatically per market',
   'standard', 'UK Textile Products regulations; Australian care labelling standard. Confirm with legal consult'),
  ('R-LAB-003', 'labels', '{}'::text[],
   'Finishes',
   'Only PFAS-free finishes',
   'PFAS ("forever chemicals") are being restricted in clothing in the EU and elsewhere',
   'Ask the fabric mill for a PFAS-free declaration',
   'standard', 'Regulation trend; supplier declaration'),
  ('R-QC-001', 'qc', '{}'::text[],
   'Every order',
   'Class A: every piece inspected. Runs: AQL 0 critical / 2.5 major / 4.0 minor at level II; measure POMs A, B, C, D, E, H, I',
   'Catching a fault before shipping costs far less than a remake',
   'Photograph front, back, labels and a seam close-up for every order',
   'standard', 'AQL standard (ISO 2859-1)'),
  ('R-QC-002', 'qc', '{}'::text[],
   'Print alignment',
   'Print across shoulder and side seams aligned within 3 mm',
   'Misalignment is the most visible defect on sublimated kit',
   'Check the side seams at the hem, where misalignment shows most',
   'knitwright', 'Knitwright draft'),
  ('R-COST-001', 'cost', '{}'::text[],
   'Sublimation',
   'Full sublimation costs the same whether the design is plain or busy',
   'The whole panel is printed either way',
   'Use colour and pattern freely; it doesn''t add cost',
   'standard', 'Process'),
  ('R-COST-002', 'cost', '{}'::text[],
   'Options',
   'Rib cuffs (K02), V-neck (C02) and drop tail add sewing time; prices come from the factory profile',
   'Each adds an operation on the line',
   'Choose them for looks, not by default',
   'factory', 'Factory price list'),
  ('R-COST-003', 'cost', '{}'::text[],
   'Personalisation',
   'Names and numbers cost $0.80–1.80 per piece at the factory (placeholder) and are included in Knitwright''s club price',
   'They are printed in the same pass, but each piece needs its own file and checking',
   'Collect rosters early; late changes delay the batch',
   'factory', 'Supplier price lists, May 2026; replace with partner quote')
) as v(rule_id, topic, article_codes, title, rule, body, best_practice, source, source_note);
