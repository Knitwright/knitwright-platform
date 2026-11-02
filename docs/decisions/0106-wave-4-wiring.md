# 0106: Wave 4 wired — the panels mounted, the 3D view answering, and L2's run loop closed

Status: Proposed; the panels are on a screen and scanned by axe for the first time, L2's run loop is closed end to
end, the carousel is still disabled for want of a second colourway in the viewer, owner questions listed
Index: Proposed; L4's five rail panels, L4's marketing board, L5's AI video board, L6's info card, run summary and canvas are mounted and scanned by axe for the first time, L2's mockup board now draws a real file through L1's one writer, both 3D views answer the camera so the flip and the kit reveal can be recorded, the carousel waits on a second colourway reaching the viewer, five panels still hold their placeholders, owner questions listed
Index title: Wave 4 wired: the panels mounted, the 3D view answering, and L2's run loop closed
Date: 2026-11-02
Plan step: platform-v5 wave 4 wiring. Owns no feature: it connects L2 (0092), L4 (0094), L5 (0095) and L6 (0096) to
L1's contract (0091) and proves the result in a browser. Answers the "what I left" section of each of those four
records.

## Context

Five workstreams finished wave 4 and each stopped at its ownership boundary, which was the right thing to do:
`components/launch/{RailPanels,Inspector,BoardCanvas}.tsx` and `components/studio/Preview3D.tsx` belong to other
workstreams, and five branches editing the same two lines in one wave would have been four conflicts. The result was
a wave that was **built and not usable**: eleven panels existed, were tested against `panelDouble()`, and were drawn
nowhere; a renderer could draw a mockup and had no way to be asked; and a recorder asked a 3D view two questions
nothing answered.

It also meant something less obvious, and worse: **none of those panels had ever been opened in a browser or scanned
by axe.** Each of the four records says so plainly in its own consequences. "Built" was therefore less verified than
it sounded, and the axe scan was the part most likely to find something, because contrast and focus order are
properties of a panel on a page rather than of a component in a unit test.

## Decision

1. **A panel is mounted by a map made once, not by a function called while the shell renders.**
   `components/launch/RailPanels.tsx` and `Inspector.tsx` each hold one `BUILT` map keyed by `LaunchPanelId`, with
   L4's own `MARKETING_PANEL_COMPONENTS` spread into it. L4 asked for `marketingPanel(id)`, a lookup function; the
   map is the same lookup without a function call during render, which `react-hooks/static-components` refuses --
   a component created while rendering loses its state on every redraw, and a panel with a half-typed headline in it
   is exactly the kind that would notice.

   Mounted: `text`, `elements`, `pattern-fills`, `assistant`, `layers` and `board-marketing` (L4);
   `ai-image` and `board-ai-image` (L3, decision 0093); `board-ai-video` (L5); `board-info-card` and
   `flow-run` (L6), beside L2's `mockups`, `photos` and `board-mockup`. **Every board kind of the
   contract now has a panel**, so a selected board never draws a placeholder.
   **Still placeholders, and still saying whose they are**: `templates` and `likes` (L8), `uploads`
   and `brand` (L7).

   `components/launch/panel-mounting.test.ts` reads both maps rather than trusting them: a lookup
   that misses is silent -- the shell draws the labelled placeholder and nothing says the id and the
   map disagree -- and a map key is a typo away. It holds the four that are left as a list, which is
   the one place to look for what this wave has not finished, and the browser test holds the same
   four.

2. **The run summary is mounted with nothing selected, because it is about the canvas and not about a board**, and
   it is wrapped in a `shrink-0` so it has a height.
   `flow-run` is the one panel of the contract that is neither a rail panel nor a board kind's inspector, so L1 left
   it with no place to be drawn. It goes in the inspector's project panel, under the colours and the tools, and only
   once the canvas has a board -- an empty canvas has no run to summarise. Run all goes through L6's own
   `runFlowAction` with the figure the person was shown, which that action checks against its own estimate, so the
   shell still never charges anything itself.

   The `shrink-0` is not decoration: the inspector is a scrolling flex column and the run summary
   carries its own `min-h-0`, so it was squeezed to **no height at all** once the colours and the
   tools had taken the room. It rendered, axe could see it, and a person could not. The browser test
   found it as `Received: hidden` against an element that was plainly in the markup.

3. **L1's board list is replaced by L6's flow canvas.** Decision 0091 item 2 laid the boards out in a wrapping row
   and said the places, the curves and the dragging were for whoever owned the flow; 0096 built them, against the
   same `LaunchCommands`. `BoardCanvas` now owns two things only: the empty state that asks for a Design board, and
   the notice on a canvas with boards and no design. One line of L6's own file was changed with it: the board's
   `article` carries `aria-label="<kind> board"`, as L1's board did, so a screen reader and a test both ask for "the
   Mockup board" rather than for the third card on the canvas.

   **One control was lost and is named here rather than quietly dropped**: L1's canvas had a "Select the picture"
   button on a finished board, which L6's card does not have. The picture is still selectable -- the task bar's own
   actions select it -- but a person who used that button will not find it.

   **And the canvas did not work at all with a mouse until the browser tests said so.** Every control on a board
   card -- Select, Regenerate, Run all downstream, Add…, Connect from here and the four arrows -- was dead to a
   click, and sixteen browser tests failed on it, eight of them L1's and L2's own tests that had passed before this
   change. The cause is one line of L6's drag: `onPointerDown` called `setPointerCapture` on the card's wrapper, and
   a captured pointer sends its **compatibility mouse events to the capturing element**, so the `click` that follows
   was dispatched at the wrapper and the button inside it never saw one. The keyboard path was unaffected, which is
   why `lib/flows/canvas.ts`'s own tests -- which test the maths, not the DOM -- were all green.

   The fix is to ask whose press it is: a pointer that went down on a control (`button, a, input, select, textarea,
   summary, [role='button']`) belongs to that control and starts no drag, so nothing is captured and the click
   arrives. A press on the card itself still captures, which is what L6's comment wanted it for -- a drag that ends
   outside the 248 px card.

   This is the clearest evidence for why this change exists: `components/flows/**` has no component tests, the panels
   had never been opened in a browser, and a canvas nobody can click looked exactly like a canvas that works.

4. **The inspector's Tools list is L6's `CANVAS_TOOLS`.** It was three kinds (`ai_image`, `ai_video`, `mockup`) and
   is now the five L6's canvas offers, in the spec's order. Two lists of what a person may add could disagree; one
   cannot.

5. **`MarketingServicesProvider` is filled with real values, and the rest keep their honest defaults.** L4 built the
   provider so that the few things a marketing panel needs from outside `LaunchPanelProps` arrive in one place, each
   with a default that says it is not connected rather than pretending. What the shell can really answer, it does:

   * **the brand's voice**, from Brand Studio's own record through `voiceFromRecord` (decision 0079);
   * **the export targets and the watermark rules**, read from their tables, each falling back to
     `SEEDED_EXPORT_TARGETS` / `SEEDED_WATERMARK_RULES` rather than taking the canvas down with it;
   * **the pictures**, worked out from the canvas: the finished output of every board the platform draws itself.
     `components/launch/marketing-services.ts` leaves out every board a model draws (`isGeneratedKind`), which is the
     garment lock said once more at the one place a picture enters a marketing layout;
   * **"Write for me"**, through one new action (item 6).

   Left at their defaults, with the reason: **the repeat prints** (the repeat maker of decision 0081 publishes to no
   library, so there is nothing of a brand's to offer and the panel shows its empty state); **the CMYK profile**
   (none is on file, which is decision 0094's own answer); **the plan** (this platform has no plan model, so the free
   plan's row is the one that applies); and **the export** (no route serves the bytes, so the panel says it is not
   connected).

6. **"Write for me" sends two ids and reads everything else on the server.** `writeMarketingCopyAction` takes the
   board and the slot's id, and reads the board from the canvas, the slot out of the library's own copy of that
   board's template, and the voice out of the brand's record. A slot in the body would be a slot the caller wrote;
   this way a model can only ever be asked to fill a text field that is really on the layout, and nobody can put
   words in a brand's mouth by sending a voice of their own. `writerFrom` answers null with no model key set, so the
   panel says it is not connected rather than failing on a press, and nothing is charged in credits (decision 0094
   owner question 1 is still open).

7. **L2's run loop is closed with a seam in the shell, not with a shortcut round it.** Decision 0091 item 6 says the
   shell makes no paid call. It still does not: `useLaunchShell` takes a `runner`, asks the garment lock and the cost
   first as it always did, and only then hands the board to whoever owns its capability. One kind answers today --
   `mockup`, which is free, deterministic and drawn by this platform -- and every other kind gets the shell's honest
   note about the panel that is not built yet.

   `lib/mockups/run.ts` is the half that was missing. It asks `runnable` first, takes the garment from
   `garmentSource` (which walks the connectors back to the Design board), draws with `composeMockup`, stores the PNG
   as a `render`, and hands L1's `recordOutput` a `DrawnAsset` from `drawnAsset`, whose provenance is the literal
   `"deterministic"`. **There is no path through that file that can produce a generated asset**, so it is not a
   fourth way round the three doors of 0091 and the three triggers of 0096: it is a fifth place that asks the same
   question. It also writes the design version it drew from onto the board, so a later version reads as stale instead
   of a board quietly showing last week's kit.

   Two things it refuses rather than half-draws: an AI scene (that is L3's half of F-L1 and would be a paid call), and
   a scene that draws a size or colour chart card, because the card is not wired to the design's own measurements yet
   and a card with nothing in it is worse than a refusal with a reason.

8. **Both 3D views answer the recorder, and neither claims an ability it does not have.**
   `lib/garment3d/video-events.ts` holds the four event names, the two figures a shot needs and the listener;
   `video-events.test.ts` holds those names to `components/video/record-sequence.ts`'s own, so the recorder and the
   views cannot drift apart, and the whole of it is tested in Node because a scene file is the one file that may
   import three.js and so the one file nothing can test.

   Each scene points the camera for a shot's angle, distance and subject, and eases a push in over the shot's own
   seconds. The flat viewer also swaps the colour version **when it was given more than one kit to show**. The
   capability answer is built from the handlers that really exist, so:

   * **the flip and the kit reveal are now offered** by both views, which is what the camera event was for;
   * **the carousel is still refused**, with L5's own sentence, because nothing yet hands either viewer a second
     colourway's drawing. That is a data change -- the other colourways' flats are not built anywhere a viewer can
     reach -- and this record names it as the one piece of L5's "prove the three" that is not done.

   `video-events.test.ts` asks L5's own `sequenceVerdict` what is offered for each set of abilities: the turntable
   alone for a view that can only turn, three for a view that answers the camera, and all four including the carousel
   for a view that answers the colourway. The last of those is proof of the recorder's side, not of a viewer that has
   two kits.

9. **The video studio is mounted under the 3D view, loaded with the 3D code.** F-L3's four free videos are no use
   without a canvas to record, and `VideoStudio` finds that canvas itself and says so when there is none. It is a
   `next/dynamic` import beside `GarmentViewer`'s, so no page carries it until somebody opens the view.

10. **The proof is a browser test and an axe scan, because that is what this change exists for.**
    `e2e/launch-panels.spec.ts` opens each newly mounted panel, asks for its own content rather than a placeholder,
    and scans the page with each one open at a desktop width and at 390 x 844 through the shared `accessible` helper.
    It also walks L2's loop end to end -- a design, a launch that opens with its Design board, a mockup board fed by
    it, a scene, Draw this mockup -- and then reads the `files` row behind the board to check the bytes are really
    there and the board's `output_role` is `asset`.

    **The pull request carries the `e2e` label**, because PR #129 took the browser tests off the per-pull-request gate
    and this change is exactly what they are the only cover for.

## Evidence

* `apps/web/lib/mockups/run.test.ts`: 11 tests over the run loop with every read, store and write as a double --
  the refusals before anything is drawn, the drawn asset put back through L1's own `acceptAsset`, the design version
  recorded on the board, and the colourway a kit role finds by name.
* `apps/web/lib/garment3d/video-events.test.ts`: 17 tests over the listener and the figures, including the event
  names held to the recorder's own and `sequenceVerdict` asked what each set of abilities may record.
* `apps/web/e2e/launch-panels.spec.ts`: every newly mounted panel on a real page, the axe scan at both widths, and
  L2's renderer end to end with the stored file read back.
* `apps/web/components/launch/panel-mounting.test.ts`: both mount maps read rather than trusted, every board kind
  answered, and the four panels that are left held as one list.
* `apps/web/e2e/launch.spec.ts`: L1's own suite, with exactly three assertions changed (the Text panel's placeholder,
  the canvas's own region, and the Add… button's label) and the rest untouched. **Eight of its tests, and L2's,
  failed on the first browser run and are what found the dead canvas of item 3.**

## Alternatives

* **Loading each panel with `next/dynamic`.** The contract was built so that this is possible, and it would keep the
  launch page's bundle smaller. Rejected for now: L2's three panels are already static imports, and a mix of the two
  would mean two answers to "how is a panel mounted". It is a one-line change per entry when the bundle matters.
* **A registry in `lib/launch`.** Rejected for the reason L4 gave: a shared registry is what five workstreams filling
  panels in one wave would have conflicted on. The maps stay in the two files that draw them.
* **Teaching the shell to run a mockup itself.** Rejected: decision 0091 item 6 is the rule that keeps metering where
  the call is. The `runner` seam keeps the shell's checks and leaves the call with the workstream.
* **Answering the colourway event anyway, with the one colourway the viewer has.** Rejected, and it is the whole
  point of L5's capability question: a carousel recorded from one kit is three identical shots handed over as the
  home, away and GK kits. A refusal with a reason is the honest answer until the drawings exist.
* **Building the other colourways' drawings in `lib/projects/flat-preview.ts`.** This would light the carousel up, and
  it is where the data would have to come from. Rejected in a wiring change: it is a new cost on every page that
  draws a flat, in another workstream's file, and it wants its own decision about when that cost is paid.
* **Scanning each panel in its own test.** Rejected: ten sign-ins to scan ten panels, and the scan is of the panel,
  not of the way in. One test per width opens them in turn.

## Consequences

* The launch page now carries L4's, L5's and L6's panel code in its own bundle. Nothing measures that yet; item 1's
  alternative is the lever if it matters.
* `lib/mockups/actions.ts` and `lib/marketing/actions.ts` are the first actions either workstream has. Both are
  excluded from coverage by the existing `lib/**/actions.ts` rule, and both hold no rules: `run.ts` and
  `lib/marketing/copy/**` have those and are tested.
* A mockup board is drawn by a real call now, so a slow design (a lot of artwork) makes a slow press. Nothing shows
  per-board progress yet: the shell's own busy state covers the whole canvas.
* "Select the picture" is gone from the canvas (item 3).
* The `e2e` label exists on this repository from now on, which is what #129's policy needs to be usable at all.

## Owner questions

1. **Should the carousel wait, or should every page that draws a flat pay for the other colourways?** Item 8 is the
   one piece of wave 4 that is still refused on a screen. Lighting it up means building each colourway's drawing
   wherever the 3D view can reach it; the question is whether that cost belongs on the editor's own page or behind
   the 3D view's own fetch.
2. **Is "the upper chest" the right place to frame a crest?** `SUBJECT_HEIGHT` puts a close-up of the crest at 0.22
   of the garment's height above the middle. Nobody has reviewed that figure, and where a design puts its crest is
   not held as data.
3. **Should a mockup of a chart scene draw the design's own size or colour chart?** Today the two chart scenes are
   refused with a reason. The cards are built (`lib/mockups/charts.ts`); what is missing is the decision about which
   measurements and which colourways a card shows.
4. **Should Run all be offered anywhere but the run summary?** The bottom dock's Run button runs the selected board.
   Run all is in the inspector with nothing selected, which is one more click than the spec's own diagram suggests.

## Dependencies

Decision 0091 (the contract and the shell), 0092 (the mockup studio), 0094 (the marketing studio), 0095 (the video
studio), 0096 (flows), 0079 (the brand record the voice comes from), 0081 (the repeat maker that has no library yet)
and 0103 (the top bar the axe scan of these pages now passes through).
