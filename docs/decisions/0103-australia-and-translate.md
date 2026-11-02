# 0103. Australia and Translate: the AUD ladder, the GST trigger as data, Australia's label rules, the Australian starters, and the tech pack in Urdu

Status: Proposed; no AUD price, no care symbol and no reviewed translation exists, so each is a named gap with an owner question.
Index: Proposed; the AUD prices, the care line and the Urdu review are named gaps, not figures

Plan: `plans/platform-v5.md`, wave 5, workstream **O3**. Features **F-S6** ("Translate"), **F-S8** (the market and
currency selector) and `docs/spec/06-build-plan.md` phase 3 items 12 and 13.
Continues decision 0071 (the factory model as data), 0078 (the tech pack PDF and the Export panel), 0089 (compliance
and pre-export) and 0098 (the template library).

Migration: `supabase/migrations/20261210030000_australia_and_translate.sql` (wave 5's date, the next free hour: O1
took `20261210010000` and the bill-of-materials work `20261210020000`).

---

## 1. The AUD ladder is the bands that exist, with no price written in them

**Decided: `price_tiers.sell_aud_minor` stays null on every tier, the three tiers keep their quantity bands, and
every row's label says that no AUD price is set and why. Nothing converts the GBP figure.**

`docs/spec/01-product-direction.md` gives one price ladder: a **GBP** target club price of £29 / £25 / £22 across the
10-19, 20-49 and 50+ bands, itself a build-pack placeholder that no factory has quoted. There is no AUD figure
anywhere in this repository, and the research note's only Australian money is a 5% duty and a GST threshold.

So the AUD ladder is the same three quantity bands — they are the ladder's shape, and that *is* on file — with no
price in them. `lib/factory/pricing.ts` already answers `not-set` for a tier with no price in the currency asked for,
and `lib/markets/view.ts` turns that into a line a person reads: *"No AUD price is set in any tier. The ladder's
quantity bands are on file; the prices for Australia are not."*

**A converted price was considered and refused.** An exchange rate would produce a plausible A$56.20, which reads as
a price somebody agreed, and a sell price per market is a commercial decision — margin, freight, duty, what an
Australian club will pay — not an arithmetic result. `view.test.ts` holds that line: no digit appears in an unpriced
AUD row, so no test can pass while a converted figure leaks in.

**Owner question 1 (money, so the owner's and not the orchestrator's): what is the AUD club price ladder?** Until it
is answered, nothing can be sold in Australia at a price the platform will show.

## 2. The GST trigger is four columns on `country_rules`, not a literal

**Decided: `tax_name`, `tax_registration_threshold_minor`, `tax_registered` and `tax_source` on `country_rules`,
seeded for Australia from the one figure a source here states, and editable at `/ops/factories` without a deploy.**

- Australia: `GST`, threshold **AUD 75,000** of sales, `tax_registered false`, source
  `docs/spec/research/Knitwright platform validation.md`, which cites William Buck for "offshore sellers register for
  GST above AUD 75,000 in sales". The 10% rate was already in `vat_rate_bp`, seeded by X6 as a placeholder.
- The United Kingdom: `VAT`, no threshold, because `docs/spec/02-features.md` says VAT is charged at checkout for the
  UK and names no registration threshold. Inventing £90,000 from memory is exactly the invented figure the rules
  forbid.
- The United States and the European Union are left alone: both are closed at launch and nothing here states either
  market's treatment.

Two rules hold whatever the row says, and `lib/markets/tax.ts` is where they live:

1. **Nothing is shown as charged while the row says nobody is registered.** F-T5's checkout line is "GST for
   Australia *once registered*", and nobody has registered, so Australia's line reads *"Prices carry no GST:
   Knitwright is not registered for GST in Australia. GST of 10% applies once it is."*
2. **A missing figure is named, never filled in.** No rate, no threshold and no source each read as what they are.
   No rulebook entry covers a tax, so every tax finding carries **`R-GAP-000`**.

A database check refuses a threshold with no source (`country_rules_threshold_has_a_source`): a figure nobody can
trace is the thing this workstream exists to avoid.

**Owner question 2: has Knitwright registered for GST in Australia, and is the AUD 75,000 threshold the right one
for a UK entity selling into Australia?** A tax adviser's answer, not a research note's.

## 3. Australia's label rules: everything sourceable, and the care line still refused — in the row's own words

**Decided: Z8's AU lines are kept exactly as they are; what is added is the reason the care line is refused, as data
on the market's row (`label_rules.lines.care.gapNote` and `gapRuleId`).**

Z8 (decision 0089) had already written Australia's fibre line (English, descending percentage, citing rulebook
R-LAB-002 in draft), the origin sentence ("Made in Pakistan", citing `docs/spec/04-production-package.md` section
`07_labels`) and the size convention (one label per size, carrying the garment's own size code, citing
`docs/sizing/starter-charts.md`). Those are every part of an Australian label that a source in this repository
states, and they are untouched.

**ISO 3758 is a paid standard and is not in this repository.** No care symbol has been transcribed, redrawn,
reconstructed or written down from memory, here or anywhere else; the five `care_symbols` rows are the standard's
five categories with `symbol_ref` and `words` null, and `lib/compliance/labels.ts` prints a care line only from a row
that has a symbol, words and a source. So Australia's care line is refused, exactly as the United Kingdom's is.

What changes is **where the refusal's words live**. Until now the sentence was a string in `lib/compliance`; now each
market's row carries it, so a market whose position changes changes its row rather than this directory:

> ISO 3758 is a paid standard and is not in this repository, so no care symbol has been transcribed, redrawn or
> written down from memory. The care line is refused until somebody with a licensed copy writes each symbol, its
> words and its source into `care_symbols` and names them on this market's row.

The **importer line is still unrecorded** (`required` null), because nothing in this repository says whether
Australia requires a supplier or importer identity on a garment label. `lib/compliance` already treats that as a
warning with `R-GAP-000` rather than a refusal, for the reason written there: F-G2's list of what a label must carry
is "fibre content, care, origin, size", and missing owner input never blocks.

**Owner question 3: buy a licence for ISO 3758 (or get the care wording from the factory's own licensed copy) so a
care label can exist at all.** Nothing sells in any market until this is answered.
**Owner question 4: does Australia require an importer or supplier identity on the label, and in what words?**

## 4. The Australian starters sit beside `07`'s sixty, not inside them

**Decided: eight starters — three Australian football, three netball, two Australian club cricket — seeded by
`lib/templates/seed/australia`, counted on their own, with `allSeedTemplates()` left at exactly the 60 of
`docs/spec/07-template-library.md`.**

`07`'s table and its launch count are a UK-first library, and L8 filled them exactly (decision 0098). Growing that
count to 68 would make `07`'s own figure untrue. So `seed.ts` writes `everySeedTemplate()` — the 60 plus these eight
— and `launch/build.test.ts` still holds `allSeedTemplates()` to 60. Every Australian row is `kind = 'design'` with
its `article_id` and `wearer` set, which is what the constraint L4 added requires of a design row.

Two gaps are named rather than filled in:

- **No garment for either sport.** An Australian football guernsey is sleeveless and a netball dress is a dress; the
  registry has neither, and `06-build-plan` lists a netball dress under "more base articles" for later. The starters
  therefore sit on the team jersey, the V-neck and crew tees and the shorts, and each title says which sport it is
  for. Drawing a guernsey or a dress would mean inventing a block nobody has drafted (decision 0090's rule).
- **No sport tag for either sport.** `07`'s closed tag set is football, cricket, training, esports, running / gym and
  combat. Neither Australian football nor netball is one of them, and widening a vocabulary and a check constraint
  another workstream owns is not this one's to do. The two cricket starters carry the `cricket` tag; the other six
  carry none, exactly as the esports and combat starters did before a tag existed for them, and search finds them by
  the sport in their title.

**Owner question 5: should `sport_tags` gain `afl` and `netball`, and should the registry gain a sleeveless guernsey
and a netball dress?** Both are catalogue decisions, not this workstream's.

## 5. The tech pack in Urdu: Noto Naskh Arabic under the OFL, and why not Nastaliq

**Decided: the Urdu pages are set in Noto Naskh Arabic, licensed under the SIL Open Font License 1.1, which permits
embedding in a PDF. The file ships at `apps/web/assets/fonts/NotoNaskhArabic-Regular.ttf` with its licence beside it,
exactly as Geist does.**

Noto Nastaliq Urdu — also OFL, and the face Urdu readers expect for running text — **cannot be used here**. It is not
a licensing problem and not a taste problem: `fontkit@2.0.4`, which `@react-pdf/renderer@4.9.0` lays text out with,
throws while placing that font's mark anchors —

```
TypeError: Cannot read properties of null (reading 'xCoordinate')
    at GPOSProcessor.getAnchor (fontkit/dist/src/opentype/GPOSProcessor.js:289:20)
```

— so a document set in it has no pages at all. Naskh shapes Urdu correctly and is legible; it is a Naskh face rather
than a Nastaliq one, which an Urdu reader will notice. That is the honest second choice, and it beats both of the
alternatives: shipping nothing, and shipping Urdu drawn in a Latin font, which `pdf-text.ts` would turn into a line
of question marks (`urdu.test.ts` proves it would).

**Owner question 6: should Nastaliq be made to work — by pinning a `fontkit` that places its anchors, by
pre-shaping the text, or by a different renderer — or is Naskh acceptable on a factory floor?** Worth asking the
factory, who are the only people who will read it.

### How the document is set right to left

`@react-pdf/layout@5.2.0` reads `direction: 'rtl'` from a style, reorders the run with `bidi-js` and aligns it to the
right; `fontkit` shapes the Arabic script from the font's own tables. So the layout is genuinely right to left and not
left-to-right text in another font: `urdu.test.ts` reads the finished PDF back and asserts that the first text run on
every page starts beyond the middle of the paper, and that the same pack in English starts at the left margin on every
page.

One value carries the font, the direction and the words together (`exports/pdf/typeset.ts`), because the three cannot
be separated: a character is drawable only in a particular font, a font belongs to a script, and a script reads one
way or the other. Every string in the document already passed through `safe`, so `Safe` grew the font and the
direction rather than every call site growing a parameter. The garment drawing keeps the Latin font — `lib/flat`
draws its own labels in it — so the drawing's text is made safe against that font and not the document's.

### What is translated, and what is not

Translated: the title of each of the eighteen pages, the six fields of the header block, the footer, the words for a
value nobody has filled in, and the two notices. **Not** translated: the explanatory line under each page title, the
column headers of the tables, and every word a person typed into the design — a tech pack is mostly the last of
those, and translating a person's own words would change what they wrote. `notice.scope` says so on the first page,
so nobody on a factory floor has to work out which half of a page is which.

## 6. A translation is a claim about meaning, so every string names who read it

**Decided: `translation_strings`, one row per key per language, carrying who or what produced the words, whether a
machine produced them, and the name, role and day of the person who read them against the English.**

- `reviewed_by` is **null on every seeded row**. The Urdu words are a Knitwright draft that no Urdu speaker has read.
  The seed's insert names no reviewer column at all, which `strings.test.ts` checks.
- A review records the person, their role and the day, as a factory confirmation does (owner decision 14):
  `translation_review_names_a_person` refuses two of the three.
- **A machine translation is never recorded as reviewed.** `machine_translation_is_never_reviewed` refuses a row with
  `machine true` and a reviewer; when a person checks a machine's words, the row is written again with their name and
  `machine false`. `dictionaryFor` enforces the same rule in code, so a row that somehow claimed both would still
  read as unreviewed.
- The translation service is an **interface with a deterministic stub** that says it is not available. Nothing calls
  anything. Whatever a service returns is a proposal with `machine: true` and `reviewedBy: null`, which
  `dictionary.test.ts` holds it to.

An unreviewed translation is labelled **wherever it appears**: the Export panel's own label says "Nobody has read the
translation" before the file is downloaded, the file is named `…-tech-pack-ur.pdf` so two copies of one pack cannot be
confused, and every page of the PDF carries the notice as a *fixed* element, so it repeats on every sheet of paper a
long page runs onto.

**Owner question 7: have an Urdu speaker — the factory's own floor supervisor is the obvious person — read the 29
strings and put their name against them.** Until then every page says the translation has not been read.

## 7. Choosing a market shows what choosing it means

**Decided: `lib/markets` and one panel on the article page, beside the UK | GBP / AU | AUD selector F-S8 asks for.**

The selector used to change the currency a price was shown in and nothing else. It now shows, for the market chosen:
the currency; the tax treatment and whether it is being charged; what the price ladder is in that currency; which
label lines a garment sold there may carry and why each other one cannot; and **what is still missing before a date
can be promised**. Every line carries a `ruleId` that resolves to a rulebook entry, or `R-GAP-000`.

**No delivery date is shown anywhere**, because QC days and freight days are both unset: the panel says *"No delivery
date yet. Not set: the days for QC and the freight days."* That is `lib/factory/dates.ts`'s own wording, not a second
copy of it.

## 8. Rule ids used, and the `R-GAP-000` list

- `R-LAB-002` (the care label entry, seeded in draft by X2) explains every label line and the care refusal.
- **`R-GAP-000`** is carried by: every tax finding (no rulebook entry covers VAT, GST, a registration threshold or
  whether a seller is registered); the importer-requirement warning, as Z8 left it; the delivery-date gap; every
  seeded `translation_strings` row (no entry covers a translation); and the three Australian template gaps.

## 9. Dependencies

No dependency was added. The Urdu font is a file in `assets/fonts`, taken from
`@expo-google-fonts/noto-naskh-arabic@0.4.5` (`MIT AND OFL-1.1`), which ships the upstream Noto TTF; the font itself
is **SIL Open Font License 1.1**, copied to `assets/fonts/NotoNaskhArabic-LICENSE.txt`, and the OFL permits embedding
in a document. `@fontsource/noto-naskh-arabic` was considered and refused: it ships WOFF only, and both the PDF
library and `pdf-text.ts` need an sfnt.

## 10. What is left

- No AUD price, so nothing can be sold in Australia at a shown price (question 1).
- No care label in any market, so no export passes the F-G2 checklist (question 3).
- No reviewed Urdu, so every Urdu page says the translation has not been read (question 7).
- The explanatory lines, the table headers and the design's own words are not translated, and the page says so.
- No sleeveless guernsey and no netball dress in the registry (question 5).
- GST is not charged, because nobody is registered (question 2).
