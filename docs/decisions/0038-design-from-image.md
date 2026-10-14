# 0038: Design from the user's image

Status: Proposed (phase A built; phase B waits for W7b and W7c)
Date: 2026-10-15
Plan step: production outputs, W7d (`plans/production-outputs.md`)

## Context

The owner's correction of 2026-10-14: a club must be able to hand over a picture of a design (a mockup, a flat, a photo of a kit, a sketch) and get an editable design mapped onto the real pattern pieces. W7a gave the target (the artwork stack) and the interface for mapping it to pieces. This record covers phase A: reading the picture, finding the garment's outline and landmarks, and reading the colours. Names, numbers, crests and sponsors (stage 5) and repeating patterns (stage 7) need W7b's tile finder and W7c's generators, and wait for phase B.

## Decision

1. **A close reading, never a copy.** The screen is headed "Close reading of your picture". The words "exact", "matches your picture" and "identical" are never used (a test scans every string in `lib/design-import/` and `components/design-import/`). The accuracy limits (shading baked into colours, photos flattened approximately, small lettering misread, logos redrawn, absent views left empty, repeat size estimated) are always on screen.
2. **Staged pipeline in `lib/design-import/`.** Each stage returns a value, a confidence from 0 to 1 and a plain note; every value has provenance `read-from-image`.
   - *Reading* (`read.ts`): one vision call through the text-model provider, answered through a reading tool of its own (`describe_picture`), not the garment reply tool. To allow that, `ModelRequest` gains one optional field, `replyTool`, and the Anthropic and OpenAI providers use it when present; every existing call is unchanged. The reply is parsed and bounded like a chat reply (`extractJsonObject`, a Zod schema with fractions in 0..1, caps on counts). The schema has no measurement field, so a model cannot return one. At most three vision calls and two image edits per import (`lib/providers/catalog.ts`).
   - *Views and outline* (`outline.ts`, `views.ts`): classical. The background is the colour the four corners agree on (or transparency); the garment is the largest connected region that differs; holes inside it are filled; the boundary is traced (Moore neighbour) and simplified (Douglas-Peucker). The model's view boxes only name the regions the pixels give. An image-model clean-up (`cleanup.ts`, fal's edit model through `cleanup-image.ts`) runs only when no garment stands out, once per import at most twice, with fixed prompts that carry nothing from the user or the picture; what it makes is marked generated in the report.
   - *Landmarks and fit* (`landmarks.ts`, `fit.ts`): neck gap, shoulder points, underarms (reflex corners), hem corners and sleeve ends from the silhouette, seeded by the model's guesses only where the outline gives nothing. A landmark a person drags is marked "moved by you" and fully trusted; `refitView` redoes the fit from the stored landmarks without the picture or a model call. A flat or mockup is fitted by a least-squares affine map; a photo by a four-point homography first, with the note "approximate". The map takes pixels to design millimetres; `placeOnPieces` then asks W7a's `PieceMapper` where each landmark lands in a size. Until W1 attaches a pattern block, the template is a clearly labelled starter outline (`template.ts`, decision 0034's flat-outline fallback behind the same interface); the report says so.
   - *Colours* (`colours.ts`): garment pixels well inside the outline, outside the marks' boxes, grouped in Lab, near colours merged (deltaE below 12), specks dropped, at most six returned as screen colours. No code is guessed.
   - *Output* (`stack.ts`, `report.ts`): an `ArtworkStack` (colour list, one ground layer over the views that are in the picture, one colourway "As read from your picture") and a report. A view that is not in the picture is named as left empty, never invented. Marks seen are listed, not placed.
3. **Text in the picture is data.** The instructions say so; nothing read from a picture is ever put into another prompt; the reply is parsed against a schema; any text that `looksLikeOverride` flags (the check used for chat) is dropped, counted and reported ("Some words in the picture looked like instructions"); other text is stripped of control and direction characters and capped at 40 characters.
4. **Nothing is saved as the design until the person accepts.** A reading is a row in `design_imports` (migration `20261015060200`): brand-scoped, row level security, members read, no browser write grant, no delete grant. Statuses: reading, ready, failed, accepted, discarded. Accepting records who, when and which layers, and hands back the accepted stack. **Writing the stack into a design version is not done here:** it needs the stack-aware editor (W3 and W5 phase B), and `writeStack` rewrites the older fields, which this release does not take on. The route and service never touch `spec_versions` or `projects` (a test reads the tables a reading touches).
5. **Switch and cost.** The feature is off unless `DESIGN_FROM_PICTURE=true` (open item P12: privacy wording). The route reserves the most an import can cost (three reads plus, only when the fal key is set, two edits) before it runs and refunds it when a call fails. The edit price is fal's published $0.08 as recorded in `docs/data-processing.md` on 2026-10-13: to be read again. A per-brand daily cap (`DESIGN_IMPORT_DAILY_PER_BRAND`, proposed 20, open item P16) is counted from the table; the per-person pace is a rate limit.
6. **Pictures go to two outside services.** The vision provider always; fal's edit model only for a clean-up. `docs/data-processing.md` needs one added paragraph (W4 owns the file); it is sent on the pull request.

## Alternatives

- Ask the vision model for landmarks and measure from those: slower, dearer, and model coordinates are not trustworthy to a pixel; they stay as seeds and fall-backs.
- Put the reading in the garment reply tool's `reason` field: capped at 400 characters and wrong in kind. Rejected for the optional `replyTool`.
- Write the accepted stack into the design now: changes the older fields through `writeStack`; deferred to the editor work.

## Consequences

- Phase B adds, behind the same `ImportOutcome`: marks as `text`/`player-mark`/`graphic` layers (W7b crops), the all-over pattern (W7b `findRepeat`, W7c generator fitting), and a real template from W1's pieces through W3's mapper.
- The quality of the reading on real pictures is unmeasured: tests use synthetic pictures made from known shapes and recorded model replies. A golden set of real images (P13) is owed before any quality claim.
- `ModelRequest.replyTool` is a small widening of a shared interface; the other callers are unaffected.
