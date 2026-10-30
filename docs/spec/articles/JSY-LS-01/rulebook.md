# Rulebook · JSY-LS-01 long-sleeve jersey / goalkeeper

Version 0.1 · 2026-10-30 · status: **draft, no factory block on file**

Every entry below is **Knitwright draft, not reviewed by a factory**, status `draft`, and carries the published source it was read from. Nothing here
is a measurement: this article has none, and an entry that would need one says so instead of giving a number. The file
is in the shape of `docs/spec/articles/JSY-SS-01/rulebook.md`, one table row per rule with the columns ID, Applies to,
Rule, Why, Best practice, Source, Status, so the rulebook seed can read it without a change.

The shared rules (R-SUB, R-LAB, R-QC, R-COST) are scoped to the sublimation method rather than to every article
(plans/platform-v5.md owner decision 12), so they are not repeated here.

---

## Pattern (R-PAT)

| ID | Applies to | Rule | Why | Best practice | Source | Status / sign-off |
|---|---|---|---|---|---|---|
| R-PAT-201 | The whole article | No pattern is drafted for this article, and no design may be ordered from it, until the factory's pattern master supplies the block and a signed master pattern is on file | ONBOARDING.md puts the factory's own block before any drafting, and an article without a factory-checked master pattern cannot go live | Ask the factory for their existing pattern and size chart for this garment (step 2) before anything is drafted | docs/spec/articles/ONBOARDING.md, the 9 steps (steps 2, 3 and 9); plans/platform-v5.md, owner decision 10; Knitwright draft, not reviewed by a factory | draft |
| R-PAT-202 | Sleeve length on JSY-SS-01 and on this article | A long sleeve or a goalkeeper shirt is this article, never JSY-SS-01's `sleeve_length_offset` | Beyond JSY-SS-01's +40 mm the short-sleeve block becomes a different sleeve and needs its own block | Point a customer asking for long sleeves on JSY-SS-01 at this article | docs/spec/articles/JSY-SS-01/rulebook.md, R-PAT-004 (its rule and best-practice columns) | draft |

## Fit and grading (R-FIT)

| ID | Applies to | Rule | Why | Best practice | Source | Status / sign-off |
|---|---|---|---|---|---|---|
| R-FIT-201 | Every point of measure | A point of measure is stored only with a value and a tolerance from the factory; the build pack's default tolerances (10 mm on body widths and lengths, 5 mm on sleeve, inseam, neck and waistband, 3 mm on compression) are placeholders and are not applied | A tolerance is the promise that size M is always size M, so inventing one states a promise nobody has made; a missing tolerance is a question for the factory | Collect the POM table and its tolerances from the factory's size chart in step 2, before the tech pack is sent | docs/spec/04-production-package.md, "Default tolerances" ("These are placeholders to confirm with the factory in Phase 0"); plans/platform-v5.md, owner decision 18 | draft |

## Construction (R-CON)

| ID | Applies to | Rule | Why | Best practice | Source | Status / sign-off |
|---|---|---|---|---|---|---|
| R-CON-201 | Construction, seam allowances and thread | No seam, stitch class, stitch density, seam allowance or thread is recorded for this article, and the tech pack cannot be exported until the factory fills them | Construction is the factory's own practice, and a seam copied from another article is a guess about a different block; a value still needing input blocks export | Use JSY-SS-01's construction table as the question list when the factory is walked through step 5 | docs/spec/articles/ONBOARDING.md, the 9 steps (step 5); docs/spec/articles/JSY-SS-01/article.json; Knitwright draft, not reviewed by a factory | draft |

## What this rulebook cannot say yet

- Is the goalkeeper shirt this article with a different colourway, or does padding and a different cuff make it a base of its own?
- The launch catalogue names no sport for this article, so it appears under no sport filter. Should it carry football, as the template library implies?
- Size range and sample size: the build pack publishes neither for this article (decision 0066, owner question 1).
- Men's, women's or unisex, and the fit word (regular, athletic): the build pack publishes neither.
- The POM table with grades and tolerances from the factory's own size chart (ONBOARDING.md step 2).
- The construction table, seam allowances and thread the factory really uses.
- Fabric: the build pack says every fabric code, weight and blend is a placeholder until the Phase 0 factory test.
