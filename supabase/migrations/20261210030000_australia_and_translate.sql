-- Australia and Translate (plans/platform-v5.md wave 5, workstream O3; spec docs/spec/06-build-plan.md
-- phase 3 items 12 and 13; decision 0104).
--
-- Four things, none of them a number somebody made up:
--
--   1. The AUD half of the price ladder. `price_tiers.sell_aud_minor` has existed since X6
--      (20261101050000_factories.sql) and is null on all three club tiers, because the build pack
--      (docs/spec/01-product-direction.md) gives a GBP target ladder and no AUD one. No figure is written
--      here: the three rows keep their quantity bands, which are the AUD ladder's bands too, and their
--      labels now say that the AUD price is not set and why. `lib/factory/pricing.ts` already answers
--      "not-set" for a tier with no price in the currency asked for, and `lib/markets` shows that state
--      beside the market selector. Nothing anywhere converts the GBP figure into AUD: a sell price per
--      market is a commercial decision, not an exchange rate, and a converted price would read as one
--      somebody had agreed.
--
--   2. The GST trigger, as data. Four columns on `country_rules`: which tax the market charges, the sales
--      figure above which the seller has to register for it, whether Knitwright is registered, and where
--      the figure came from. Australia's AUD 75,000 is the one figure a source in this repository states
--      (docs/spec/research/Knitwright platform validation.md, citing William Buck); it is seeded with that
--      source and `tax_registered false`, because nobody has registered. The United Kingdom's row names
--      VAT with no threshold, because none is recorded here. The two closed markets are left alone.
--
--   3. Australia's label rules. Z8 (20261120070000_compliance.sql, decision 0089) already seeded the AU
--      row's fibre line (English, descending percentage), the origin sentence ("Made in Pakistan") and the
--      size convention, and left the care line and the importer requirement empty. This migration adds the
--      one thing that was missing from the refusal: the reason, as data. ISO 3758 is a paid standard, is
--      not in this repository, and so no care symbol has been transcribed; until now that sentence lived
--      only in `lib/compliance`, and a market's row could not say why its care line was refused. It can
--      now, and `lib/compliance/labels.ts` prints the row's own words. NO CARE SYMBOL AND NO CARE
--      INSTRUCTION IS TRANSCRIBED, REDRAWN OR GUESSED AT HERE OR ANYWHERE ELSE, and the importer
--      requirement stays unrecorded, because no source in this repository states it.
--
--   4. The translation strings, with the person who checked each one. `translation_strings` holds one row
--      per key per language, with who or what produced it, whether a machine produced it, and the name,
--      role and date of the person who read it against the English. The Urdu rows seeded here are a
--      Knitwright draft that no Urdu speaker has read: every one has `reviewed_by` null, `machine false`
--      (a person wrote them, not a translation service) and a label that says so, and a check refuses a
--      machine translation that claims a reviewer. The tech pack PDF prints the notice on every page it
--      sets in Urdu.
--
-- Rights follow `country_rules` (decision 0071): catalogue data every signed-in member may read, written
-- only by the server's key. rule_id: every row says which rulebook entry explains it. R-LAB-002 is the care
-- label entry and R-COST-003 the club price one, both seeded in draft by 20261101020000_rulebook.sql. A
-- value no entry covers is 'R-GAP-000', and the pull request lists each one.

-- ---------------------------------------------------------------------------------------------
-- 1. The AUD ladder: the bands that exist, with no price written for them.

update public.price_tiers set
  sell_aud_minor = null,
  label = 'Placeholder club price from the build pack, not a factory quote. No AUD price: the build pack gives GBP only.',
  updated_at = now()
where sell_gbp_minor is not null and sell_aud_minor is null;

comment on column public.price_tiers.sell_aud_minor is
  'What Knitwright sells at in Australia, per piece, in cents. Null: no AUD price has been agreed (decision 0104). Never computed from the GBP price: a market''s price is a commercial decision, not an exchange rate.';

-- ---------------------------------------------------------------------------------------------
-- 2. The tax treatment of a market, as data rather than a literal in code.

alter table public.country_rules
  -- Which tax the market charges on a sale. Null: not recorded.
  add column tax_name text check (tax_name in ('VAT', 'GST')),
  -- The sales figure above which the seller has to register for that tax, in minor units of the market's
  -- own currency. Null: none is recorded. This is not the import low-value threshold, which has its own column.
  add column tax_registration_threshold_minor bigint
    check (tax_registration_threshold_minor between 0 and 1000000000000),
  -- Whether Knitwright is registered for that tax in that market. False everywhere: nobody has registered.
  add column tax_registered boolean not null default false,
  add column tax_source text check (length(tax_source) <= 300),
  -- A threshold says where it came from. A figure with no source is the invented number the rules forbid.
  add constraint country_rules_threshold_has_a_source
    check (tax_registration_threshold_minor is null or tax_source is not null);

comment on column public.country_rules.tax_name is 'VAT or GST: which tax this market charges on a sale. Null: not recorded.';
comment on column public.country_rules.tax_registration_threshold_minor is
  'The sales figure above which the seller must register for that tax, in minor units of this market''s currency. Null: not recorded. Not the import low-value threshold.';
comment on column public.country_rules.tax_registered is
  'Whether Knitwright is registered for that tax in this market. False everywhere until someone registers; no screen may show tax as charged while it is false.';

-- Australia. AUD 75,000 is the one figure a source in this repository states, and it is a research note
-- citing an accountancy firm, not advice Knitwright has taken, so the row says so and is not confirmed
-- anywhere. The 10% GST rate is already in vat_rate_bp, seeded by X6 as a placeholder.
update public.country_rules set
  tax_name = 'GST',
  tax_registration_threshold_minor = 7500000,
  tax_registered = false,
  tax_source = 'docs/spec/research/Knitwright platform validation.md, citing William Buck: offshore sellers register for GST above AUD 75,000 in sales. Confirm with a tax adviser.',
  updated_at = now()
where country = 'AU';

-- The United Kingdom. The spec says VAT is charged at checkout for the UK (docs/spec/02-features.md,
-- Checkout) and names no registration threshold, so none is written.
update public.country_rules set
  tax_name = 'VAT',
  tax_registered = false,
  tax_source = 'docs/spec/02-features.md, Checkout: VAT is charged at checkout for the United Kingdom. No registration threshold is recorded in this repository.',
  updated_at = now()
where country = 'GB';

-- The United States and the European Union are closed at launch (spec decision 3) and nothing in this
-- repository states either market's tax treatment, so both are left as they were.

-- ---------------------------------------------------------------------------------------------
-- 3. Why a care line is refused, in the market's own row.
--
-- The same two sentences for every market, because the reason is the same everywhere: ISO 3758 is a paid
-- standard and nobody has a licensed copy to transcribe from. `lib/compliance/labels.ts` prints these words
-- in the finding instead of a sentence of its own, so a market whose position changes changes its row.
-- jsonb_set adds the two keys and leaves every line Z8 seeded exactly as it was.

update public.country_rules set
  label_rules = jsonb_set(
    jsonb_set(
      label_rules,
      '{lines,care,gapRuleId}',
      '"R-LAB-002"'::jsonb,
      true
    ),
    '{lines,care,gapNote}',
    to_jsonb(
      (
        'ISO 3758 is a paid standard and is not in this repository, so no care symbol has been transcribed, '
        || 'redrawn or written down from memory. The care line is refused until somebody with a licensed copy '
        || 'writes each symbol, its words and its source into care_symbols and names them on this market''s row.'
      )::text
    ),
    true
  ),
  updated_at = now()
where label_rules ? 'lines';

-- ---------------------------------------------------------------------------------------------
-- 4. The translation strings, each with the person who read it.

create table public.translation_strings (
  id uuid primary key default gen_random_uuid(),
  -- A dotted key, such as 'page.overview'. The keys are mirrored in lib/translate/keys.ts.
  key text not null check (key ~ '^[a-z][a-z0-9]*(\.[a-z0-9][a-z0-9-]*)+$' and length(key) <= 120),
  -- BCP 47.
  language text not null check (language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  text text not null check (length(btrim(text)) between 1 and 400),
  source_language text not null default 'en' check (source_language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  -- Who or what produced these words.
  translated_by text not null check (length(btrim(translated_by)) between 1 and 120),
  -- True when a translation service produced them. A machine translation is never recorded as reviewed:
  -- when a person checks one, the row is written again with their name and machine false.
  machine boolean not null default false,
  -- The person who read the translation against the English, their role and the day they read it.
  -- Null: nobody has, and every screen and every page says the translation is not reviewed.
  reviewed_by text check (length(btrim(reviewed_by)) between 1 and 120),
  reviewed_role text check (length(btrim(reviewed_role)) between 1 and 120),
  reviewed_on date,
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]+-[0-9]{3}$'),
  label text not null check (length(btrim(label)) between 1 and 300),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (key, language),
  -- A translation is into another language than the one it came from.
  check (language <> source_language),
  -- A review records the person, their role and the day, as a factory confirmation does (owner decision 14).
  constraint translation_review_names_a_person check (
    (reviewed_by is null) = (reviewed_on is null) and (reviewed_by is null) = (reviewed_role is null)
  ),
  -- A machine translation is never marked as reviewed.
  constraint machine_translation_is_never_reviewed check (not machine or reviewed_by is null)
);

comment on table public.translation_strings is
  'The fixed words of the platform in another language, one row per key per language, with who produced it and who read it against the English. Read by signed-in members, written by the server only (decision 0104).';
comment on column public.translation_strings.reviewed_by is
  'The person who read this translation against the English. Null: nobody has, and every page that shows it says so.';

create index translation_strings_language_idx on public.translation_strings (language, key);

revoke all on public.translation_strings from public, anon, authenticated, service_role;
grant select on public.translation_strings to authenticated;
grant select, insert, update on public.translation_strings to service_role;

alter table public.translation_strings enable row level security;

create policy "members read translation strings"
  on public.translation_strings for select to authenticated
  using (exists (select 1 from public.memberships m where m.user_id = (select auth.uid())));

-- There are no insert, update or delete policies on purpose.

-- ---------------------------------------------------------------------------------------------
-- Seed: the Urdu words of the tech pack's own furniture (spec F-S6 Translate, phase 3 item 12).
--
-- What is translated: the page titles, the header field labels, the footer, the words for a value nobody
-- has filled in, and the two notices the Urdu pages carry. What is NOT translated: the explanatory line
-- under each page title, the table column headers, and every word a person typed into the design, which
-- stays exactly as they typed it. notice.scope says so on the page, so a reader on the factory floor is
-- never left guessing which half of a page is which.
--
-- Every row is a Knitwright draft that no Urdu speaker has read. reviewed_by is null on all of them,
-- machine is false (a person wrote them; no translation service was called), and the label says so. The
-- renderer refuses to print an Urdu page without the notice, so an unreviewed translation can never leave
-- the building looking settled.

insert into public.translation_strings (key, language, text, translated_by, machine, rule_id, label) values
  ('page.overview', 'ur', 'جائزہ', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('page.technical-flats', 'ur', 'تکنیکی خاکے', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('page.colour-views', 'ur', 'رنگین مناظر', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('page.bom-fabrics', 'ur', 'اجزاء کی فہرست: کپڑے', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('page.bom-parts', 'ur', 'اجزاء کی فہرست: رِب، دھاگہ، ٹرم اور لیبل', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('page.construction', 'ur', 'سلائی کی تفصیلات', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('page.construction-annotations', 'ur', 'سلائی کی نشان دہی', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('page.measurement-annotation', 'ur', 'پیمائش کی نشان دہی', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('page.size-grading', 'ur', 'سائز گریڈنگ', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('page.graphics', 'ur', 'گرافکس اور پرنٹ', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('page.print-placement', 'ur', 'پرنٹ کی جگہ', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('page.personalisation', 'ur', 'نام اور نمبر', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('page.labels-packaging', 'ur', 'لیبل اور پیکنگ', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('page.colourways', 'ur', 'رنگوں کے امتزاج', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('page.qc', 'ur', 'کوالٹی جانچ کی فہرست', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('page.reference-images', 'ur', 'حوالہ تصاویر', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('page.sources-and-notes', 'ur', 'حوالے اور نوٹس', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('page.confirm-and-sign-off', 'ur', 'باقی تصدیق اور دستخط', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('field.brand', 'ur', 'برانڈ', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('field.style', 'ur', 'اسٹائل', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('field.style-number', 'ur', 'اسٹائل نمبر', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('field.season', 'ur', 'سیزن', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('field.base-size', 'ur', 'بنیادی سائز', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('field.version', 'ur', 'ورژن', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('footer.page', 'ur', 'صفحہ', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('footer.of', 'ur', 'از', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('value.to-be-confirmed', 'ur', 'ابھی طے نہیں', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('notice.unreviewed', 'ur', 'یہ اردو ترجمہ کسی اردو بولنے والے نے نہیں پڑھا۔ جہاں دونوں نقلوں میں فرق ہو، انگریزی نقل پر عمل کریں۔', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.'),
  ('notice.scope', 'ur', 'صرف صفحات کے مستقل الفاظ اردو میں ہیں۔ ڈیزائن میں لکھے گئے الفاظ، جدولوں کے عنوان اور تفصیلی جملے انگریزی میں ہی ہیں۔', 'knitwright-draft', false, 'R-GAP-000',
   'Knitwright draft. No Urdu speaker has read this translation.');
