# 0117: Wave 2's editor panels, mounted

Status: Accepted. Every slot of the editor's contract now draws the panel its workstream built; two
things are deliberately left unmounted and say so here. Owner questions at the end.
Index: Accepted; all seven editor slots mounted, two panels left out with reasons
Date: 2026-11-02
Plan step: plan v5, the wiring that follows the code review (`docs/reviews/code-v5.md`, decision
0112, findings A7 to A14). Spec: F-S4, F-S5, F-S6.

## Context

Decision 0075 wrote the editor's slot contract first, before the shell itself, because four
workstreams were going to code against it: `lib/editor/slots.ts` names seven slots, the read-only
facts a panel is given (`EditorDesign`) and the nine commands it may call (`EditorCommands`).
Y3, Y4, Y5 and Y8 each built their panels against it. Z1 built the inspiration board and Z2 the Ask
box, both of which decision 0082 and decision 0083 say in their own words were left for the Studio's
design surface.

**Nothing built the props.** No file in the repository constructed an `EditorDesign` or an
`EditorCommands` outside a test fixture, so every slot still drew `slotPlaceholder(id)` and two of
the seven — Y8's names & numbers and repeat maker — had no reference anywhere at all. The code
review counted it as eight of its twenty-two unmounted components (A7 to A14) and called the editor
the worst of them, because it is the product's main screen.

Two further facts shaped how this was done:

- **None of these panels had ever been opened in a browser**, and none had ever been scanned by
  axe. `e2e/editor-library-2d.spec.ts` skipped every one of its own tests with the missing wiring
  as the stated reason, and decision 0077 says there is no end-to-end test "because nothing draws
  these panels". That is why nobody noticed.
- **The precedent is recent.** The wave-4 wiring change and decision 0108 did exactly this for
  `lib/launch`'s shell, including the detail that a component created while the shell renders is
  refused by `react-hooks/static-components`, so a registry is a spread map rather than a function
  call.

## Decision

1. **One place makes the props.** `components/studio/editor/slot-props.ts` builds `EditorSlotProps`
   from what the shell already holds: `useEditor`'s `working` spec (so a panel reads the design as
   it will be once the saves in flight land), the base article, the form, the size and colourway on
   the canvas, the drafter's answer and `busy`. The commands are the shell's own `useShell` setters
   plus `editor.saveAction`, so a panel still cannot fetch, cannot write to the design and cannot
   choose a value the article does not offer: every one of those is checked on the way through, as
   decision 0075 item 1 promised. It is a plain function, not a component, for the reason above.

2. **Each panel is mounted in the shell's own directory**, so nothing is written into a directory
   another live workstream owns, which is the rule decision 0075 set for the placeholders:

   | Slot | Panel | Where it is drawn |
   |---|---|---|
   | `library` | Y3's `LibraryToolbar` | `RailSlots.tsx`, the Library segment of the left rail |
   | `specs` | Y4's `SpecsToolbar` | `RailSlots.tsx`, the Specs segment |
   | `view-2d` | Y3's `PatternView` | `CanvasFrame.tsx`, under the flat drawing in the 2D region |
   | `tech-pack` | Y4's `TechPackView` | `CanvasFrame.tsx`, the Tech pack region |
   | `export` | Y5's `ExportPanel` | `SidePanel.tsx`, opened by the top bar's Export button |
   | `names-numbers` | Y8's panel | `SidePanel.tsx`, opened by the Design Summary's own row |
   | `repeat-maker` | Y8's panel | `RailSlots.tsx`, under the Library toolbar's Pattern fills |

   The two that the contract declared and the shell had never drawn a placeholder for are placed
   where the workstreams around them pointed, not where this change found room. **The repeat
   maker** goes under Pattern fills because `lib/panel-layers/library.ts` already said, in the
   reason it gives for a style a design cannot store, that "the repeat maker (Y8) publishes a tile
   instead". **Names & numbers** is a Design Summary row in spec F-S4, and the spec says clicking a
   row opens its editor in the same panel.

3. **`openSummary` and `needsSimulation` are implemented, because mounting the panels required it.**
   Both are on `EditorCommands` and nothing had implemented either. `openSummary(section)` opens
   that section's editor: for the one section whose editor is a slot panel it shows in the
   right-hand panel, and for the rest it opens the workspace tool in the left rail exactly as the
   Design Summary did before. `needsSimulation()` takes the Simulate chip to "Not sim ready" until
   Simulate is pressed, which is what the contract says it is for.

   `DesignSummary` now reports the **section** a row belongs to rather than a tool id, because the
   shell is what knows where a section's editor lives. A section with nothing in it yet is a button
   too: Names & numbers is the editor for that section, so a design with no names and numbers could
   otherwise never open it.

4. **Z1's board and Z2's box sit where their own records left them.** The inspiration board goes in
   the Inspiration group of the Library toolbar, the labelled slot decision 0082 names ("Y3 leaves a
   labelled Inspiration slot in the editor's Library panel"), and `INSPIRATION_SLOT`'s words now say
   where the board is instead of that it is coming in wave 3. The Ask box goes under the Specs
   toolbar: decision 0083 left it for "the Studio's design surface", and F-S5 asks for a box "scoped
   to the current design".

   **The board and the repeat maker are mounted the first time the Library toolbar is opened**, not
   on every editor load, and then kept, so a draft and a board already read survive a switch to
   another toolbar. All three toolbars are drawn at once so a hidden panel keeps what was typed in
   it, and neither of these two belongs there unasked: the board asks its server action for the
   whole board as soon as it is mounted, which would be a round trip on every editor page view, and
   the repeat maker carries the ordinary artwork upload (decision 0081 item 11), whose rights tick
   and file field would be a second copy of the Logos tool's own on every editor page. That second
   copy is also why `e2e/flats.spec.ts` now scopes its rights tick and its file field to the Logos
   tool's panel: the locator was never safe against a second upload anywhere on the screen.

   **The Ask box is scoped to the article and not to a method.** The rulebook scopes a rule to a
   make method ("sublimation") and no method is on the slot contract: a design's artwork carries a
   technique per piece of artwork, not one method for the garment, so sending one of them would be
   a guess. `method` is left out.

5. **The placeholder is gone with the last slot that needed it.** `slotPlaceholder`, its words and
   `components/studio/editor/slots.tsx` are deleted: all seven slots are filled, so the contract no
   longer ships sentences naming a workstream that owes a panel, and no `editor-slot-*` box exists
   on any page. This is the loud note decision 0075 asked for about a change to `lib/editor/slots.ts`
   — the types and the slot names are untouched, only the placeholder went.

6. **The contrast facts already measured are not re-broken.** Secondary text in everything that is
   newly visible is `text-ink-2`, because `text-chalk-muted` on `glass` fails axe AA (decisions
   0095, 0102 and 0108 each record the measurement). Because none of the editor had ever been
   scanned, that sweep covers `components/studio/**` and `components/credits/PriceNote.tsx`, which
   the Export panel draws. `PatternView`'s inner `<section>` loses its `aria-label`: it repeated the
   canvas region's own name one level up, which is two places called one thing to a screen reader —
   the exact reason decision 0075 gave for the placeholder not being a landmark.

7. **Every panel is opened in a browser and scanned.** `e2e/editor-panels.spec.ts` opens all six
   surfaces, asserts each draws its own content and that no `editor-slot-*` placeholder is left
   anywhere, and runs axe plus a sideways-scroll check on each at the browser tests' own desktop
   width and again at 390 x 844. Y3's self-skips are gone and its tests run as they were written.

8. **The toolbar toggle stacks on a wide screen, because the column it lives in is 4.75rem.** This
   is what opening the panels in a browser found, and it is the whole reason item 7 was worth
   doing. The segmented toggle for Form, Library and Specs sits in the left rail's icon column, and
   side by side three words do not go in 4.75rem: the strip is 8.5rem at its very narrowest (three
   2.5rem tabs, two 0.25rem gaps and 0.25rem of padding either side), so it overflowed its column
   to the right, across the 0.75rem gap and into the toolbar panel column beside it. The open panel
   comes later in the document, which puts it above that overflow in the hit test, so the panel
   swallowed every click meant for the **third** tab. Specs was on the screen, visible and enabled,
   and no pointer could press it — Playwright's own words were "element is visible, enabled and
   stable … `<h2>`Library`</h2>` … intercepts pointer events", and then sixty seconds of retries.
   A person could not switch toolbars with a pointer at all.

   Two things hid it. The **keyboard** path worked throughout: `e2e/editor-shell.spec.ts` drives
   the toggle with the arrow keys, and focus does not care what is painted over a button, so the
   one browser test of the toggle exercised the one path that could not see the fault. And only the
   **third** tab was covered: Library's centre lands at x≈68, still inside the 76px column, so
   `e2e/editor-library-2d.spec.ts`'s own click on it passed and the fault looked arbitrary.

   The toggle is therefore upright from `lg`, the way the tool rail under it and the launch shell's
   icon rail both are: each tab is the full 4.25rem width of the column, and nothing leaves the
   box. `aria-orientation` follows, so the arrow keys and the tab list agree about which way it
   runs. No `z-index` and no `pointer-events` rule was involved; a tab drawn over is a tab laid out
   in the wrong box, and it is the box that changed.

   **What was tried first, and why it was backed out.** Spanning the toggle across the rail *and*
   the panel reads better and is closer to the spec's "segmented toggle", and it was written that
   way first. It costs the panel beneath it 3.75rem of height, and the shell has no 3.75rem to
   spare: that was enough to push the Media tool's own panel below the fold of the rail's scroll
   box, where the `IntersectionObserver` of `useMediaScreen.ts` never fires, so the panel waits on
   "Looking for this design's media…" for ever and `e2e/media-screen.spec.ts` failed twice (CI run
   41492407412). Hiding the icon column under the other two toolbars while keeping its track in the
   column list cost the panel its width as well — a grid places what it is given, so the panel
   became the first item and was laid out 76px wide, one word to a line. Both are recorded here
   rather than in a branch nobody will read: the rail's widths and heights are decision 0075's, and
   the toggle's shape on a wide screen is owner question 6.

   The regression guard is a measurement, not a click: `e2e/editor-panels.spec.ts` compares each
   tab's own box with its strip's and names any tab drawn outside it, so a recurrence says which
   tab is wrong instead of timing out after a minute and blaming the panel.

9. **The drawing on the canvas can be scrolled from a keyboard.** The 2D view's drawing scrolls
   inside its own box on a wide screen, where the shell's height is fixed, and the only thing in
   that box is a picture: nothing in it could take focus, so a person on a keyboard could not
   scroll it at all. That is WCAG 2.1.1 and axe's `scrollable-region-focusable`, and it is
   pre-existing — the editor had simply never been scanned at desktop width with the 2D view open,
   because the Specs tab could not be pressed to get there (item 8). `DesignCanvas` gives the box
   `tabIndex={0}`; the section around it already names it.

## What is deliberately left unmounted

Two things, each with the reason in the code as well as here. An empty panel that looks real is
worse than an honest absence.

- **`components/rulebook/ask/BestPracticeCard.tsx` and `lib/rulebook/ask/actions.ts`'s
  `bestPracticeAction`.** Both halves, screen and server, are built and neither is mounted; a sweep
  for unreached server actions and unreachable components finds both, so this paragraph is the
  record it should land on. The card is the rulebook's Best practice column "for the selected part"
  (spec F-S5 v2), and a part is one of the six `PARTS` of `lib/rulebook/ask/best-practice.ts`:
  collar, sleeve, body, artwork, names, labels. `bestPracticeAction` cannot be called without one
  of those six keys. **Nothing in the editor selects a part in that sense.** The Specs toolbar's
  picker selects a *panel* of the pattern (front, back, sleeve), which is not the same vocabulary
  and covers three of the six at best; the Form toolbar's option groups are not a selection; and
  the Design Summary's seven sections are not those six either. Mounting the card therefore means
  either inventing a part chooser nobody specified, or guessing a mapping from pattern panel to
  garment part and leaving collar, artwork, names and labels unreachable. Both are product
  decisions, so this is owner question 1 rather than a guess, and the card stays off the screen
  until it is answered. Its words and its `R-GAP-000` line are covered by Z2's own tests
  (`components/rulebook/ask/AskAnswer.test.ts`), and decision 0083's own honest limit already says
  "nothing calls any of this yet".
- **A per-player 3D preview on the names & numbers panel** (decision 0081's and the review's
  D-19). `lib/garment/names-numbers.ts` says a player's own name belongs to the team order, which
  is not built, so the panel shows the spec's own SMITH 7 sample and says "Not drawn to the
  finished size". That is Y8's own honest limit and this change does not touch it.

## Two claims of the review checked and found already true

- **A11's second half, "plus the Excel download address the route must supply".** The route already
  supplies it: `EXPORT_FORMATS` is `["pdf", "xlsx", "svg"]`, `app/api/projects/[projectId]/exports/[format]`
  accepts `xlsx`, `serveExport` builds the workbook, and the Excel file is deliberately free of
  credits while the PDF is not. The Export panel's address was right all along; nothing had ever
  clicked it. `e2e/editor-panels.spec.ts` now asserts the address the panel offers is the one the
  route serves, and `e2e/exports.spec.ts` already downloads the file.
- **The export gate does not shut on a fresh design.** `reviewFromDesign` reports blockers only, and
  the drafter's unsampled options are warnings, so the gate is open and the panel says instead that
  the Review tab has not checked this version yet. The e2e test asserts that sentence, so a change
  that silently shut the gate would fail.

## What this does not do

- No migration, no change to the stored design, and no change to the slot contract's types or slot
  names.
- The old workspace's own names-and-numbers controls (decision 0027,
  `components/studio/NamesNumbersControls.tsx`) are untouched and still on the `Names` tool of the
  rail. The editor therefore has **two** names-and-numbers editors: 0027's, which the existing
  end-to-end journey drives, and Y8's F-S4 panel, which the Design Summary row opens. Owner
  question 2.
- A form change still lives only in the address (decision 0075 item 3 and the review's D-5): no
  `SpecAction` writes `article.parameters`, so a panel that calls `setOption` or `setParameter`
  changes the draft and the canvas and not the stored design. Mounting the panels does not change
  that. A **mark** the Specs toolbar draws is a different matter: decision 0121 (PR #151) made a
  point of measure and a callout part of the stored design, and this branch is what puts that panel
  on a screen, so mounting it is what makes 0121's fix reachable at all.
- Nothing was done about the review's other fourteen unmounted components (A1 to A6 and A15 to
  A22): those are other waves' and other owners'.

## Evidence

| Claim | Test |
|---|---|
| Every one of the nine commands the contract declares reaches something, and a panel is given the design and the commands and nothing else | `components/studio/editor/slot-props.test.ts` — the test that would have caught this whole class of fault |
| Every slot draws its own panel, and no placeholder is left on the page | `e2e/editor-panels.spec.ts`, "draws each one's own content where a placeholder used to be" |
| The Library toolbar carries the repeat maker and the inspiration board | same file, "gives the Library toolbar the repeat maker and the inspiration board under it" |
| The Ask box is on the design surface and refuses an empty question | same file, "puts the Ask box under the Specs toolbar" |
| All three toolbar tabs are inside their own strip, so a pointer can reach every one of them | same file, "keeps all three toolbar tabs inside their own strip" |
| The Export panel offers the Excel file at the address the route serves | same file, "offers the tech pack's own files from the Export panel" |
| A Design Summary row opens Y8's panel in the right-hand panel, and comes back | `e2e/editor-shell.spec.ts`, "opens the Names & numbers panel in the right-hand panel" |
| No serious or critical axe violation and no sideways scroll, at desktop and at 390 x 844 | `e2e/editor-panels.spec.ts`, the two scanning tests |
| Y3's panels against the real route and the real database, with no self-skips | `e2e/editor-library-2d.spec.ts` |
| The contract has no placeholder left to name a workstream | `lib/editor/slots.test.ts` |
| The Inspiration slot's words point at the board rather than at wave 3 | `lib/panel-layers/library.test.ts` |

## Owner questions

1. **The best-practice card.** F-S5 asks for a card "when a part is selected", and no editor surface
   selects one of the rulebook's six parts. Should the editor gain a part chooser beside the Ask box,
   should the Specs toolbar's panel selection be mapped to a part, or should the card wait for the
   piece mapper (decision 0053) that would make a click on the canvas mean a part? Until this is
   answered, `BestPracticeCard` and `bestPracticeAction` stay built and unmounted on purpose — the
   half of Ask that spec F-S5 asks for and that no one can reach.
   **ANSWERED: a part chooser beside the Ask box, decision 0126.** The mapping was the option to
   avoid — the Specs toolbar picks a pattern panel, a different vocabulary covering three of the six
   parts at best — and the piece mapper is still worth building; the chooser is six buttons and is
   deleted in one commit if it arrives.
2. **Two names-and-numbers editors.** Decision 0027's controls are on the `Names` tool and Y8's
   F-S4 panel opens from the Design Summary. They write the same stored fields, so they cannot
   disagree, but a person can meet either. Which one survives, and may the other be taken out with
   the end-to-end journey that drives it?
3. **Where the repeat maker belongs.** It is under the Library toolbar's Pattern fills here, which
   is where Y3's own words pointed. Spec F-S4 also lists "Pattern fill (repeat maker)" as a Studio
   home action card and "Pattern fills" in the sidebar, both of which are "later" today. Should the
   maker also have a screen of its own outside a design, and if so does a tile made there still
   publish to the brand's library the same way?
4. **The Ask box's place.** It is under the Specs toolbar. The assistant dock on the right is the
   other candidate and is where a founder already types a question. Should the two be one box?
5. **The right-hand panel between 1024 px and 1279 px.** Decision 0075 hides that column there,
   because there is no room for a fourth column beside the canvas. Now that the column carries the
   Export panel and Names & numbers as well as the Design Summary, **neither can be opened at all
   at a laptop width in that band** — the Export button toggles a panel that is not drawn. The same
   was true of the Export placeholder before this change, so nothing got worse, but it is now a real
   panel a person cannot reach. Should the column become a sheet over the canvas in that band, or
   should the breakpoint move?
6. **The shape of the toolbar toggle on a wide screen.** Spec F-S4 says "a segmented toggle", which
   is a horizontal control, and the rail's icon column is 4.75rem, which will not hold three words
   side by side (item 8). It is upright there now, which fits and costs the panel beside it
   nothing. The two ways to make it horizontal both take something from a shell that has nothing
   spare: widening the icon column narrows the canvas, and spanning the toggle across the rail
   takes 3.75rem of height off the toolbar panel, which is already enough to push a lazily loaded
   tool panel out of sight. Three words in a gutter, a wider rail, or shorter labels — which?
   **ANSWERED: it stays upright, decision 0126.** Neither horizontal route is worth what it costs —
   the canvas is the point of that screen, and the spanning version was proved in CI to strand the
   Media tool's panel below the fold. The departure from the spec's wording is deliberate and
   recorded.
