# 0020: Sketch and photo input

Status: Accepted. The golden images (A8), their approval (A7) and the live run (A3) are owed.
Date: 2026-09-29
Plan step: 13

## Context

Text input works (decision 0019). A person can now start from a picture. A vision model's reading
of a sketch can be wrong and its stated confidence is not reliable, so its reading is a proposal,
never a change. Images are uploaded with the step 3 helper.

## Decision

1. **Same tool, same parser.** The picture goes to the configured model through the same
   `TextModelProvider`, the same `reply` tool and the same reply contract as text. The image rules
   are added to the registry-generated instructions (`lib/intent/image-input.ts`).
2. **Provenance.** Every value a reading sets is marked `read-from-image`. That value already
   existed in `lib/garment/provenance.ts` (from step 4); nothing was added to the contract.
   `applyBatch` and `toSpecAction` take the source as a parameter, `ai-suggested` by default.
3. **Nothing applies until confirmed.** `POST /api/projects/[projectId]/read-image` saves nothing.
   It answers with the explanations, a drawing of the proposed design, and a signed proposal (the
   same signing as 0019, source "picture"). The review screen shows the person's picture beside the
   drawing. The garment type is always listed for confirmation, and so are the wearer and every
   construction choice the reading changed (including those a new type brings). Apply is disabled
   until each is ticked; then `applyProposalAction` saves one version noted "Read from a picture".
   The ticks are a screen rule: the person applies a proposal to their own design either way.
4. **Text inside a picture is content.** The instructions say so; a reading can at most put such
   text into a field as a proposal the person sees and confirms. No retry on a stronger model for
   pictures, and a model question is turned into a plain reason: the review is the question.
5. **No numbers from a picture.** Measurements and fabric weights in a reading are dropped and the
   person is told ("Numbers in the picture were not used"). Owner action A5 forbids invented
   numbers, and a number read off a sketch cannot be checked.
6. **Upload** goes through `/api/files` (kind `sketch` or `photo`), the step 3 helper, which checks
   and rewrites the picture. The route reads the file back only for the brand in the session, up to
   5 MB (Anthropic's per-image limit), PNG, JPEG or WebP.
7. **Cost.** Priced at the instructions bound plus 2,000 tokens for the picture and the fixed output
   limit, reserved before the call, refunded if the file cannot be sent or the call fails. A
   non-garment rejection keeps its cost: the model did the work.
8. **Golden images** (`lib/intent/golden/images/`) are an empty manifest with a schema, a replay
   harness that scores garment type with option accuracy beside it, a test that replays any recorded
   run in CI, and `scripts/eval-images.mts` for the live run.

## Evidence

- Unit tests with stub models: every value read carries `read-from-image`; type and construction
  are always listed for confirmation; numbers are dropped with a note; a non-garment reply gives an
  explained rejection; an instruction written in a picture ends up at most as a proposal field.
- Review reducer: apply is impossible until every confirmation is ticked.
- **No live model call and no golden image.** Accuracy is unknown.

## Alternatives

- **Apply the reading and let undo take it back.** Lost: the plan says nothing applies until
  confirmed.
- **Accept numbers read from a picture as `read-from-image`.** Lost for now: see A5. Revisit if the
  owner wants measured sketches read.
- **Store the proposal.** Lost: the signed token needs no table (0019).

## Consequences

- Readings of artwork (logos placed on the garment) are not proposed: the assistant cannot add
  artwork yet (0013).
- The drawing beside the picture shows placeholders for any artwork, since no pictures are loaded
  for it.
