# 0013: The intent core

Status: Accepted. The golden set waits for the owner (A7).
Date: 2026-09-29
Plan step: 11

## Context

The assistant will turn a person's words into changes to a design. The reference folder
`kitwright/lib/ai/` had a working shape but three faults: the model never saw the current design,
invalid actions vanished, and it never asked a question. Criterion M2 says every instruction
becomes a validated change, a question, or an explained rejection. No model is chosen yet (step
12), so this step is the part that does not depend on one.

## Decision

1. **`lib/intent` is a pure library.** `resolveIntent({ utterance, spec, raw })` takes the
   person's words, the design the model saw and the model's raw text, and returns an
   `IntentOutcome` with exactly three kinds: `applied`, `question`, `rejection`. It never throws.
2. **The model's reply has its own small contract** (`reply-schema.ts`): one JSON object of kind
   `changes`, `question` or `rejection`, and eight action types. Each maps to one editor
   `SpecAction` and goes through `applyAction`, the editor's own apply path. Every object is
   strict, so an extra field makes the reply unreadable instead of being ignored.
3. **All or nothing.** A batch of changes is applied in order (a type change first). The first
   change that cannot be made rejects the batch with the registry's own reason. Nothing is
   dropped quietly.
4. **The model never says where a value came from.** Everything it sets is marked
   `ai-suggested`. A change that repeats the design's current value is skipped, so a person's own
   choice keeps its source.
5. **Deterministic ambiguity rules** (`gates.ts`, `mentions.ts`, `vocabulary.ts`). A change of
   garment type, wearer or a construction option becomes a question unless the person's words name
   the new value outright and do not refuse it ("not", "instead of", within the same clause). Fit
   is the only style option today. Longest phrase wins, so "polo collar" is not "polo".
6. **When a type lacks a choice**, the other types of the family that offer it and can take the
   whole request are offered as choices, with "Keep it as ..." last. A clash between two offered
   choices is a rejection, not a type change.
7. **No invented numbers.** A measurement or fabric weight is accepted only if the person typed
   that number, or the current value moved by a number they typed (cm, mm or inches).
8. **Explanations come from the difference** between the old and new design (`explain.ts`), one
   sentence each, so what is said is what changed. A change with no difference is a rejection
   ("The design already has that.").
9. **The current design is part of every model input** (`buildModelInput`). The instructions are
   generated from the registry. The person's words are sent as a quoted JSON string.
10. **The golden set is data** (`golden/tops.json`, 207 cases, all `approved: false`). The replay
    harness (`golden/replay.ts`) runs recorded replies through `resolveIntent`. The replies today
    are synthetic, written by hand and marked so; step 12 records real ones in the same shape.

## Evidence

- A property test (1,500 runs) feeds arbitrary text, JSON, broken JSON, fenced JSON and random
  actions against three garment types: every result is one of the three kinds and never silent.
- The synthetic replay: 207 of 207 never silent and matching the proposed outcome, garment type
  (21 scored) and options (66 scored). 22 faulty replies (plain text, broken JSON, unknown
  actions, invented numbers, a silent type change, control characters) each give the expected kind.
- This proves the parser and the rules. It proves nothing about a model's accuracy.

## Alternatives

- **Let the model send raw `SpecAction` values.** Lost: it would have to state provenance and
  rebuild whole colourway objects, and measurements are in tenths of a millimetre.
- **Treat plain text from the model as a question.** Lost: plain text cannot carry choices, and
  guessing what it means is the silent failure M2 forbids. It is a rejection.
- **Drop the invalid actions and apply the rest** (the reference's behaviour). Lost: M2.
- **Ask whenever the model is unsure.** Lost: model confidence is not reliable; the rules read the
  person's words only.

## Consequences

- A new family's options must be classed in `OPTION_KINDS` and given phrases in `vocabulary.ts`;
  a test fails until they are.
- The vocabulary will miss some ways people say things, which gives an extra question, never a
  silent change. The live golden run in step 12 shows how often.
- The assistant cannot yet add artwork, components, seam construction, size runs, or fabrics and
  colourways. The model is told to reject these.
