# 0092: The mockup studio, deterministic and live-linked (L2)

Status: Proposed; every scene, backdrop, crop size and turned view is a labelled placeholder, owner questions listed
Date: 2026-11-02
Plan step: platform-v5 L2 (F-L1's free part; `docs/spec/07-template-library.md`; the Launch section of `docs/spec/02-features.md`)

## Context

F-L1 has two halves. The AI half generates a scene around a locked garment and costs credits; that is L3's. The
free half puts the garment the platform **drew** into a scene the platform **paints**, costs nothing, and has one
number against it: "Deterministic mockups render in under 5 s, free." This workstream is the free half, and the
seam it mounts into is L1's panel contract (`apps/web/lib/launch/panels.ts`, decision 0091): a panel is a default
export taking `{ context, commands }`, and every command is a request, never a write.

Three things were already true and are built on rather than around:

* the design's own flat drawing (`lib/flat`, rendered by `lib/images/reference` and `lib/media/studio.ts`) is the
  deterministic picture of the garment the server can produce today;
* `templates.kind` exists with `07`'s seven values, and `lib/templates/service.ts` read the whole table and parsed
  every row against the design shape (L8, decision 0098);
* `lib/launch/assets.ts` makes a generated picture unwriteable as artwork, in the type system, at the seam and in
  the database.

## Decision

1. **A mockup scene is a `templates` row of kind `mockup_scene`, and the scene itself lives in `snapshot`.** No
   column is added to `templates`, which keeps this workstream clear of L8's warning that a column added later
   carries no grant and a read naming it is refused for the whole table. `snapshot` is already granted to
   `authenticated`. `lib/mockups/schemas.ts` is the one door out of the database, and a row whose snapshot is not a
   scene is **left out of the library** rather than shown half-drawn.

2. **`loadLibrary` is narrowed to `kind = 'design'` in the same change that seeds the scenes.** This is the one
   thing L8 said it could not do for the workstream that seeds a second kind. Without it the design library page
   breaks on the first scene row, because `summaryRow` parses every row against the design shape.

3. **A scene is not drawn on one base article, and the row says so by holding nothing.** `07` gives a scene garment
   *slots*, not an article: the article is whatever design feeds the board. `article_id` and `wearer` therefore have
   nothing true to hold for a scene, so migration `20261201060000_mockup_scenes.sql` drops their `not null` and adds
   `templates_design_names_an_article`, which keeps both required for a row of kind `design`. Writing a garment type
   a scene is not for would have been an invented fact; a nullable column with a constraint is the honest shape.
   The same reading is why F-L1's **article filter is not offered**: `ARTICLE_FILTER_GAP` says on the screen that
   there is nothing to filter on, rather than a control that quietly does nothing.

4. **Thirty-five scenes are seeded: every scene `07`'s own table and F-L1's library panel name, and not one more.**
   `07` asks for 40 mockup scenes and then names about thirty in the table beneath it; F-L1 adds the 360° turntable
   and the two chart cards. The union is 35. Fifteen of them are deterministic and work now; twenty are the
   photographic places `07` marks AI-generated and are carried as rows, marked `owner: "L3"`, and refused by the
   renderer rather than half-drawn. `specCountGap` carries the difference with `R-GAP-000`. **Inventing five scenes
   to reach 40 would be inventing content the spec does not contain.**

5. **Every backdrop is painted by us.** No photograph, texture, font or model is committed. "Flat lay on grass" is a
   plain outfield green we paint and its own note says so word for word ("A plain backdrop the platform paints
   itself, not a photograph. Not reviewed by anyone."), and the panel prints that note beside the scene. A hanger is
   a line drawing; a fold is the drawing's own middle band laid three times; a ghost mannequin is the drawing's own
   outline shaded.

6. **The front and the back are the real drawing; a three-quarter and a side view are the drawing turned, and say
   so.** The platform draws the garment on the server from its flat (`lib/flat`); the 3D model is built and turned in
   the **browser** (`lib/garment3d`, and the turntable is recorded there and uploaded,
   `lib/media/video/turntable.ts`). There is no 3D rasteriser on the server. So a turned view multiplies the width by
   the cosine of the turn, which is what a turn does to a flat face, stops at `MIN_TURN_WIDTH` because a quarter turn
   of a flat face has no width at all, and carries its own sentence and an `R-GAP-000` gap onto every picture and
   every card: "A preview of shape and colour, not of fit or drape… A render of the garment's own side needs the 3D
   model drawn on the server." The remedy is the files-service seam (decision 0070), not a guess here.

7. **The live link is `inputVersion`, not a copy.** A mockup board holds five things -- the scene, the crop, the kit
   role, the colourway and the roster entry -- and no copy of the design. The design version its last picture was
   taken at is L1's own `boards.input_version`, and `staleAgainst` turns that into the sentence "This mockup was drawn
   from version 2 of the design and the canvas is on version 5." That is what F-L1 means by "changing the design
   updates every linked mockup": the board points at a version, never at a snapshot.

8. **There is no placement setting, anywhere.** F-L1: "Placement inside a photo scene is fixed by the scene's garment
   slot… Users cannot drag the print area." A slot's frame is a fraction of the canvas, so one scene works at every
   crop, and `settingsToStored` has no field a placement could go in. A setting a panel cannot offer is a setting a
   person cannot get wrong -- the same principle as L1's contract.

9. **A roster entry changes what the drawing shows, never what the design is.** `withRoster` swaps the sample name and
   number the flat draws for the ones the board asks for and returns a new value; the design is never written. The
   name and number keep the design's own limits (20 characters, 0 to 99), repeated as plain values because
   `lib/garment/names-numbers.ts` carries zod and a client panel may not; `basics.test.ts` holds the two to each
   other, so they cannot drift.

10. **Home, Away and GK are the design's own colourways, found by name, and a role that finds none says so.**
    `colourwayForRole` matches the colourway's own name (goalkeeper under "goalkeeper", "keeper" or "gk") and returns
    null otherwise; `roleGap` is the sentence. Nothing renames a brand's colourway and nothing makes one up.

11. **Nothing in this workstream can produce a generated picture.** `lib/mockups/assets.ts` builds only `DrawnAsset`s,
    with provenance `deterministic` or `golden_sample`. `assets.test.ts` is the test spec decision 13 asks for: it
    casts past the compiler, offers a generated picture as a mockup, as a panel layer and as a print file, watches all
    three refused, and then **reads every source file of `lib/mockups` and `components/mockups` and fails if any of
    them writes down a generated asset at all**. A later change that reached for one fails here rather than in a
    review.

12. **The render budget is a test, not a hope.** `render.test.ts` draws a full-size 4:5 e-commerce shot and the
    busiest scene `07` can ask for -- an eleven-slot line-up at 16:9 -- and holds each under 5,000 ms. Both are well
    inside it on a shared runner. Nothing in the path calls a model, so nothing is metered and nothing is spent.

13. **Zod and sharp stay out of the browser.** `lib/mockups/index.ts` exports the scenes, the filters, the board's
    settings and the words; `compose.ts`, `paint.ts`, `garment.ts`, `charts.ts`, `schemas.ts`, `seed.ts` and
    `service.ts` are imported by their own path from the server. The same arrangement `lib/launch/index.ts` uses, and
    `tests/architecture/client-weight.test.ts` is what holds it.

14. **Three panels are mounted into L1's shell and three placeholders go away.** `mockups` and `photos` on the rail
    and `board-mockup` in the inspector are default exports taking `LaunchPanelProps`, so the shell hands each one
    `{ context, commands }` and nothing else crosses the seam. Mounting them needed the shell to build a
    `LaunchContext`, which is three small edits in `components/launch` (`LaunchShell.tsx`, `RailPanels.tsx`,
    `Inspector.tsx`); they are noted on the pull request because that directory is L1's.

## Evidence

* `apps/web/lib/mockups/**`: the scene table checked against `07` title by title, the crops, the backdrops, the
  turned views, the filters and collections, the board's settings and live link, the garment lock, the gaps, the
  schema, the seed, the read, the two chart cards, the compositor and the render budget.
* `apps/web/components/mockups/**`: the three panels, rendered against `panelDouble()` with no shell and no browser.
* `apps/web/tests/integration/mockup-scenes.test.ts`: the database's own behaviour -- a signed-in member reads the
  scenes, no browser writes one, the design library's own read does not see them, and a design row still needs an
  article.
* `apps/web/e2e/launch.spec.ts`: the mockups panel on a real page, its collections, its search and its crown.
* The spec's own words, read rather than remembered: F-L1 and the Launch shell paragraph of
  `docs/spec/02-features.md`, and the mockup-scene table of `docs/spec/07-template-library.md`.

## Alternatives

* **Seeding scenes in a table of their own.** Rejected: the plan says "the 40 scenes of `07` seeded as `templates`
  rows of kind mockup_scene", and a second table would have needed its own grants, its own row level security and its
  own entry in the isolation test for no gain. The scene fits in `snapshot`, which is already granted.
* **Giving a scene an `article_id` so the column could stay `not null`.** Rejected: there is no article a scene is on.
  Any value would have been a fact nobody can support, which is exactly what the plan's no-invented-data rule exists
  to stop.
* **Inventing five scenes to reach `07`'s count of 40.** Rejected for the same reason, and the shortfall is a finding
  on the screen instead.
* **Calling the three-quarter and side views renders.** Rejected: they are the drawing turned, and the honest thing is
  to say so on every picture that uses one and to carry the gap.
* **Rendering the AI scenes with a placeholder picture of our own.** Rejected: a placeholder that looks like a photo
  of a changing room is a lie about what the platform did. The renderer refuses an AI scene by name and the card says
  which workstream runs it.
* **Letting a person nudge the garment inside a scene.** Rejected by the spec itself (F-L1), and the setting does not
  exist rather than existing and being ignored.
* **A browser-side 3D render uploaded as the mockup's garment, as the turntable does.** Not rejected -- it is the
  obvious next step and owner question 2 -- but it is a new seam, and the deterministic half of F-L1 works today
  without it.

## Consequences

* The design library page now reads `kind = 'design'`. Any later read of `templates` must say which kind it wants.
* `templates.article_id` and `templates.wearer` are nullable. A row of kind `design` still needs both, by constraint.
* Fifteen scenes are free and work now; twenty wait for L3 and say so on their own cards. L3 inherits the rows, the
  slots, the crops and the backdrops; it adds the model presets, which no scene names here.
* The 360° turntable is drawn as its still frames. L5 cuts the clip from them (F-L3).
* A scene card in the rail cannot name the design's base article, because `LaunchContext` carries no design facts.
  The board's own panel shows the article's gaps when a page passes them in. This is a note for L1, not a change this
  workstream may make to the contract.

## Dependencies

No new dependency. The mockup studio uses what the app already carries: `sharp` (Apache-2.0) for the compositing,
which the studio renders and the print pipeline already use; `zod` (MIT) for the stored scene; React, Next.js and
Tailwind for the panels; `@supabase/supabase-js` (MIT) for the read. Every one of them is already in the lock file
under MIT or Apache-2.0.

## Owner questions

1. **`07` asks for 40 mockup scenes and names 35.** Which five are missing, or is 40 the wrong number? Nothing has
   been invented to close the gap, and the panel says the gap out loud.
2. **Should the three-quarter, side and turntable views come from a real 3D render on the server?** Today the server
   draws the flat and turns it, and says so on every picture. A true render means the 3D model drawn through the
   files-service seam (decision 0070). It is the single biggest improvement available to this surface.
3. **Are "Home", "Away" and "GK" the colourway names a brand is expected to use?** The board matches a design's own
   colourway by name and says so when it finds none. If the roles should be a field on a colourway rather than a
   name, that is a change to the design object (X4's file), not to this one.
4. **What colour is the studio backdrop, and what is on the shop wall?** Every backdrop is a seeded colour labelled
   "not reviewed by anyone". They are the one thing on this surface a brand will notice immediately.
5. **Should the free mockups carry the free-plan watermark?** The existing watermark code is used for media items
   (`lib/media/watermark.ts`); F-L1 calls the deterministic mockups free and says nothing about a watermark, and L4's
   export panel is where the watermark rule is written down. Nothing here watermarks anything.
6. **Launch still needs an entry in the studio top bar** (decision 0091's question 5). L2 adds nothing to the bar;
   the mockups panel is reached from `/launch`.

## R-GAP-000

No rulebook entry covers the mockup studio, so every scene, every backdrop, every crop size, every turned view and
every refusal this workstream makes carries `R-GAP-000`. `lib/mockups/gaps.ts` holds the list and `gaps.test.ts`
keeps it the same list. The gaps are: what a mockup scene is; which 40 scenes `07` means; what a three-quarter or a
side view of the garment really is until the 3D model is drawn on the server; which model presets a scene allows
(L3's rows); what a scene's article is, and so what F-L1's article filter filters on; where the turntable clip is cut
(L5's); and what a scene card may know about the design behind the board.
