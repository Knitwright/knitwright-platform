# 0075: The editor shell and the Form toolbar

Status: Proposed
Date: 2026-10-30
Plan step: `plans/platform-v5.md`, wave 2, workstream Y2 (spec F-S4 editor)

## Context

Spec F-S4 describes the editor as Fabra's: a top bar with the design's auto-name, a File menu,
undo, credits, a Validate chip, Share and Export; a left rail that toggles between a **Form**, a
**Library** and a **Specs** toolbar; a canvas with **2D | 3D | Tech pack** views that can be shown
side by side; a bottom bar with the colourway and size selectors and a Simulate button; and a
right-hand Design Summary whose rows open their editors in place. The Form toolbar is the one part
that is not Fabra's: Fabra lets a person drag pattern nodes, and Knitwright only ever offers the
options and ranges a factory has approved (spec decision 5, "manufacturable by construction").

What already existed: the one-screen workspace of decision 0048 — a rail of eleven tools, a panel
per tool, the drawing in the middle and the assistant docked on the right — with its saving, undo,
conflict handling and keyboard behaviour, and an end-to-end suite built on all of it. Wave 1 added
the base article catalogue (0066), the rulebook and `<WhyLink>` (0067), the graded drafter (0068),
design object v2 and `validation_results` (0069), and `lib/gltf` with a placeholder model
generator and an unused `ModelViewer`.

Four other workstreams of this wave build panels that live inside the shell: Y3 (2D view,
Library), Y4 (tech pack view, Specs), Y5 (Export) and Y8 (names & numbers, repeat maker).

## Decision

1. **The slot contract comes first and does not move.** `apps/web/lib/editor/slots.ts` names the
   seven slots, the read-only facts a panel is given (`EditorDesign`) and the commands it may call
   (`EditorCommands`). A slot component is a default export taking `EditorSlotProps` and nothing
   else, so the shell can load it with `next/dynamic`. It was the first commit of the branch, before
   the shell itself, because four workstreams code against it. `lib/editor/slots.test.ts` asserts
   the slot names, so a rename fails here before it fails in another workstream.

   `EditorCommands` is the whole seam: `setOption`, `setParameter`, `setSize`, `setColourway`,
   `showView`, `openRail`, `openSummary`, `save` and `needsSimulation`. A slot never writes to the
   design itself and never fetches: the shell checks every value against the article's approved
   options and ranges, saves it, shows the save status and re-drafts. A panel therefore cannot make
   an unmanufacturable design even by mistake.

   Placeholders live in `components/studio/editor/slots.tsx`, this workstream's own file. Nothing is
   written into `view-2d/`, `library/`, `techpack-view/`, `specs/`, `export/`, `names-numbers/` or
   `repeat-maker/`, which belong to other live workstreams.

2. **The existing workspace is moved into the shell, not replaced.** The rail of eleven tools
   (`ToolRail`), its panels (`ToolPanels`), `useWorkspace`, `useEditor` and the assistant dock are
   the same code, now inside the **Form** toolbar and the right-hand column. The Form toolbar's own
   controls — the article's option tiles and parameter sliders — are drawn above the open tool's
   panel. Every existing end-to-end journey therefore still finds the rail, the panels, the save
   status, the version chip, undo, the pinned Share and Tech pack links and the Journey navigation
   where it looks for them.

   Two consequences worth writing down:

   - The tool panels come **first in the markup** and are placed in the second grid row with
     `row-start`, so Tab from the tool rail still reaches the open panel rather than the article's
     sliders. The visual order is the spec's; the reading order is the one the workspace already had.
   - The Form toolbar's option groups are `role="radiogroup"`, not `fieldset`/`legend`. The garment
     registry already has an option group called **Collar** in the Garment panel, and a second group
     of the same name would be one control to a screen reader and one locator to a test. The heading
     also names the article ("Collar options of JSY-SS-01"), so the two are told apart by sight.

3. **The form lives in the address, because no action can store it yet.** Decision 0069 added
   `article.parameters` to the stored spec but no `SpecAction` that writes it, and
   `lib/garment/action-schema.ts` belongs to no wave-2 workstream. So the chosen options and
   parameter values are search parameters (`?opt=collar:C02&par=body_length_offset:20`), alongside
   the rail segment, the canvas views and the shown size, exactly as the open tool already is
   (`?tool=`, decision 0048). A reload or a shared link opens the same design in the same form, and
   the server re-drafts it; nothing is stored, so nothing is stored wrongly. `lib/editor/address.ts`
   reads and writes them and `form.ts` drops anything the article does not offer.

   **This is a gap, not a design.** Until a `set-article-parameter` action exists, a form change is
   not a version of the design, does not reach validation and does not reach the tech pack. The
   owner question is on the pull request.

4. **Out of range is impossible, and checked again anyway.** A slider's `min`, `max` and `step` are
   the catalogue's own (`parameter_defs`), so the control cannot reach another value; `withinRange`
   checks every value again before it is kept, so a hand-written address cannot either; and the
   drafter refuses it a third time (`lib/parametric` `resolveInput`), reporting a finding rather than
   clamping. An option tile exists only for a row of `option_defs`. A parameter the catalogue gave no
   ends gets no slider at all rather than a guessed one.

5. **"Not yet sampled" is a warning on the design, not a value the factory cannot make.** The plan
   asks for "a lock and 'Not yet sampled', with a Why? link" on an option with no approved golden
   sample. No golden samples exist yet (F-S7 is Y7's, and decision 0010 keeps every article at
   `draft v0.1`), so every option and every range of every article is unsampled today. Disabling them
   all would leave a Form toolbar that can change nothing.

   So: an unsampled option or range carries a padlock mark, the words "Not yet sampled", the sentence
   "No golden sample has signed this off yet, so it is not approved for production" and a **Why?**
   link, and it can still be chosen. Choosing it raises a warning in the Validate list, and the
   drafter raises its own for a range moved off its default. When Y7 lands golden samples,
   `approvedBySampleId` fills in and the marks disappear by themselves, with no code change.

6. **3D is on by default for a base article the drafter can draw, with no `SHOW_3D` switch.**
   `lib/editor/page-state.ts` opens the canvas on **3D** when `lib/parametric` drafted the shown
   size, and on **2D** otherwise. The model is the placeholder generator's
   (`lib/gltf/generatePlaceholder`) built from the drafted panels, shown through the existing
   `components/gltf/ModelViewer`, and the label "placeholder, not an artist model" is beside it at
   all times with the sentence "It shows where the panels are, not how the garment hangs". The older
   trial under the drawing (decision 0027) is untouched and still behind `SHOW_3D`.

   The model is built only when the 3D view is actually on the canvas, so a page showing 2D alone
   does not carry it: it is about 170 KB of JSON for `JSY-SS-01`.

7. **The Simulate chip tells the truth about the model.** `simulationState(form, simulated,
   hasModel)` gives "Not sim ready" while there is no model or while the form has moved on from the
   one the shown model was built from, and "Simulated" only when the two agree. Pressing Simulate
   asks the server for the draft and the model again. There is no drape simulation yet, and the chip
   never claims one: it reports whether the shape on the canvas is the shape the form describes.

8. **Every row, range, option and finding carries a rule.** The Validate chip's list, the option
   tiles, the sliders and the Design Summary's Stitches rows all carry a `ruleId` and a Why? link.
   Where the catalogue row has no rule the id is `R-GAP-000`, which the rulebook seeds as "No rule
   written yet; the team has been told" and which logs a gap when a person opens it. The Validate
   list is the stored checks of the last save (0069), plus the drafter's own findings, plus the
   unsampled options and ranges, each line counted once.

9. **The editor has its own Why? trigger.** `components/rulebook/WhyPopover` draws its trigger at
   the height of its text, about 20 px, and decision 0064 holds every screen to a 40 px tap target.
   The editor is the first screen to put a Why? on a phone, so
   `components/studio/editor/WhyButton.tsx` draws a 40 px trigger and reuses the rulebook's own
   `whyButtonProps`, `whyPanelProps`, `WhyCard` and `explainRuleAction` unchanged. Only the size of
   the trigger is this workstream's. The rulebook's own popover should be raised to 40 px by whoever
   next owns that file.

10. **The credits counter is not repeated.** Spec F-S4 puts a credits counter in the editor's top
    bar. `components/credits/BalanceChip` already shows it in the studio header, one row above the
    editor and on every studio screen, with `data-testid="credit-balance"`. A second counter would be
    two elements with the same test id and the same number twice on one screen, so the top bar leaves
    it to the header.

11. **The Design Summary is built from the factory file's own lines.** Fabrics and Trims & labels
    come from `lib/workspace/summaries` (which reads `lib/techpack`), colours and graphics from the
    editor's existing rows, pattern fills from the article's chosen `pattern_fill` option, and
    stitches from `article_construction`. The summary and the tech pack therefore cannot disagree,
    because they are the same sums. Every editable row opens its tool through
    `lib/workspace/tools.toolForSection`.

12. **The bottom bar's "+ New colourway" uses the kit names of the spec.** A new colourway takes the
    next of Home, Away, GK the design has not used, then numbers them, through the existing
    `add-colourway` action. A design made before keeps the name it has ("Main colourway"); nothing is
    renamed.

## What this does not do

- No migration, and no change to the stored design. A form change is not yet a version (decision 3).
- The Library, Specs, 2D, Tech pack and Export panels are labelled placeholders. The Tech pack view
  also carries a real link to the factory file, so it is not a dead end.
- No drape simulation, no artist model, no picking on the 3D view (Y4's Specs tools will need it).
- The Design Summary is hidden between 1024 px and 1279 px, where there is no room for a fourth
  column beside the canvas; it is shown above 1280 px and, stacked under the canvas, on a phone.

## Owner questions

1. **A form change cannot be saved.** Decision 0069 added `article.parameters` to the spec and no
   action that writes it. The smallest fix is one more member of `specActionSchema` —
   `{ type: "set-article", article: { baseArticleCode, productionClass, parameters } }` — plus its
   case in `apply-action.ts`, both in `lib/garment`, which belongs to no wave-2 workstream. Until
   then the Form toolbar's choices live only in the address: they re-draft, they redraw the 3D view
   and they survive a reload or a shared link, but they are not part of the design object, do not
   reach validation and do not reach the tech pack. **Who owns that change, and in which wave?**
2. **Is "Not yet sampled" a warning or a lock?** Decision 5 reads it as a warning, because reading
   it as a lock would disable every option of every article until Y7 lands golden samples. If the
   owner wants a hard lock, the one-line change is in `lib/editor/form.ts`, and the Form toolbar then
   offers only each group's default until the samples exist.
3. **The auto-name's wording.** Spec F-S4 shows "Crew neck · Coverstitch sleeve · +20 mm length".
   The catalogue's labels carry the whole specification ("Crew neck, 1x1 rib, 20 mm finished"), so
   the name uses the first clause of each and writes a length as "Body length +20 mm", giving
   "Crew neck · Coverstitch hem · Plain · Body length +20 mm". Is that the wording the owner wants,
   and should the name replace the typed design name rather than sitting under it?
4. **Does the editor need its own credits counter?** Decision 10 says no, because the studio header
   already shows one. If the owner wants one in the editor bar as the spec draws it, the header's
   should come out at the same time.

## Rules with no entry yet

`R-GAP-000` is used for the `pattern_fill` options of `JSY-SS-01`, which `article.json` gives no
rule, and for a "not drafted yet" finding the drafter raised without one. Both are the catalogue's
and the drafter's own gaps, not new ones.

## Files

- `apps/web/lib/editor/**` — the contract and the shell's sums, all pure and tested.
- `apps/web/components/studio/editor/**` — the shell: top bar, rail segments, Form toolbar, canvas,
  bottom bar, Design Summary, the 3D view and the slot placeholders.
- `apps/web/app/(app)/studio/[projectId]/page.tsx` — reads the design, the base article and the last
  validation result and hands them over.
- `apps/web/e2e/editor-shell.spec.ts` — the shell against spec F-S4.
