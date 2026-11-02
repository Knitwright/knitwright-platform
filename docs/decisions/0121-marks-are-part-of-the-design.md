# 0121: A founder's own point of measure and callout are part of the design

Status: Proposed. `set-article`, `set-extra-pom` and `set-callout` exist, a mark is stored on the design and read back from it, and decision 0077 item 12 is superseded.
Index: Proposed; the Specs toolbar's marks are stored on the design, so a reload no longer loses them, and decision 0077 item 12 is superseded
Index title: A founder's own point of measure and callout are part of the design
Date: 2026-11-02
Plan step: platform v5, review and hardening (`plans/platform-v5.md`, "R1–R4"), closing item D-5 of
`docs/reviews/code-v5.md` (decision 0112).

## Context

Spec F-S6 lets a founder add their own points of measure, "measured on the sample, not graded", and their own
callouts, and the Specs toolbar (decision 0077) draws both. Neither was stored.

`lib/garment/action-schema.ts` had no action that could hold one. `set-measurement` takes a `pointId` the
garment registry already knows, and a mark drawn on a panel has no such id, so there was nothing to save a
mark as. Decision 0077 item 12 recorded that honestly, put the marks in a module-level `Map` shared by the two
panels (`components/studio/editor/specs/marks-store.ts`), and had the panel say "It is not saved with the
design yet, so a reload loses it".

The code review of plan v5 called it the worst item it found, and it was right to: the work lost is the
person's own measurement of their own sample, the loss is silent, and the screen that loses it is the
product's main one. It is item D-5, and it names the same three missing actions this record adds.

The third of those three, `set-article`, is the same shape of gap. `spec.article` has existed since schema
version 7 and nothing could write it. The teamwear configurator reads the base article row and holds the
person's option codes and parameters to its approved ranges, and then put that form **in the address only**
(`studioHref`), so the design object never carried it, `lib/validation`'s parameter checks had nothing to
judge, and the tech pack had nothing to show.

## Decision

### 1. Two stored shapes, in `lib/garment/design-marks.ts`

A design carries `extraPoms` and `callouts`, both optional, both added after schema version 7 without a bump,
so every design saved before this still reads and a design nobody has drawn on has neither key.

- `designPomSchema`: the id, the measuring tool, the person's own name for it, the note, the places picked on
  a panel in millimetres, the measured length, which view it was drawn on, and its provenance. `lengthMm` is
  **measured, never typed**, and is null rather than a nought for a mark that has no length.
- `designCalloutSchema`: the same without the tool and without a length, because a callout is a note.

A mark must name at least one place. The panel a place names is **not** checked against the panels the
options leave on the garment: a mark is a note on a drawing, not a value the registry grades, and a design
must not become invalid because an option took a panel away from under an old mark. Repeated ids within one
list are refused, as they are for fabrics, colourways and artwork.

### 2. Five actions, not three

`set-article`, `set-extra-pom` and `set-callout` are the three the review asked for. `remove-extra-pom` and
`remove-callout` go with them, because the toolbar has a "Take off" button and a removal that is not stored
is the same bug in the other direction: take a mark off, reload, and it is back. Every other list in the
action schema comes in a set/remove pair.

Writes go the way every other change does. A browser cannot name a source: `stampUserEdited` strips whatever
it claims and writes `user-edited` on the mark itself. Each action has a version note in plain words. Taking
the last mark off leaves the key out of the design again, so a design that was drawn on and cleared reads as
one that never was.

### 3. One place the panels read marks from

`marksOf(spec)` in `lib/techpack/view/marks.ts` turns the stored lists into the marks the toolbar already
knew, and `saveMarkAction` / `removeMarkAction` turn a mark back into a change. The Specs toolbar and the
tech pack view both read `marksOf(design.spec)`, so the two slots cannot disagree, and
`components/studio/editor/specs/marks-store.ts` is **deleted**. The slot contract did not need widening: a
panel is already given the design and `commands.save`.

Each mark's save is keyed by the mark (`markSaveKey`), because the editor's queue replaces a queued change
with the same key, and two marks saved in quick succession must not replace each other.

**Decision 0077 item 12 is superseded by this record**, and so is the sentence the panel carried. What the
panel says now is what is still true: a mark is the person's own measurement on the sample, saved with the
design, and never graded.

### 4. `set-article` has a caller

`saveKitAction` (`lib/teamwear/actions.ts`) already read the base article row and already worked the form out
with `defaultsOver`. It now stores both on the design in the same version it writes the kit's colours, so the
person's own option codes and parameters reach the design object, validation and the tech pack instead of
only the address.

### 5. What is still lost on a reload, and said so

A point of measure typed in on the Measurements tab with "+ Add measurement" is still the tech pack panel's
own state. It has no place on a panel, so neither stored shape fits it: it is a letter, a description and a
value at the sample size. The panel's own comment says so rather than implying everything is saved now.
**Owner question: should a typed extra point of measure be stored too, and under what shape?**

## Alternatives

- **One `marks` list with a `tool` of five values.** Rejected: an extra point of measure and a callout land on
  two different tabs, carry different columns, and one has a length while the other cannot. Two shapes say
  that; one shape with a tool field would make every reader check which half applied.
- **Store the marks in a table of their own.** Rejected: a mark is part of the design's own version history —
  undo, restore and the version note all have to cover it — and the design is one JSON document for exactly
  that reason. A table would need its own versioning to answer "what did this design look like at v4".
- **Widen the slot contract with a marks store the shell owns.** Rejected: that keeps the marks out of the
  design, which is the bug. The contract already hands a panel the design and a way to save a change.
- **Add only the three actions the review named and wire nothing.** Rejected: an action with no caller is the
  same kind of seam the review is cataloguing, and it would have left the panel's "a reload loses it" true.
- **Make `points` optional so a typed extra point of measure fits too.** Rejected: a stored shape that says
  "at least one place, in millimetres, on a panel" is what makes a mark a mark. A typed point of measure is a
  different thing and should get its own shape when someone owns it.

## Consequences

- A founder's own point of measure and their callout survive a reload. The proof is a database test rather
  than a browser one: `tests/integration/project-service.test.ts`, "a point of measure and a callout a person
  drew", writes through `saveAction` and then reads the design again with `getProject`, which is what the page
  does when a person comes back to it.
- **The Specs toolbar is still not mounted.** Decision 0077 item 13 left all four of the wave's panels as
  slots for the orchestrator to wire into `EditorShell`, and this record does not wire them: the shell still
  draws `editor-slot-specs`. So the data loss is fixed in the panel and in the stored contract, and the panel
  a person can reach is still the placeholder. That is item A of the same review, not this one.
- Every mark is one design version, so drawing five marks is five versions in the history. That is how the
  editor saves everything else, and it means undo takes marks off one at a time.
- A mark carries `R-GAP-000` as it did before: no rulebook entry covers a founder-drawn point of measure.
  That gap is unchanged by storing it.
