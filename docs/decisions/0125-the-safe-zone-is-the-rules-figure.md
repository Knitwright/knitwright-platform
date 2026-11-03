# 0125: The clear space around a name is the rule's figure, not ours

Status: Accepted. The owner answered plan v5 question 93: `R-SUB-004`'s 15 mm wins. The setting is reseeded from the
rule, labelled as the rule's, and a test ties the figure, the citation and the rulebook's own row together.
Index: Accepted; the safe zone is R-SUB-004's 15 mm, labelled as the rule's figure rather than a Knitwright default
Index title: The clear space around a name is the rule's figure, not ours
Date: 2026-11-03
Plan step: platform v5, review and hardening (`plans/platform-v5.md`), answering owner question 93 of that plan's
collected questions (raised by Y3, decision 0076 question 1).

## Context

Three things disagreed, and had since decision 0045.

`lib/validation/rules.ts` maps the `safe-zone` check to **`R-SUB-004`**. That rule, in
`docs/spec/articles/JSY-SS-01/rulebook.md`, says:

> Artwork that crosses a seam can be offset by up to 3 mm after sewing; **critical elements keep 15 mm away from
> seams** … Stripes across seams are fine if a small offset is acceptable; **crests, numbers and text are not**.

`lib/guardrails/safe-zone.ts` runs on exactly `name` and `number` items — the "numbers and text" that rule calls
critical. And `lib/guardrails/settings.ts` held `safeZoneMm: { value: 10, source: "knitwright-default" }`.

So the check used one figure and cited a rule that states another.

**What it cost was silence, not a false pass.** The finding is a warning, not a blocker, so nothing cleared a gate
it should not have. But a name placed **12 mm** from a seam produced no warning at all, while the rule in that
check's own citation rejects it. Nothing was invented and nothing was hidden — the sentence said "(Knitwright
default, not from your print house)", so the figure was never presented as agreed — which is why no test was red
and why this survived three waves. Plan v5 collected it as question 93, in the owner's own words: *"Reseed the
setting to 15 mm against `R-SUB-004`, or say where the 10 mm came from."*

## Decision

**The rule's figure wins.** The owner answered: reseed to 15 mm.

### 1. The figure is quoted from the rule, in one place, and the quotation is tested

`lib/guardrails/safe-zone-rule.ts` holds `SAFE_ZONE_RULE = { ruleId: "R-SUB-004", mm: 15 }` and nothing else.
`DEFAULT_SETTINGS.safeZoneMm` and `lib/settings/registry.ts`'s fallback both read it, so the number is written
once, beside the id of the rule that states it.

This is a quotation of one row of the rulebook, not a constant standing in for data.
`lib/guardrails/safe-zone-rule.test.ts` reads the row **out of `rulebook.md` itself** and fails if the quotation
stops matching it, and it asserts the thing this record is about: `ruleIdFor("safe-zone")` is the rule whose
figure `DEFAULT_SETTINGS.safeZoneMm.value` is. The figure a check runs on and the rule a check cites cannot
drift apart again without that test going red.

### 2. A rule's figure is not called a Knitwright default

`Setting<T>["source"]` gains `"rulebook"`, and `sourceNote` answers `from rule R-SUB-004` for it. Saying
"Knitwright default" of a figure the rulebook states would be untrue on the screen that shows it, and the whole
point of labelling a source is that a reader can tell an agreed number from ours.

So the warning now reads:

> *Back number is 7.2 mm from the seam of body-front; it needs 15 mm of clear space (from rule R-SUB-004).*

The dpi minimum and the bleed are untouched: those really are Knitwright's own defaults and still say so.

### 3. A league or a print house still decides for itself

`guardrails.safe_zone_mm` (`lib/settings/registry.ts`) overrides it, as it always did, and the fix line on the
finding still says "A league may ask for a different clear space". What is gone is the platform quietly
disagreeing with the rule in its own citation.

## What this changes for work already done

**A design with a name or number between 10 mm and 15 mm of a seam now warns where it did not.** That is the
point of the change, and it is worth saying plainly: nobody's stored design is altered, no export is blocked —
the finding is a warning — but a person who looked at that design yesterday and saw nothing will see a line
today. The rule was always 15 mm; only the platform's silence has changed.

## Consequences

- `lib/guardrails/checks.test.ts`'s property test compared the margin against a hard-coded 10. It now reads
  `DEFAULT_SETTINGS.safeZoneMm.value`, so the property cannot go stale the next time the figure moves. The two
  remaining 10s in that test are the panel's own sewn edge, which is geometry, not clear space.
- `lib/panel-layers/edges-y3.test.ts` asserted that the default "is Knitwright's own". Its premise was the fault;
  it now asserts the sentence the sheet really carries.

## What is still owed

Y3's decision 0076 question 1 asked this and also asked **where the 10 mm came from**. Nothing in the repository
says. It is answered now in the only way that matters — it is not used — but if the 10 mm came from a real source
that source should be written into the rulebook rather than lost.
