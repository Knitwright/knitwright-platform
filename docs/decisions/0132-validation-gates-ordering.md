# 0132: Validation gates ordering

Status: Accepted. Built by plan v6 workstream D1. Three owner questions are open (below); each has a labelled
default and none blocks.
Index: Accepted; every order path and the order function refuse a version whose checks hold a blocker, and mark it ordered
Index title: Validation gates ordering
Date: 2026-11-12
Plan step: platform v6, wave 0, D1 (`plans/platform-v6.md`). Spec F-0, F-T7, F-G2.

## Context

Spec F-0: `validate()` "runs on every save and blocks ordering or export on any `error`"; "status moves
draft → validated → approved → ordered. Editing an ordered version creates a new draft"; "the UI lists each
failing check with 'Why?' and 'Fix' links". F-T7: "100% of placed orders validate against a factory profile
before ops sees them". F-G2: "a deterministic checklist before export or order".

The audit of 2026-11-12 found the checks ran on every save and gated nothing:

- the make flow's sample and run actions (`lib/make/actions.ts`) checked sizes and the minimum order only;
- the brand workspace's run and `freezeRelease` gated on moderation, the Class B review and the golden sample;
- `public.submit_order_for_production`, the one door every order goes through, checked no status at all;
- `ValidationResult.orderable` was read in one place, to grey out a button in the Factory file panel;
- `lib/compliance/from-order.ts` `subjectForOrder` was never called;
- nothing ever moved a version to `ordered` (`lib/credits-gate/server.ts` said so);
- the findings list had no Why? and no Fix link, and the production contract's `DESIGN_STATUSES` lacked `approved`.

## Decision

1. **The app refuses first, in plain words.** `lib/validation/order-gate.ts` `assertOrderable` runs the save
   checks (factory profile, the five guardrails, parameters in range, moderation clear) on the version being
   ordered, stores them as that version's newest `save` result, and throws `conflict` naming the blockers. It is
   called by every path that sends work: the make flow's sample, run and order modal and the brand workspace's run
   (through `lib/make/order-gate.ts`), and `freezeRelease`, before a release is frozen. The checks run again
   rather than being read back, so a rulebook change since the save counts.
2. **The database refuses again.** Migration `20261220010000` replaces `submit_order_for_production` (same
   arguments, errors and grants): the newest stored result of the release's `specVersion` against the order's
   factory profile must not have `passed = false`, or the order is refused with hint `validation_blockers`. The
   newest, not any, because the app writes a fresh result immediately before each order; the two decide on the
   same result. A path that forgot step 1 is still stopped.
3. **An ordered version is marked `ordered`**, inside the same function and transaction as the order
   (`private.mark_version_ordered`): no row gets one; validated and approved move on; a version put back to draft is
   recorded validated against the order's profile and then ordered, because it has just passed the gate. The
   status trigger is untouched and still refuses any move out of `ordered`. A save always writes a new version with
   no status row, which is the spec's "editing creates a new draft"; a database test proves it.
4. **F-G2 runs at every order through `subjectForOrder`** (`lib/make/order-checks.ts`), over that version's tech
   pack with the order's market label (from `country_rules` and `care_symbols`), the screen's result and the Class B
   review laid over it. While `CHECKLIST_REFUSES_ORDER` is `false` its findings travel to ops as order flags (a
   summary and at most six named findings) and do not refuse. Validation blockers, moderation and the Class B review
   refuse regardless.
5. **The Factory file lists each finding with Why? and Fix.** Why? is the rulebook link (`WhyLink`) for the
   finding's rule; Fix links to the screen that holds the control (`components/production/validation/fix.ts`):
   the tech pack for a readiness line, the logos tool for artwork and content, colours for the gamut, garment for
   the article and its parameters. A term only the factory or Knitwright can set has no link; its action and who
   acts are shown as before.
6. **`DESIGN_STATUSES` gains `approved`**, and a test holds it to `VERSION_STATUSES` and the database constraint.
7. **R-GAP-000 is guarded.** `lib/validation/gap-codes.test.ts` holds `GAP_CODES` to an explicit listing of the 29
   codes that answer to the gap today, and requires every code the check sources write to have an entry in
   `rules.ts`. No rule text is written anywhere.

## Owner questions (labelled defaults; none blocks)

- **D1-1.** Should an order of a version with **no stored check at all** be refused by the database? Default: let
  through, as before. Every save stores one and every app path stores a fresh one first, so this only reaches a
  caller that bypasses the app with the server's key (the Store's contract of decision 0043, and the tests).
- **D1-2.** When should **F-G2 refuse an order** rather than travel with it (`CHECKLIST_REFUSES_ORDER`)? Default:
  false. Today almost every item fails for want of owner data (no agreed colour difference, no ISO 3758 symbols, the
  pattern master's points of measure), and missing owner input never blocks.
- **D1-3.** Should **credits be refunded when a version is ordered** (`lib/credits-gate` `orderDesignVersion`,
  decision 0051)? Default: not wired. The version is now marked ordered by the database, so the refund would call
  `refundForOrder` alone after the order.

## Consequences

- A design whose save checks hold a blocker can no longer be sampled, run, ordered from the modal, run from the
  brand workspace or frozen into a release; the refusal names the blockers and points at the Factory file.
- Orders now carry F-G2 flags, which ops sees beside the quantity notes.
- After any order, the Factory file of that version says "Ordered" and offers no moves.
