# 0129: The rulebook has a sign-off session, and it will not credit a review nobody did

Status: Accepted. `/admin/rulebook` takes one name and one role and confirms every rule that person reviewed in
one press. The 29 rules that rest on Knitwright's own words or a published standard are offered ticked; the 16
whose own Source column still defers to a factory, a supplier or a lawyer are offered unticked, with the note
shown. **Nothing is confirmed by this record**: the sign-off waits on a name, which is owner question F3.
Index: Accepted; one name, one role and one press confirms the rules Knitwright owns, and the sixteen that defer to a factory, a supplier or a lawyer are offered unticked
Index title: The rulebook has a sign-off session, and it will not credit a review nobody did
Date: 2026-11-03
Plan step: platform v5, review and hardening (`plans/platform-v5.md`). Serves owner question F3
(`docs/owner/open-questions-v5.md`, from decision 0067 question 4) and owner decisions 11, 13 and 14 of
decision 0067.

## Context

Every one of the 45 seeded rules is a draft, and owner decision 11 says a member is shown only the words
somebody has **confirmed**. So today every "Why?" popover and every best-practice card in the Studio says

> Knitwright's rulebook has no best practice written for this yet.

for all 45 rules — and the card is right to say it. The rulebook itself is version 0.1, "draft for factory
review". Nothing is broken; nothing has been signed.

The owner asked for the rules to be confirmed. Two things were in the way.

**One: confirming was a form per rule.** `ConfirmRule` takes the reviewer's name and role, which owner decision
14 requires, and it takes them *per version*. Signing off the rulebook meant the same two names typed into 45
forms, each a round trip. That is not a thing a person does, so the rules would have stayed drafts.

**Two: 16 of the 45 cannot honestly be confirmed by Knitwright**, and the rulebook says so in its own Source
column. "Factory to confirm their RIP settings". "Knitwright draft; replace with factory block values".
"Regulation trend; supplier declaration". "Confirm with legal consult". Decision 0067's own owner decision 13
already took this mistake out of the `source` column — filing a note that only *asks* the factory for something
as the factory's word "implies a sign-off nobody gave". Writing a Knitwright name into `confirmed_name` for
those same rules would put the mistake back, in a column that **can never be edited**: the table is append-only
and a confirmation is forever.

## Decision

### 1. The rulebook's own Source column draws the split

`lib/rulebook/sign-off.ts` reads the note, not a list:

```ts
const WAITS = [
  { pattern: /\bfactor(?:y|ies)\b/i, who: "a factory" },
  { pattern: /\bsupplier\b/i, who: "a supplier" },
  { pattern: /\bpartner\b/i, who: "the production partner" },
  { pattern: /\blegal consult\b|\blawyer\b/i, who: "a lawyer" },
  { pattern: /\bafter a sample\b/i, who: "a sample" },
];
```

Over the seeded rulebook that is **29 owned and 16 waiting**, and `sign-off.test.ts` pins the sixteen by id
against a fresh reading of `docs/spec/articles/JSY-SS-01/rulebook.md`. Edit a rule's Source column and the rule
moves pile on its own; edit it so a rule changes pile by accident and the test says which.

**The net is deliberately wide.** A note that merely mentions a factory is held back even when it is the
factory's own statement (`R-COST-002`, "Factory price list", is held back for that reason). Holding a rule back
costs one tick. Letting one through puts a name against words that person never read.

`R-GAP-000` is in neither pile. It stands in for a check with no rule behind it, its best practice is empty on
purpose, and a sign-off on "No rule written yet" would be a sign-off on nothing.

### 2. One name, one role, one press

`components/rulebook/SignOff.tsx`, at the top of `/admin/rulebook`, above the rules themselves, because signing
off is what that page is for today:

- **Reviewed by** and **Their role**, typed once;
- the 29 Knitwright owns, listed with their Source notes and **ticked**;
- a collapsed list of the 16 that wait, each saying *who* it waits for and showing its note, **unticked**;
- a button that counts what it will do — `Confirm 29 rules` — and, at zero, says why it is off:
  `Tick a rule to confirm`.

The defaults carry the rulebook's reading and nothing more: the person may untick any of the 29 and tick any of
the 16, because a factory person who really has read `R-SUB-003` should be able to confirm it here.

### 3. Every rule still goes through the database's own guard

`confirmRulesAction` calls the same `rulebook_entry_confirm` as the single-rule form, once per rule, in order:

- the actor must be a platform admin, or the function answers "not found";
- a blank name or role is refused by the function **and** by the `rulebook_entries_confirmation_names_the_person`
  constraint, so a hand-made request cannot confirm anonymously;
- a version already confirmed is left exactly as it is, so a second press of the same session is harmless;
- each checkbox carries **the version it was offered at** (`R-SUB-004@1`), so if somebody saved a new version
  while the page was open, the confirmation misses and the rule stays a draft rather than confirming words
  nobody read;
- anything that is not of the form `R-SUB-004@1` is dropped before the action reaches the database.

They go one at a time so the first refusal stops the session instead of scattering half of it.

## What this does not do

**It confirms nothing.** A confirmation is a record that a named person read the words, and this record has no
name to write. The screen is built and waits for one: that is **owner question F3**, now sharpened to ask for
the person rather than whether to record a person at all.

**It does not widen a rule's scope.** `scope_methods` and `scope_note` are untouched, so the four shared
families still say "scope not reviewed by a factory" after a sign-off. A wider scope is a new version
(owner decision 12).

**It does not touch the seven other articles' rulebooks.** Their 28 draft rules are generated SQL that no
migration applies yet; when they land, this screen shows them too, and almost all of them say "not reviewed by
a factory", so almost all of them will be offered unticked.

## Consequences

- The moment a name is given, the Studio's best-practice card and every "Why?" popover start showing real words
  for 29 rules instead of `R-GAP-000`'s "nothing written yet" — which was the point of asking.
- A member will then see "Reviewed by NAME, ROLE, on DATE" under those rules. That sentence is why the 16 are
  held back: it is a claim about a person.
