# 0090: The remaining base article data (onboarding waves 2 and 3)

Status: Proposed; owner questions listed
Date: 2026-10-30
Plan step: plans/platform-v5.md, workstream Z9. No migration.

## Context

`JSY-SS-01` is the one launch article with a factory-shaped brief, a rulebook, a pattern pack and a drafting script
(decisions 0066, 0067, 0068). The other seven of `docs/spec/articles/ONBOARDING.md` — `SHO-TR-01`, `JSY-LS-01`,
`CRK-SS-01`, `TEE-TR-01`, `HOD-ST-01`, `CMP-LS-01`, `FSH-MM-01` — existed only as a row of literals in
`lib/catalogue/seed/launch.ts`: a code, a name, a class, the front doors, the sports their row of the launch catalogue
names and a fabric programme code. This workstream does ONBOARDING.md **step 1** for each of them: the brief, the
points of measure that can be cited, a drafting script where the measurements exist, and a rulebook in `draft`.

The build pack publishes **no measurement of any of these seven garments**. That is the fact the whole workstream
turns on: there is nothing to draft from, and a millimetre invented here is cut in a factory.

## Decision

1. **A brief per article, in the worked article's shape, under `docs/spec/articles/<CODE>/`.** `article.json`,
   `rulebook.md` and a `README.md` that says what is on file and what is not. Every file is labelled
   **"Knitwright draft, not reviewed by a factory"**, the status of every article is `draft_no_factory_block`, and
   none is `live`: owner decision 10 blocks `live` without a factory-checked master pattern, and none exists.

2. **A value is in the article only if the brief cites it; otherwise it is empty.** Each brief carries its own
   `sources` list, one row per value, naming the file and the table it was read from: the code, name, class and front
   doors from ONBOARDING.md's launch table, the sports from the article's own row of `01-product-direction.md`'s
   launch catalogue, the fabric programme code from that row's "Fabric (programme code)" column, millimetres from
   `03-data-model.md`'s conventions. `uncitedFields()` is the gate, and a test asserts it is empty for all seven.
   Size range, sample size, fit, gender, HS code and origin are published for none of them and are therefore null.

3. **Every point-of-measure table is empty, and that is the answer, not a gap in the work.** Nothing published
   measures these garments. The one near miss is the build pack's `pom.csv` example
   (`04-production-package.md`), which gives `SHO-TR-01` a waist (380 mm at M, grade 40, tolerance 10) and an inseam
   (127 mm, fixed, tolerance 5). It is **not adopted**, for two reasons the file itself supplies: the build pack says
   "The measurement values above are illustrative only; real values come from the factory's pattern master in Phase 0",
   and the same CSV's `JSY-SS-01` rows contradict that article's own `article.json` (chest 440 mm and a 40 mm grade
   against its 460 mm and 30 mm). The figures describe the file format, not a garment. The same holds for the
   build pack's default tolerances (±10/±5/±3 mm), which owner decision 18 does not let the platform apply.

4. **What the build pack publishes as illustrative, an example or a placeholder is kept, cited and caveated, in
   `candidates` — and the catalogue never reads it.** Throwing it away would lose the only numbers anyone has written
   down about these articles; promoting it into the article would send a placeholder to a factory as a measurement. So
   each candidate row carries its source, its caveat and the field it would fill: the `pom.csv` waist and inseam and
   its size run, the shorts' inseam range of 3 to 9 in (`R-SHO-002`), its waistband, side-split and pocket options,
   the compression side seam (4-needle flatlock ISO 607, `R-CON-011`) and mock neck, the ±3 mm compression tolerance,
   and every fabric blend and weight of the launch catalogue. A test asserts that no illustrative value reaches the
   row the catalogue seeds.

5. **No article is drafted, and the drafter says why.** None of the seven has a parametric script, because a script
   needs a POM table and none of them has one; a drafted shape nobody has measured is the invented measurement the
   plan forbids. Each brief's `parametric_script` block reads `"not drafted yet"` with the reason, the rulebook entry
   that explains it and the list of points of measure a drafter would need. `lib/parametric/articles` holds the same
   register as data read through a source interface, the pattern decision 0068 revision 1 established for
   `DraftConstantsSource`: no number and no geometry in TypeScript, and a factory's own register replaces the seed.
   A test holds the register to each brief field by field, and asserts that `draftArticle` and `draftAllSizes` refuse
   all seven in every size.

6. **A rulebook per article, 28 entries, every one `draft` and every one cited.** Three entries per article carry the
   facts that are true of all of them — no block on file so nothing may be drafted or ordered (`R-PAT-x01`), no point
   of measure without a factory value **and** a tolerance (`R-FIT-x01`), no construction, seam allowance or thread on
   file (`R-CON-x01`) — and the rest are the article's own: the shorts' illustrative POMs
   (`R-FIT-102`), long sleeves being `JSY-LS-01` rather than `JSY-SS-01`'s sleeve offset (`R-PAT-202`, from
   `JSY-SS-01`'s own `R-PAT-004`), the Class B print gap (`R-SUB-401`, `R-SUB-501`) and the compression collar
   (`R-CON-602`). Numbering: each article owns the hundreds block of its onboarding position (`SHO-TR-01` is 1xx
   through `FSH-MM-01` 7xx), so no id collides with the worked article's 0xx ids or with another article's. **Where
   the build pack has already given a rule an id, that id is used as published** rather than renumbered:
   `R-SHO-002` for the shorts' inseam range and `R-CON-011` for the compression side seam, both with the build pack's
   own words. The files are in the worked article's table shape, so the rulebook seed can read them unchanged.

7. **The Class B articles have no print, label, QC or cost rule at all, and are not given one.** The shared
   `R-SUB`, `R-LAB`, `R-QC` and `R-COST` entries are scoped to the sublimation method (owner decision 12), and
   `TEE-TR-01` and `HOD-ST-01` are made in a stock-colour palette, not sublimated. Their one print rule says exactly
   that, and asks which decoration the stock-colour programme uses. Widening the sublimated jersey's rules to them
   would state facts the rulebook does not contain.

8. **The catalogue seed reads the briefs instead of literals, and no migration follows.** `launch.ts`'s `DRAFT_FACTS`
   table is gone: the seven articles come from the briefs, through `draftArticleSchema`, which refuses a brief holding
   a point of measure, a parameter range, an option, a construction row, a drafting script, a label that does not say
   the draft is unreviewed, or a value with no citation. The briefs are bundled into
   `lib/catalogue/seed/data/draft-articles.json` by `print-draft-articles.mts`, because nothing in this package
   imports from outside it, and a test keeps each copy equal to its committed original — the same seam as
   `lib/parametric/data/JSY-SS-01.json`. The seeded rows are **byte for byte what they were**, so
   `20261101010000_base_articles.sql` still matches the generated seed and this workstream adds no migration. The
   brief's own version and note stay off the catalogue row for the same reason: there is no article data to version
   yet, and the first factory value will bring a reseed migration with it.

## Evidence

| Claim | Test |
|---|---|
| All seven briefs parse, are labelled, are `draft_no_factory_block`, and hold no POM, range, option or construction | `lib/catalogue/seed/draft-article.test.ts` |
| Every value a brief holds is cited, and a value it gains without a citation is reported | same |
| The bundled copies are the committed briefs, in onboarding order | same |
| No illustrative value reaches the catalogue row (`380`, `127`, `3XL`, `micro-mesh`, `zip_back`, `inseam`) | same |
| The seeded rows are unchanged, so the migration still equals the generated seed | `lib/catalogue/seed/sql.test.ts`, `lib/catalogue/seed/launch.test.ts` |
| All 28 rulebook rows are complete, still `draft`, cite a file of the build pack or the plan, sit in the article's own id block or reuse a published id, and no id is shared with `JSY-SS-01` | `lib/catalogue/seed/rulebook-draft.test.ts` |
| The not-drafted register covers every launch article without a script and only those, and says what its brief says | `lib/parametric/articles/index.test.ts` |
| `draftArticle` and `draftAllSizes` refuse all seven in every size | same |

100% of statements and functions of `lib/catalogue` and `lib/parametric` after this change. No new dependency. No
migration. Nothing in `Sportswear/`, `kitwright/` or `supabase/config.toml` was touched, and nothing reads or writes a
Store concept.

## Not done, and why

- **No parametric script for any of the seven.** Point 5: there is nothing to draft from.
- **No pattern pack, tech pack, 3D model or sample.** Steps 3 to 9 of ONBOARDING.md need the factory's block first.
- **No size range or POM in the database.** Point 8: the briefs add no confirmed value to the catalogue, so the seed
  is unchanged. The first factory value is a one-line change here plus a reseed migration.
- **No new rulebook rows in the database.** `lib/rulebook`'s seed reads `JSY-SS-01`'s file and belongs to X2; these
  seven files are in the same shape and ready for it, and two rule families they need do not exist yet (question 5).
- **No `R-GAP-000`.** Every rule, range and check this workstream writes carries a real rulebook id.

## Owner and factory questions

1. **Size range, sample size, fit and gender for all seven.** The build pack publishes none of them (decision 0066,
   questions 1 and 3). Nothing in the platform can grade, offer a size or price an article until they exist.
2. **`SHO-TR-01`'s inseam range.** `R-SHO-002` (3 to 9 in) is the build pack's own example and carries its own rule
   id, but no step, no default and no factory approval. Is it the factory's range, and what step does it take?
3. **The shorts' waistband, side split and pocket.** The build pack names the groups ("elastic, drawcord or both",
   "side split on/off", "pockets from a list") but no option codes, so none can be offered.
4. **`R-CON-010` is unassigned.** The build pack uses `R-CON-011` for the compression side seam while
   `JSY-SS-01`'s rulebook ends at `R-CON-009`. Is 010 spoken for?
5. **Two rule families do not exist in the rulebook.** `lib/rulebook`'s topic map has no `SHO` family, which the
   build pack's own `R-SHO-002` needs, and no `FAB` family, which is why a fabric fact is recorded on the article's
   fabric row rather than as a rule. Both are X2's file; should they be added?
6. **Per article, from the factory:** the pattern and size chart (step 2), the POM table with grades **and
   tolerances**, the construction table, seam allowances and thread, and the fabric's real code, weight and blend —
   the build pack says every fabric code, weight and blend is a placeholder until the Phase 0 factory test.
   Each brief's `open_questions` carries the article's own list; the ones that change what the platform can offer
   are: is `JSY-LS-01`'s goalkeeper shirt the same base; does `CRK-SS-01` need a placket and collar group of its own;
   is `HOD-ST-01` pullover or zip (the registry maps both); is `CMP-LS-01`'s rash guard the same article as the
   compression top; and what sews `FSH-MM-01`, the only woven garment in the catalogue, for which none of
   `JSY-SS-01`'s knit construction applies.
7. **Which decoration the Class B stock-colour programme uses**, and its print rules (point 7).
8. **Sport tags.** `JSY-LS-01` and `HOD-ST-01` carry none, so they appear under no sport filter, although the
   template library lists them under Football and Training. Both are recorded as candidates; promoting them is a
   reseed migration.
