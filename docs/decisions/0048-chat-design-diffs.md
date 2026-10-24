# 0048: Chat edits as design diffs

Status: Accepted (plan v4 W2-B). Owner questions below.
Date: 2026-10-24

## Context

The assistant (decisions 0013, 0019) turns words into editor changes and saves them at once. The spec asks for
"make the sleeves darker", "move the sponsor lower" to be previewed and applied only on confirm, each as a version,
with no regenerated images.

## Decision

1. **`lib/design-diff` holds a typed diff of four kinds**: `set-colour`, `move-placement`, `swap-style`, `change-option`.
   Strict zod; anything else is unreadable. It adds no new way to write a design: each diff becomes one existing `SpecAction`
   (`update-colourway`, `update-artwork`, `set-kit-pattern`, `set-option`) marked `ai-suggested`, and goes through `applyAction`.
2. **`previewDiff(spec, diff, profile, guardrails?)`** works on a copy and returns the changed design and plain sentences
   (from `explainChanges`). It refuses, with a reason, a diff that: names a garment the factory profile does not list; changes
   an option the profile does not list (when the profile lists any; an empty list means no limit is recorded, not "nothing
   may change"); is refused by the garment's own rules; changes nothing; or carries a guardrail blocker. Warnings are shown.
3. **`applyDiff`** re-previews, then saves the actions as one version through an injected save (the route and the existing
   `applyProposalAction` use `saveTrustedActions`, version-checked). Nothing is saved if the preview fails.
4. **Text to diff** (`diffFromText`) uses the existing `TextModelProvider` with a fixed system prompt; the person's words go as a
   quoted JSON string. Text that tries to change the instructions never reaches a model. An unsupported request is refused and the
   four supported changes are named. Tests and the browser tests use stubs (`createStubProvider`, `standInDiffProvider`).
5. **Flow.** `POST /api/projects/[id]/design-diff` previews only: plain changes, front drawings before and after (existing flat
   renderer), and a signed proposal token. Confirm calls the existing `applyProposalAction`; Discard sends nothing, so it leaves no
   trace. The route is metered like the intent route (`textCost`, reserved first, refunded when no model answered).
6. **Moves.** Down is towards the hem. A distance is used only if the person typed it; otherwise the step is 10 mm, labelled
   "Knitwright default step" in the sentence shown.
7. No new dependency, table or migration.

## Not done / honest limits

- **Guardrails are not wired to a real design.** `lib/guardrails` needs panel geometry and placed items, and nothing on main builds
  those from a spec. `previewDiff` takes a `GuardrailRun` hook and the route passes none, so today only the profile and the garment
  rules gate a diff. Wiring it is a follow-up once a spec-to-guardrail-input builder exists.
- The route uses the seeded default profile (labelled as not agreed with a factory); a brand's own profile is not stored yet.
- No live model has been called. Real-model accuracy of the diff prompt is unmeasured.
- The diff panel sits under the chat in the assistant dock; ordinary chat still saves at once (unchanged).

## Owner questions

- Should ordinary chat also stop saving at once and always preview first?
- What step should "move lower" use when no distance is given (default 10 mm, a placeholder)?
- Which options does each factory list as changeable (`structuralOptions` is empty in the default profile)?
