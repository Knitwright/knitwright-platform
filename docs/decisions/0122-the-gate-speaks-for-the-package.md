# 0122: The F-G2 gate speaks for the production package

Status: Accepted. The package route reads the design's own facts and runs the gate before it drafts anything, so a
refusal names the garment's own gaps — the care label of decision 0089 among them — instead of an export format.
Index: Accepted; the package route reads `designObjectFacts` and runs the F-G2 gate before drafting, so the care-label refusal of decision 0089 is reachable
Index title: The F-G2 gate speaks for the production package
Date: 2026-11-02
Plan step: platform v5, review and hardening (`plans/platform-v5.md`, "R1–R4"), answering owner question 3b of
`docs/reviews/journeys-v5.md` (decision 0110).

## Context

R3 walked the founder journey to its end and asked for the production package. It was refused — correctly, because
no care label prints in any market (decision 0089) — but the sentence it was refused with was about something else:

> No colour of this design has a screen colour yet, and the export format needs at least one.

Two things stood in front of the gate.

**The export format ran first.** `lib/kpp/sources/server.ts` built the design object with `toDesignObjectV2`, which
is techpack.json 2.0 (owner decision 4) and refuses a design the format cannot hold: no screen colour, more than
eight colours, or a text layer over sixty characters. A design in progress usually has no screen colour, so that
refusal answered almost every request.

**Then the drafter ran.** `sources/pattern.ts` has a drafting script for one base article, `JSY-SS-01`. The journey's
article is `TEE-TR-01`, so even with the format's refusal gone the drafter's own reason would have answered next.

Either way `lib/kpp/gate.ts` never ran. The F-G2 checklist is the one thing on this route that tells a brand what its
own garment is missing, and it was unreachable — which also made decision 0089's care-label refusal unreachable, on a
route whose whole purpose is to say what the factory still has to answer.

## Decision

### 1. The design's facts and the export format are two questions

`lib/design-object/to-v2.ts` now exports `designObjectFacts`, which says what the design **is** — its colourway,
options, parameters, assets and fabric code — with none of the format's limits applied. `toDesignObjectV2` is that
function plus the refusal, so the export format's contract is unchanged: a design techpack.json cannot hold is still
refused with the reason, never cut down to fit, and `facts.test.ts` asserts the two agree whenever the format accepts.

The production package reads the facts. It writes no techpack.json — the design object is a **data source** there, for
the colour spec, the option fields and the fabric code — so the format's eight-colour cap has no business standing in
front of a message about a care label.

### 2. The gate runs before anything is drafted

`serveProductionPackage` calls `checkPackage` on the built input and refuses there. `exportPackage` still checks
again, which is cheap and deterministic and keeps the charge after the check, so no brand pays to be told what is
missing. Nothing is drafted for a package that cannot be built.

### 3. What a founder now hears

Every gap, in one answer, each sentence carrying the rule it comes from:

> This production package cannot be built yet. BOM Main fabric: needs your input. Colour spec: no colour roles.
> Care label GB: missing care, origin, size. Care label AU: missing care, origin, size.

`labels[0]: Care label GB: missing care, origin, size. (R-LAB-002)` and its fellows are in `fields.package`, so a
screen can list them one per line when one exists.

## What this does not fix

**There is still no screen.** The Export panel's own tab says the package is built "when the order is placed" and
offers no download, so the only way to reach this refusal is the route the Store would call. R3's finding stands and
is not closed by this decision.

**The three export-format limits are now unchecked on this route.** A design with nine colours, or a sixty-character
name, exports a package the design object could not be written from. That is correct for manufacture — the package
carries no design object — but it means the limits are enforced only where techpack.json is actually written.

## Owner question

**Should the gate's refusal reach a screen?** A founder has to call an API route to learn that their garment needs a
care label. The gate's answer is already a list of sentences with rule ids, which is exactly what a panel wants. No
panel owns it (decision 0108), so it is unowned work rather than a bug.

## Proof

- `apps/web/lib/design-object/facts.test.ts` — the facts match the format's object whenever the format accepts, and
  still describe the design when it refuses.
- `apps/web/lib/kpp/input/gate-reachable.test.ts` — over a design with no screen colour, the format refuses while the
  gate names the care label, the colour roles and the bill of materials, every issue carrying a rule id.
- `apps/web/e2e/journeys-v5.spec.ts` — R3's founder journey now asserts the gate's refusal, with the care-label line
  and its rule id in `fields.package`. It asserted the export format's sentence before.
