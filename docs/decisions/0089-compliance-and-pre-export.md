# 0089: Compliance and pre-export unification

Status: Proposed. Every label line the platform can print today comes from a row that cites a source in this repository; the
care symbols, the size wording and the importer requirement are not written, and the gate refuses because of it. The two new
tables are seeded as labelled defaults. Owner questions below.
Date: 2026-10-30
Plan step: platform v5, wave 3, Z8 (`plans/platform-v5.md`). Spec: F-G2 and F-G3 (`docs/spec/02-features.md`), the Review tab
and the Labels & packaging tab of the tech pack view, `docs/spec/04-production-package.md` section `07_labels`. Builds on
0067 (the rulebook), 0070 (the production package and its own F-G2 gate), 0071 (the factory model as data), 0073 (moderation)
and 0080 (the make flow).

## Context

Two features and one duplication.

**F-G2** asks for "a deterministic checklist before export or order": no field still needing input and no `[TBC]`, points of
measure complete, bill of materials complete, labels present per destination market, colour inside the gamut, DPI, bleed, and
moderation `clear`. The tech pack's Review tab is specified as "Every field still 'Needs your input', plus the F-G2 pre-export
check. Export is blocked until clear". The production package has the same list, and so does ordering.

By the time wave 3 started, that list existed **twice**: `lib/kpp/gate.ts` (decision 0070) checked it over the package input,
and the make flow checked a different, smaller set of things over a run. Two copies of one checklist is two copies that can
disagree about whether the same garment is ready, and the Review tab had neither of them.

**F-G3** asks for PFAS-free finishes only, OEKO-TEX Standard 100 fabrics where available, fibre and care labels generated per
destination market, and US and children's sizes blocked until CPSIA testing exists. Decision 0070 recorded that the wording
had nowhere to live: X6 seeded `country_rules.label_rules` as `{}` with a note saying it was still to be written, and
"the care-label wording per market" and "the AQL plan per factory" were two of the three tables it listed as still owed.

## Decision

### 1. One checklist, one subject, three adapters

`lib/compliance/checklist.ts` holds `preExportCheck`, the only F-G2 checklist. It reads one shape,
`PreExportSubject` (`subject.ts`), and runs one list of items (`items.ts`) in the order the spec lists them. The three places
that need it each have an adapter that turns their own data into that shape, and nothing else:

| Place | Adapter | What it is given |
|---|---|---|
| Tech pack Review tab | `from-techpack.ts` | the `TechPack` document, plus the labels, the moderation state, the class and the factory's agreed colour difference |
| Production package | `from-package.ts` | decision 0070's `KppInput`, plus the same |
| Ordering | `from-order.ts` | the subject already built from the document, plus the markets this order's pieces go to |

A caller cannot weaken an item, because an item reads only the subject; and a field the subject cannot express is a field no
checklist item checks, which is deliberate.

Ordering is built **from the document's own subject**, not from a fourth source. That is what makes the three agree: a design
the Review tab calls clear cannot fail at hand-off for a reason Review never showed, and the only new refusals at hand-off are
the ones an order is the first to know about — which market the pieces go to, and whether a person has looked at the design.
`from-order.test.ts` asserts it.

**The package's own gate stays, for now.** `lib/kpp/gate.ts` is X5b's file and not Z8's to edit. So
`from-package.test.ts` is written as a parity proof instead: over the worked article `JSY-SS-01` and one mutation per check,
both gates refuse, and over the unmutated article both pass. Whoever deletes the copy reads that file first. The one place the
new checklist is **stricter** is labels, and the test says so: the package's gate reads already-flattened label text and is
satisfied by it, while the checklist reads the market's rows and finds the care symbols nobody has written.

### 2. A label line is printed only from a row that says where its words came from

`lib/compliance/labels.ts` builds one label per destination from `country_rules.label_rules`, the fabric's
`programme_fabrics` row and the `care_symbols` rows. Every line carries `text` **and** `source`, and a line missing either is
not printed: it becomes a finding with a rule id, and the checklist refuses the export.

This is the rule the whole workstream turns on. A care label is the one page of a tech pack a factory copies verbatim onto a
garment somebody then wears and washes. A plausible-sounding care instruction that nobody sourced would leave the building and
come back as a ruined garment or a regulator's letter. So:

- the **fibre** line takes the market's own wording where it has one, and otherwise the fabric row's blend, saying which row
  it came from — but only where the market states the language and the order it needs the fibre content in;
- the **care** line is printed only from `care_symbols` rows that have a symbol reference, words **and** a source, all three;
- the **origin** line is `label_rules.origin`, which the seed sets to "Made in Pakistan" citing
  `docs/spec/04-production-package.md` section `07_labels`;
- the **size** line needs the market's size-designation wording, which nobody has written, so it is never printed;
- the **importer** line distinguishes "this market does not require one" from "nobody has recorded whether it does". The
  second is a refusal, not a pass.

`labels.test.ts` and `tests/integration/compliance.test.ts` both assert the invariant directly: over the seeded rows, an empty
`label_rules` column and a fully written market, every printed line has a non-empty source and non-empty words, and the seeded
state prints nothing at all.

### 3. PFAS, OEKO-TEX, the United States and children's sizes (`guards.ts`)

- **PFAS-free only (R-LAB-003).** A fabric whose row says `pfas_free = false` is refused. A fabric nobody has declared either
  way is **also** refused, with "Ask the mill for a PFAS-free declaration". Null is not clean. Today that refuses all six
  seeded fabrics, correctly: the X6 seed sets `pfas_free` on none of them.
- **OEKO-TEX where available.** The certification line appears only where that fabric's row holds a certificate, and a fabric
  with none gets no line and no finding. No row holds one today, so no label claims one. Claiming a certificate a fabric does
  not hold is the one mistake that matters here, and there is a test for it.
- **The United States and children's sizes, blocked until CPSIA testing exists.** Taken at its word. Nothing in the platform
  holds a CPSIA test certificate, so a market whose row says CPSIA is required is refused, and a garment made for `youth`
  sizes is refused **wherever** it is sold. A market whose row does not say whether CPSIA applies is a warning, not a pass.
- **A closed market is refused.** `country_rules.selling_enabled` is false for US and EU, so those labels are built and
  refused, which is more useful than not building them.

### 4. The Class B human review is a block; the 50 to 300 piece range is not in this workstream

These are two different rules and they are easy to confuse, so both are named in `review.ts` and in the code comment on the
checklist item.

- **The human review is a genuine block.** F-G1 asks for a person to look at the design before any Class B run, and a person
  either has or has not. `classBReviewFinding` refuses while `humanAllowed` is false, and refuses while it is null, because
  "nobody has been asked" is not "somebody said yes". X8 holds the same rule against the store in `assertHumanReviewed`; this
  is the checklist's copy over an already-read value, so the Review tab can show it before anyone presses anything.
  `assertHandOffAllowed` throws at the act, over the whole checklist and not only this item: a package that may not be built
  is a run that may not be cut.
- **The 50 to 300 piece range is a flag, not a refusal**, as the orchestrator settled, matching the brand-run builder of
  decision 0062. Refusing a run of 400 pieces would assert that a factory will not make 400 of a style, which no factory has
  confirmed. **Nothing in `lib/compliance` looks at a quantity at all**, and a test asserts that the word "piece" does not
  appear in a checklist result. Y7 shipped the range as a refusal in `lib/make/run.ts` and in `public.submit_make_order`; both
  are the orchestrator's to change and neither is touched here.

### 5. The two tables decision 0070 left owed, seeded as labelled defaults

`supabase/migrations/20261120070000_compliance.sql`. Rights follow `country_rules` (decision 0071): every signed-in member
reads them, only the server's key writes them, and no insert, update or delete policy exists.

- **`care_symbols`**, the ISO 3758 symbols. **ISO 3758 is not in this repository and is a paid standard, so no symbol and no
  care instruction is transcribed.** What is seeded is the five categories the standard is built from, each citing
  `ISO 3758:2012` for the category and nothing more, with `symbol_ref` and `words` null and `confirmed` false. The table's own
  checks refuse words with no source behind them, and refuse a `confirmed` row that is not a whole row — so the database
  cannot hold an unsourced care instruction even if someone tried to write one. Until the owner transcribes the symbols from a
  licensed copy, every care line is refused and the finding says why.
- **`aql_plans`**, the AQL plan per factory (`factory_id` null means every factory). One row is seeded: owner decision 19's
  Class A sample, `inspect_every_piece = true`, citing owner decision 19 and decision 0070 section 6, under `R-QC-001`.
  **No run plan is seeded.** Decision 0070 section 6 settled that `docs/spec/04`'s "level II, AQL 0 critical / 2.5 major /
  4.0 minor" is never assumed on a factory's behalf, and that holds: the table check refuses a level with no source behind it.

**`country_rules.label_rules` is seeded with what a source in this repository states, and nothing else.** For the United
Kingdom and Australia: the fibre line's language and order, citing rulebook `R-LAB-002` (draft), whose own source note reads
"UK Textile Products regulations; Australian care labelling standard. Confirm with legal consult"; and the origin sentence
"Made in Pakistan", citing `docs/spec/04-production-package.md` section `07_labels`. The care symbols, the size wording and
the importer requirement are left null. For the United States, `cpsiaRequired` is true, citing F-G3, and no wording at all.
For the European Union, nothing: fibre content must be in the languages of the member state of sale, and which languages, in
what order, is recorded nowhere here.

The seed keeps the flat `origin` key that `lib/kpp/input/labels.ts` already reads, beside the `lines` block that
`lib/compliance` reads, so one seed improves the package's existing label path without that file being edited.

### 6. `lib/techpack/labels.ts` gains the Labels & packaging tab, and keeps `panelLabelOf`

The tab shows one section per market, with a row for **every** line kind, so a market with no care wording shows an empty Care
row rather than leaving a reader to notice that a line is absent, plus one sentence saying why the label may not be used and
the market row's own provenance label.

A row's value is `string | null` and not a `Cell`. A `Cell` carries a `Provenance`, and none of that enum's words is true of a
line generated from a market rule and a standard: "Worked out from other values" would read as Knitwright's own derivation of
what is in fact a regulation. So each row carries its source as the quoted text the row holds. Inventing a provenance word
would have been the same mistake as inventing the wording.

## What this does not do

- **Nothing is wired.** `lib/compliance` owns no route, no page and no component, and the plan gives Z8 none. The Review tab,
  the package and the hand-off each need their adapter called with the rows read from the database; that is the orchestrator's
  wiring, as `PatternSource` and `PrintSource` were for decision 0070 (Lesson 9).
- **`lib/kpp/gate.ts` is not deleted**, for the reason in section 1. The parity test is the handover.
- **No care symbol, no size wording, no importer requirement and no AQL run plan exists**, so every real label and every real
  package is refused today. That is the correct state, and it is the honest one: the alternative was a seed of plausible
  sentences.
- **No CPSIA test certificate exists**, so there is nowhere to record one yet. `cpsiaCertificate` is a field on the input,
  null everywhere, and the owner question below asks where it should live.
- **The AQL plan is not read by anything yet.** The table and its reader exist; the production package's QC checklist
  (decision 0070 section 6) reads its own input, and joining the two is wiring.

## Rule ids

`R-LAB-002` (the care label) explains the fibre, care, origin and size lines and the care symbol rows. `R-LAB-003` (PFAS-free
finishes only) explains the fabric refusals. `R-QC-001` explains the AQL row. All three are seeded in `draft` by X2
(`20261101020000_rulebook.sql`) from `docs/spec/articles/JSY-SS-01/rulebook.md`, and `R-LAB-001` (the neck label) is named in
`model.ts` for the tab that will need it.

**`R-GAP-000` is carried by**, and the PR lists them: whether a market requires an importer address; whether a market requires
CPSIA testing, where its row does not say; the children's-size refusal itself; the OEKO-TEX certification line; every field,
point of measure, bill-of-materials line and colour read out of a tech pack document, because a `Cell` carries a provenance
but no rule id; `[TBC]` anywhere; the moderation items; and the Class B human review, which inherits X8's own gap (0073).

## Owner questions

1. **Will you transcribe the ISO 3758 care symbols from a licensed copy, and who confirms them?** The standard is not in this
   repository and is not free to redistribute. Until the rows have a symbol reference, words and a source, no garment can be
   labelled for any market, which blocks every order. This is the single biggest thing in the way. The table is ready; it
   needs five to about twenty rows and a name against them.
2. **What size-designation wording does each market require on a label, and does the United Kingdom, Australia or the European
   Union require an importer or responsible-person address?** Both are legal positions, so neither is guessed; the second is
   currently recorded as "not decided", which refuses the label. **This one may need the legal consult rulebook entry
   `R-LAB-002` already asks for.**
3. **What AQL plan has each factory actually agreed, and at what inspection level?** Owner decision 19 settled the Class A
   sample, which is seeded. Nothing is seeded for a run, per decision 0070 section 6. A factory's agreed plan is a row away.
4. **Where should a CPSIA test certificate be recorded, and is one being sought?** Until one exists, the United States stays
   closed and no youth garment may be made for any market. If youth kit is wanted at launch, this is the blocker.
5. **Has any mill declared any programme fabric PFAS-free?** `programme_fabrics.pfas_free` is null on all six, so R-LAB-003
   refuses every fabric. One declaration per fabric clears it. Rulebook `R-LAB-003` already says to ask the mill.
6. **Does any programme fabric hold an OEKO-TEX Standard 100 certificate?** `oeko_tex_cert` is null on all six, so no label
   claims one. F-G3 asks for certified fabrics "where available", which the platform cannot know until a row says so.
