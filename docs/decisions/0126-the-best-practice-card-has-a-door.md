# 0126: The best-practice card has a door, and it is a part chooser

Status: Accepted. The owner answered decision 0117's owner question 1: a part chooser beside the Ask box. Owner
question 6 of the same record is answered too — the toolbar toggle stays upright.
Index: Accepted; F-S5 v2's best-practice card is reached from a six-part chooser under the Specs toolbar, and 0117's toggle stays upright
Index title: The best-practice card has a door, and it is a part chooser
Date: 2026-11-03
Plan step: platform v5, review and hardening (`plans/platform-v5.md`), answering decision 0117's owner questions 1
and 6. Spec: F-S5 v2. Reads decisions 0083 (Ask and best practice), 0117 (wave 2's editor wiring), 0053 (the piece
mapper) and 0124 (nothing is built with no door).

## Context

Spec F-S5 v2 asks for two things: an Ask box, and a best-practice card "when a part is selected". Z2 built both.
`components/rulebook/ask/BestPracticeCard.tsx` draws the card, `bestPracticeAction` fills it from the rulebook, and
both are tested.

**Nobody could reach the card.** `bestPracticeAction` needs one of the rulebook's six part keys — `collar`,
`sleeve`, `body`, `artwork`, `names`, `labels` — and no screen selected one. Decision 0117 mounted the editor's
seven panels and deliberately left this pair out rather than guess, recording the reason as its owner question 1
and offering three ways out. Decision 0124's sweep then found the same pair from the other direction, as a
component mounted nowhere and an action called nowhere, and kept them visible instead of letting them pass as
finished.

Two agents declined to choose, correctly: the choice was the owner's. It has been made.

## Decision

### 1. A part chooser beside the Ask box

`components/rulebook/ask/BestPractice.tsx` is a form with one submit button per part, under the Ask box in the
Specs toolbar (`RailSlots.tsx`'s `SpecsBody`), where the other half of F-S5 v2 already lives. Choosing a part
shows the card for it; choosing another replaces it, so the card is never about two things at once.

It is a form, so it works the way every other action in this app does: the server decides, `bestPracticeSchema`
refuses a part it does not know, and a failure comes back as a sentence in `FormSummary`. No rule's words are
written in any file added here.

**The list is `PARTS` itself, not a copy.** `partChoices` maps the rulebook's own definitions, in their order, so
a part added to the rulebook appears in the chooser without anybody remembering to add it — and `picker.test.ts`
asserts the chooser can only offer keys `partFor` resolves, so it cannot ask for a part the action would refuse.

### 2. Why not the other two doors

**Not a mapping from the Specs toolbar's selection.** That toolbar picks a *pattern panel*, which is a different
vocabulary: it covers three of the rulebook's six parts at best, and nothing joins "body-front" to "artwork and
print". A mapping would have been a guess, and a guess about which rules apply to a part of a garment is the kind
of guess this platform does not make.

**Not waiting for the piece mapper.** Decision 0053's piece mapper would make a click on the garment mean a part,
which is the better interaction and may well replace the chooser's job later. Waiting for it left half of a
shipped spec feature unreachable for as long as it took. The chooser is six buttons and is deleted in one commit
if the mapper arrives.

### 3. No pressed state on a submit button

The chosen part is visible (a brighter border) and is announced by the card's own accessible name, "Best practice:
Artwork and print". `aria-pressed` is not used: these are submit buttons, not toggles, and a pressed state would
tell a screen reader something untrue about what pressing does. `picker.test.ts` asserts the attributes carry no
`aria-pressed`, so a later tidy-up cannot add one by reflex.

### 4. The toolbar toggle stays upright (0117 owner question 6)

0117 asked whether the Form / Library / Specs toggle should go back to the spec's horizontal "segmented" shape.
It stays upright. Both routes to horizontal cost the shell something it has not got: widening the rail's 4.75 rem
icon column narrows the canvas on the product's main screen, and spanning the toggle across the rail and the panel
costs the panel 3.75 rem of height — which 0117 proved in CI pushes the Media tool's panel below the fold of the
rail's scroll box, where its `IntersectionObserver` never fires and it waits on its loading line for ever. Upright
matches the tool rail beneath it and the launch shell's icon rail, and the panel keeps its 336×592.

## Proof

- `components/rulebook/ask/picker.test.ts` — the chooser offers every part the rulebook defines in its own order,
  offers only parts the action accepts, marks none until a card is on the screen and then only the card's own,
  carries no `aria-pressed`, and the card it reaches names a rule.
- `e2e/editor-panels.spec.ts` — the first time either half of this pair runs in a browser: six parts under the
  Specs toolbar, a card that names the part and carries a rule id, and a second part replacing the first.

What a given part's card says depends on what the `rulebook_entries` table holds, which is seeded data and not a
test's to assert. The card is honest either way: the rulebook's own best practice per rule, or one line saying
nothing is written for that part yet with `R-GAP-000` beside it, which is how the team learns the card is wanted.

## Consequences

`tests/architecture/mounted.test.ts`'s two `reported` entries for this pair are removed: the component is mounted
and the action is called, so the allow-list must not keep claiming otherwise. That leaves `BoardActions.tsx` and
`flowOperationAction` as the only reported seams, both with their doors named in 0124.
