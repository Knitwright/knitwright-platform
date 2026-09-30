# 0022: The guided flow

Status: Accepted. The five timed runs are owed to the owner (docs/reviews/guided-flow-timed-runs.md).
Date: 2026-09-30
Plan step: 15

## Context

Every part a non-expert needs existed after step 14: a garment picker, a chat that reads a
sentence, a sketch reader with a review screen, the editor with its drawing and table, and the
exports. They were separate screens, and the drawing and the measurements were far apart on the
editor. Step 15 asks for one path, from a sentence, a sketch or a picker to the downloads, with
the drawing and the table in view together.

## Decision

1. **One path, four steps, each with its own address.** `/studio/start` offers three ways in; each
   makes the design at once (the server action `startGuidedAction`) and opens
   `/studio/<id>/guide?step=start`. Then review, adjust and download. A step is a query value, so
   the back button works, a step can be reloaded, and no client state has to survive a refresh.
2. **A sentence starts from what it names.** The garment and wearer named in the sentence (and not
   refused) choose the starting design; otherwise a crew neck tee for men. The sentence is then
   sent once to the assistant from the start step, and the address forgets it, so a reload does
   not send it again. A sketch starts from the crew neck tee, which the reviewed reading changes.
3. **The preview is read-only and always beside the step.** The flat and a read-only measurement
   table sit in the right column of every step. The full editor stays the place to type
   measurements, colours and logos; the adjust step links to it.
4. **Inches are for reading only.** `lib/units/length.ts` converts at 2.54 cm to the inch and
   writes inches to the nearest eighth, as a tape reads. The design and every export keep
   centimetres. The choice is a query value (`unit=in`) kept across steps.
5. **Plain words first.** `lib/copy/vocabulary.ts` maps factory terms to plain words and shows the
   term beside them ("factory file (tech pack)"), so a person learns the words a factory uses.
6. **A stand-in model for browser tests.** `AI_PROVIDER_STUB=on` answers the assistant (text and
   pictures) with `lib/providers/stand-in.ts`, which never reaches the network. The environment
   check refuses it wherever real people sign in, as it does Cloudflare's test keys.
7. **Accessibility.** Focus moves to each step's heading; the current step is marked with
   `aria-current="step"`; the unit toggle is a labelled radio group; the table has a caption and
   header cells. The browser tests run axe on every step and fail on serious or critical findings
   (`@axe-core/playwright` 4.13.0, pinned). The global reduced-motion rule turns animation and
   transition down to nothing, and an architecture test keeps components from moving things it
   cannot reach.

## Consequences

- The editor is unchanged; the guided flow reuses its parts (chat, sketch review, options, flat,
  downloads). A change to those shows in both.
- A sentence that names two garments starts from the crew neck tee and leaves the choice to the
  assistant. Cost if wrong: one more message for that person.
- The browser tests for this step were written but not run at integration (Docker was down).
- Timed runs (task 6) need the owner; the acceptance line "each run under 5 minutes, or the slow
  stage is named" is open until they are recorded.
