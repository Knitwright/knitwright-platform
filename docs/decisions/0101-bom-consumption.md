# 0101: What one garment consumes, per bill-of-materials line

Status: Proposed; one article's figures seeded, all five labelled Knitwright drafts no factory has agreed; seven
of eight base articles deliberately hold nothing and are still refused; owner questions listed
Date: 2026-11-02
Plan step: plans/platform-v5.md section 6 item 2 — the last of the three tables that "nobody owns, and they block
real work" (an orchestrator wiring task, nobody's workstream).
Migration: `supabase/migrations/20261210020000_bom_consumption.sql`.

## Context

Decision 0070 revision 2 listed three values the platform held no table for: the article's bill of materials with
its consumption, the care-label wording per market, and the AQL plan per factory. Z8 (decision 0089) built the
last two. This is the first, and it is the one that stopped **every** real package.

`lib/kpp/input/materials.ts` has always built each bill-of-materials line's *specification* from rows — the
article's allowed fabrics (X1), the programme fabric's blend and weight (X6), the article's thread, the care label
the destination market needs. Each line's *quantity* came from nowhere. `withQuantity()` left `qtyPerPiece`,
`unit` and `sizeDependent` null where no `ConsumptionRow` matched, marked the line `needs_input`, and the F-G2 gate
(`lib/kpp/gate.ts`, `bomIssues`) then refused the package and named the line. `KppUnsourced.consumption` was the
seam, and `sources/server.ts` passed `NOTHING_UNSOURCED` into it, so the seam was always empty.

The figures themselves were never missing from the repository. `docs/spec/articles/JSY-SS-01/article.json`
publishes a nine-line bill of materials with a `consumption` field on every line. X1 seeded the article, its
points of measure, its options, its construction and its fabrics, and did not seed that. `lib/kpp/fixtures/rows.ts`
quoted five of the nine so a test could build a whole package, and `lib/kpp/input/package.test.ts` checked the
quotes against the file — which is how we know the fixture was honest, and also how we know the fixture was the
only place the figures existed.

## Decision

1. **A consumption is a measurement, and a measurement is a row, cited.** `public.bom_consumption`: one row per
   article, bill-of-materials item and version, carrying `qty_per_piece`, `unit`, `size_dependent`, the source
   file, the source label in words, the words of that file quoted, a `confirmed` flag and a `rule_id`. Platform
   data in the idiom of the rulebook (decision 0067) and the option code map (decision 0099): every signed-in
   member reads it, because the tech pack's bill of materials shows the quantity; **the service role holds SELECT
   and nothing else**; there is no insert, update or delete policy for any browser role.

2. **Only what an article really publishes is seeded, and only where the package can carry it.** Five rows, all
   for `JSY-SS-01`, each quoting the exact words of its own `consumption` field:

   | Item | Figure | Size-dependent | Quoted from its own line | Rule |
   |---|---|---|---|---|
   | `fabric:F-POLY-INT` | 0.80 m | yes | `0.80 m at 180 cm width (size M, incl. bleed and press shrink)` | R-SUB-001 |
   | `fabric:F-POLY-RIB` | 0.05 m | no | `0.05 m` | R-GAP-000 |
   | `thread:needle` | 60 m | no | `60 m` | R-CON-009 |
   | `thread:looper` | 110 m | no | `110 m` | R-CON-009 |
   | `label:care` | 1 pc | no | `1 pc` | R-LAB-002 |

   Every one is `confirmed false` and labelled with the article's own words for them: *Knitwright draft v0.1,
   placeholder consumption, factory confirms from the marker*. The article's own status is
   `draft_for_factory_review` at version 0.1, and its own note against the body fabric is "Placeholder
   consumption; factory confirms from marker". Nothing here is presented as a figure anybody has agreed.

3. **The other seven base articles hold nothing, on purpose, and their packages stay refused.** None of them
   publishes a bill of materials at all; decision 0090 records that seven of the eight have empty point-of-measure
   tables and no published measurement. So nothing is seeded for them, `bomConsumption` comes back empty, and the
   gate goes on refusing their packages and naming each line it has no quantity for. **A package that looks
   complete on invented numbers is far worse than one that is refused: a factory would cut fabric to it.** No
   placeholder was written for them either, because a placeholder figure is still a figure a cutter can use, and
   the four articles concerned have no marker, no width and no published fabric to draw one from.

4. **The figure is text, not a number.** The package quotes what the article publishes rather than a figure
   re-rounded on the way through: `0.80` stays `0.80` on the bill of materials a factory reads, where
   `0.80::numeric` would not. Two checks together insist the text reads as a number greater than zero, so a word
   can never be stored where a quantity belongs.

5. **Append-only, and a factory's own figure is the next version.** A trigger refuses every update and every
   delete, and refuses a truncate. It has two exceptions, both of them something happening to another row rather
   than to this one: the account behind `created_by` being erased by `on delete set null`, and the base article
   the figure describes being removed, which cascades here — a figure for an article that no longer exists
   describes nothing, and the parent row is already gone by the time the cascade reaches the trigger, which is
   how the guard tells a cascade from somebody deleting a figure. `public.bom_consumption_record` is the only way in: `security definer`, `search_path` fixed, and it
   answers anyone who is not in `platform_admins` with "Not found." (P0002), exactly as `rulebook_entry_save`
   does. It takes an advisory lock on the article and item, works out the next version and inserts it. The read
   (`newestPerItem`) builds the package on the newest version of each line, so the draft a package was built on
   yesterday is still findable after a factory replaces it with its own marker figure.

6. **The read is a member's read.** `lib/kpp/sources/consumption.ts` reads through the client the caller passes,
   as `lib/catalogue/read.ts` and `lib/option-codes/read.ts` do, and `sources/server.ts` hands it the member's own
   session client beside the article and the option code map. **No part of this needs the server's key**: the
   table is catalogue-shaped platform data a signed-in member may read, and keeping it on the member's client
   means the database's own rules decide what is seen rather than the application's.

7. **The package says what its quantities are worth.** `consumptionNote` puts one sentence on the package: how
   many figures were quoted, the file they came from, and that no factory has agreed any of them, because what a
   garment consumes is measured off the factory's own marker. Where nothing is on file it says that instead, and
   says that it is not estimated from the pattern here — estimating it is the files service's `nest_marker`
   operation, which owner decision 2 keeps unwired.

## What the gate says now

| Article | The bill-of-materials check | Why |
|---|---|---|
| `JSY-SS-01` | **passes** | All five lines its bill of materials carries have a quantity, a unit and a source |
| `CMP-LS-01`, `CRK-SS-01`, `FSH-MM-01`, `HOD-ST-01`, `JSY-LS-01`, `SHO-TR-01`, `TEE-TR-01` | still refused, line by line | Each publishes no bill of materials and no consumption figure of any kind (decision 0090) |

The bill-of-materials check is one of the gate's checks, not the whole gate. A real order for `JSY-SS-01` is still
refused on its care labels: decision 0089 records that ISO 3758 is a paid standard not in this repository, so no
care symbol is transcribed and `lib/compliance` refuses every label. This record does not change that.

## Evidence

| Claim | Test |
|---|---|
| Every seeded figure is the exact words of its own line in its own article's `article.json` | `lib/kpp/sources/consumption-seed.test.ts` |
| An article that publishes no bill of materials has no row seeded, and one that does has rows | `lib/kpp/sources/consumption-seed.test.ts` |
| The seeded figures are the ones `lib/kpp/fixtures/rows.ts` stood in for, line by line and label by label | `lib/kpp/sources/consumption-seed.test.ts` |
| Nothing is confirmed and every figure is labelled a Knitwright draft placeholder | `lib/kpp/sources/consumption-seed.test.ts` |
| The four published figures the package's bill of materials has no line for are named, so adding a line fails loudly | `lib/kpp/sources/consumption-seed.test.ts` |
| The read builds the package on the newest version of each line and leaves the one it replaced findable | `lib/kpp/sources/consumption.test.ts` |
| The read gives back nothing for an article nothing is recorded for, and reports a row it cannot read | `lib/kpp/sources/consumption.test.ts` |
| The package's sentence counts its figures, names their source and claims nothing agreed | `lib/kpp/sources/consumption.test.ts` |
| The real rows make every bill-of-materials line carry a quantity, a unit and `from_base` provenance | `tests/integration/bom-consumption.test.ts` |
| The gate no longer refuses `JSY-SS-01` over its bill of materials, and still refuses `TEE-TR-01` line by line | `tests/integration/bom-consumption.test.ts` |
| A member reads the rows; a visitor reads nothing; the server's key may add, change and remove nothing | `tests/integration/bom-consumption.test.ts`, `tests/integration/isolation.test.ts` |
| A member who calls `bom_consumption_record` is answered "not found", whatever they ask for | `tests/integration/bom-consumption.test.ts` |

## Not done, and why

- **Four of the article's nine published figures have no bill-of-materials line to carry them**: the back neck
  tape (0.20 m), the heat-transfer neck label (1 pc), the polybag (1 pc) and the sublimation transfer paper (about
  1.6 m2, which the article itself marks "for costing only"). `materials.ts` builds fabric, thread and care-label
  lines and no others, so a row for any of them could never be read. Adding those lines means deciding each
  line's *specification* and its supplier reference too, which is decision 0070's business, not this record's.
  `consumption-seed.test.ts` names all four, so the day a line is added the shortfall is a failing test.
- **No figure is per size.** `size_dependent` says *that* the body fabric's figure is for size M only; it does not
  hold the other six sizes' figures, because the article publishes one figure and a marker gives the rest. The
  package states the flag and the size the figure is for, in the words it quotes.
- **No rulebook entry states a consumption figure at all.** The rule ids above explain the *item* — R-SUB-001 the
  sublimation fabric, R-CON-009 the two threads (`article.json`'s own `thread.rule`), R-LAB-002 the care label
  (its own construction step's rule) — not the quantity. The rib line has no entry of any kind and carries
  `R-GAP-000`. A rulebook entry about consumption would be written against a factory's marker, which is the owner
  question below.
- **Nothing writes a figure in the application yet.** `bom_consumption_record` exists and is tested as refusing a
  non-admin, but no screen or route calls it: a factory's confirmed figure arrives by a platform admin recording
  it. A screen for that belongs with the ops console.

## Owner and factory questions

1. **Consumption per garment comes from the factory's marker, and no factory has confirmed any of it.** All five
   seeded figures are Knitwright drafts quoted from a `draft_for_factory_review` article at version 0.1. Ask the
   Sialkot partner to lay a marker for `JSY-SS-01` at 180 cm width and give back, per size: body fabric metres,
   rib metres, needle and looper thread metres, and the transfer-paper area. Until that comes back, every
   quantity in every package we send is a figure we wrote down ourselves and said so.
2. **Is 0.80 m the size-M figure, or the average across the size run?** The article says "size M, incl. bleed and
   press shrink". A cost model wants the average; a cutting instruction wants the figure per size. We have one
   number and it is labelled as one size's.
3. **Should the package carry the four lines the article publishes and the bill of materials does not** — back
   neck tape, heat-transfer neck label, polybag, transfer paper? They are things a factory buys, and the polybag
   and the neck label are things a brand sees. Adding them means agreeing each one's specification and supplier
   reference.
4. **Who records a factory's figure, and does it replace ours or stand beside it?** The table versions the line,
   so both are kept; the package is built on the newest. If the owner wants the factory's figure to need a second
   person's agreement before a package is cut to it, that is a `confirmed_by` column and a screen, not this
   record.
