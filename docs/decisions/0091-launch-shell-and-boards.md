# 0091: The launch shell and its boards (L1)

Status: Proposed; every artboard preset and credit figure is a labelled placeholder, owner questions listed
Date: 2026-11-02
Plan step: platform-v5 L1 (the Launch section of `docs/spec/02-features.md`, F-L1 to F-L4)

## Context

The Launch section of the spec is one screen with four features hanging off it. F-L1 (mockups and AI shoots), F-L2
(marketing studio), F-L3 (video studio) and F-L4 (flows) all live inside the same editor chrome: a left icon rail, a
right inspector, a bottom prompt pill and tool dock, a main menu, and an infinite canvas of **boards** joined by
connectors. The spec writes that chrome out once, as "Launch shell", and then assumes it everywhere.

Five later workstreams (L2 to L6) build the panels inside it, and L8 fills its template library. None of them can
start until the shell and the board model exist, and none of them should have to change the seam afterwards.

One thing about Launch is not like Kittl, and the spec says so in bold: **in Kittl an AI board re-draws the product,
so the product drifts. In Knitwright the garment is always locked.** Every picture starts from the deterministic
render or the golden-sample photo; a model may change the scene, the light, the pose and the camera and nothing else;
`lib/media-check` rejects drift; and spec decision 13 adds that AI output becomes parameters and layers, never pixels
on a panel. That is the one rule the shell exists to make true, and "advisory" was not an option: five workstreams
will write code against this seam, and a rule that depends on each of them remembering it is not a rule.

Three things already existed and are built on rather than around:

* the slot contract of the editor shell (decision 0075, `lib/editor/slots.ts`), which is the house pattern for a
  shell that other workstreams fill, including its principle that a panel cannot produce an invalid result;
* the credit ledger and the credit prices a platform admin sets (decision 0044, `lib/credits/**`);
* the files-service seam (decision 0070) and the existing lifestyle adapters, which are where a paid call goes. The
  shell makes none.

## Decision

1. **The garment lock is structural, in three places that each refuse it on their own.**

   * **In the type system.** `lib/launch/assets.ts` makes `LaunchAsset` a union of `SceneAsset` and `DrawnAsset`. A
     generated asset is a `SceneAsset`, whose `role` is the literal `"scene"`. There is therefore **no way to write
     down a generated picture as a panel layer or a print file**: a workstream that tries writes code that does not
     compile, rather than code that fails a review.
   * **At the seam.** `acceptAsset` refuses the same thing again at runtime, because a panel may hand the shell a
     value that came out of the database or a service and was never seen by the compiler. `recordOutput` in
     `lib/launch/service.ts` is the one door to a board's output and asks it first.
   * **In the schema.** `boards.output_role` is one of `asset`, `panel_layer`, `print_file`, and the check constraint
     `boards_generated_output_is_never_artwork` allows anything but `asset` only for a board kind the platform draws
     itself. `set_launch_board_output` also refuses an output on a generated board unless a Design board can be
     reached by following that board's connectors backwards, so a generated picture always has a garment the platform
     drew behind it.

   `lib/launch/assets.test.ts` is the test spec decision 13 asks for: it casts past the compiler and watches each
   door shut. `tests/integration/launch.test.ts` watches the database shut the same doors.

2. **The board panel contract is `lib/launch/panels.ts`, and it follows `lib/editor/slots.ts` on purpose.** A panel is
   a default export taking `LaunchPanelProps` -- `{ context, commands }` -- and takes no other props, so the shell can
   load it with `next/dynamic`. `LaunchContext` is read-only facts; `LaunchCommands` is eighteen requests, never
   writes. The shell checks each one against the spec's board table, the garment lock and the project's own bounds,
   saves it, shows the status and redraws. Three invalid results are therefore impossible rather than discouraged: a
   connector the board table does not allow (`canConnect`), a paid run with no locked garment behind it (`runnable`),
   and a generated picture used as artwork (`offerAsset` takes a `LaunchAsset`). `panelDouble()` is the test double,
   and `components/launch/useLaunchShell.ts` ends with `satisfies LaunchCommands`, so the contract and the shell that
   carries it out cannot drift apart without the compiler saying so.

3. **The spec's board table is data, in `lib/launch/boards.ts`, and the database holds the same table again.** Each
   kind carries what may feed it, how many connectors may end there, whether running it spends credits, and its rule
   id. `connect_launch_boards` writes the same pairs out in SQL. Two copies of one table is a cost accepted
   deliberately: the application gives a person a sentence they can read, and the database refuses the row whatever
   calls it.

4. **Every artboard preset is a row, never a literal.** `launch_artboard_presets` holds the sizes the spec names
   (social post 4:5, social square 1:1, story 9:16, hero banner 16:9, Pin 2:3, A4 print), each with the unit it is in,
   the resolution a physical size is read at, a rule id and a note. **Every seeded note says the size was not reviewed
   by anyone**, and the inspector prints the note beside the preset. A4 is the ISO 216 size; its 300 dots per inch is
   a placeholder.

5. **Launch has no price of its own.** A generated board costs what the platform's own credit price for marketing
   media says, read through `lib/settings` as every other price is, and the shell carries the credits page's existing
   placeholder notice rather than writing a sentence about prices of its own. Per-model and per-second costs are L3's
   and L5's; the shell asks a `LaunchCostSource` and shows what it is told, so when those land the shell needs no
   change. Every board records what its own last run actually spent (`boards.last_cost_credits`).

6. **The shell never makes a paid call.** `requestRun` checks the garment lock and the cost against the balance, says
   plainly that nothing has been spent, and stops. The run itself belongs to the workstream that owns the board's
   capability, through the files-service contract or the lifestyle adapters. Metering stays where the call is.

7. **The unit is a way of reading a size, never a change to one.** The canvas is in whole pixels. Pixels, inches and
   millimetres are how the inspector writes and reads a size, at the screen resolution, exactly as the editor's
   centimetre and inch toggle leaves a design alone (`lib/units/length.ts`). A preset that is a physical size carries
   its own resolution and uses that one to become pixels, so A4 at 300 dpi is 2480 by 3508 px while the fields still
   say 72. A size outside what the canvas can draw is **refused with the bound in the message**, never quietly
   clamped.

8. **There is no Apps icon.** The spec's rail has one, for Shopify and Etsy. Owner decision 1 keeps the Store out of
   this platform, so an Apps icon would open nothing. `lib/launch/rail.test.ts` holds it out.

9. **Undo covers what a board carries, and says so.** Its place, its size, its name and its own settings, and the
   project's unit and palette: all of those are a `saveBoard` or a `saveLaunchProject` away, so a stack of states
   restores them exactly. Adding or removing a board, and drawing or cutting a connector, are changes to the canvas
   itself and start the stack again, because a board put back under a new id is **not** the board that was removed and
   the shell will not pretend it is. Each of those has its own control instead, and the Undo button's title says what
   it reaches.

10. **The version history is append-only.** `launch_project_versions` holds what the canvas contained when somebody
    pressed Save, with a trigger that refuses any change or removal, as the collection drops do (decision 0085). A
    record of what a person had is not something a later save may rewrite.

11. **`boards` and `board_edges` are brand-scoped with row level security on, and nobody writes them directly.** The
    server's own key holds `SELECT` only; every write is a `SECURITY DEFINER` function that checks `can_manage_kit`
    itself, as the collection plans, the brand runs and the golden samples do.

## Evidence

* `apps/web/lib/launch/**`: 173 tests over the board table, the canvas graph and every refusal it makes, the artboard
  units and presets, the dock, the rail, the main menu, the task bars, the run estimate, the address, undo and the
  reads and writes. 98% of statements, 95% of branches, 100% of functions and lines.
* `apps/web/tests/integration/launch.test.ts`: the database's own behaviour, including the three garment-lock
  refusals, the wiring the board table forbids, the loop refusal, the append-only versions and the presets.
* `apps/web/tests/integration/isolation.test.ts`: the four new brand tables and the presets table, in the existing
  shape.
* `apps/web/e2e/launch.spec.ts`: the shell on a real page, with its axe scan scoped to
  `[data-testid="launch-shell"]`.
* The spec's own words, read rather than remembered: the Launch shell paragraph and F-L1 to F-L4 of
  `docs/spec/02-features.md`, and Videos 3 to 5 of `docs/spec/research/kittl-fabra/video-ui-notes.md`.

## Alternatives

* **A single "asset" type with a provenance field and a check everywhere it is used.** Rejected: it makes the garment
  lock a thing five workstreams must remember. The union makes the invalid case unwriteable.
* **One board table in the application only.** Rejected: a route, an action or a later workstream could get round it.
  The spec's own table in SQL costs a second copy and buys a floor nothing can go under.
* **Artboard presets as a constant.** Rejected by the plan's own rule: a size nobody can change is a decision hidden
  in code, and nobody has reviewed these sizes.
* **A per-board price in Launch.** Rejected: the platform already has credit prices a platform admin sets, and a
  second place to set one would let the two disagree.
* **Undo over everything, including adds and removes.** Rejected for now: restoring a removed board gives it a new
  id, and an undo that quietly changes an id is worse than one that says what it covers. Revisit if a person asks for
  it; the board graph already has what a real history would need.

## Consequences

* L2 to L6 can start against `lib/launch/panels.ts` without the shell existing in their heads, and against
  `panelDouble()` without a browser.
* A generated picture cannot become artwork, and no later workstream can make it one by accident.
* Two copies of the board table have to be changed together. `tests/integration/launch.test.ts` fails when they
  disagree on a pair, which is the only reason that test enumerates them.
* Launch has no entry in the studio top bar yet. The bar is structurally out of width (PR #101), and a Launch section
  would cost roughly 90 px and break three other workstreams' checks. `/launch` is reached by its own address and
  from the launch pages until the owner decides how the bar grows.
* We would revisit this if a factory or the owner asks for a generated picture to be usable as artwork. That is not a
  UI change; it is spec decision 13, and it would need all three doors opened at once -- which is the point.

## What L2 to L6 must know about the template library (L8, decision 0098)

L8 merged while this branch was in flight, and three of its facts reach panels through this contract
rather than through anything in this directory. They are written here so a panel author reads them
once:

1. **`templates.kind` already exists**, added by `supabase/migrations/20261201050000_template_kinds.sql`
   with the seven values of `07` (design, kit_bundle, mockup_scene, marketing, video, flow, techpack).
   Nobody adds it again.
2. **`lib/templates/service.ts` reads the whole table and parses every row against the design shape.**
   A workstream that seeds `mockup_scene`, `marketing`, `video` or `flow` rows must first narrow
   `loadLibrary` to `kind = 'design'`, or the design library page breaks on its row. The seeding and
   the narrowing go in the same change.
3. **`authenticated` holds SELECT on `templates` column by column.** A column added later carries no
   grant, and a read that names it is then refused for the whole table, not just that column. A
   migration that adds a column to `templates` grants it in the same migration.

## Dependencies

No new dependency. The shell uses what the app already carries: React, Next.js, zod, Tailwind, `@axe-core/playwright`
in the end-to-end test, and `@supabase/supabase-js`. Every one of them is already in the lock file under MIT or
Apache-2.0.

## Owner questions

1. **What does a generated picture or a clip cost?** The shell reads the existing credit price for marketing media,
   which is a labelled placeholder nobody has priced. L3 and L5 will want a per-model and a per-second figure.
2. **What artboard sizes should a launch start from, and at what resolution?** The six seeded sizes are the spec's
   own, each labelled "not reviewed by anyone", and A4's 300 dots per inch is a guess.
3. **Does the owner want the Apps icon at all?** Owner decision 1 says the Store is separate, so it is left out. If a
   read-only hand-off to a storefront is wanted later it is O2's, not the rail's.
4. **Should undo reach adding and removing a board?** Decision 9 says what it covers and why. If the owner wants a
   full history, the board graph can carry one, but a restored board gets a new id.
5. **Launch needs an entry in the studio top bar.** One more section costs roughly 90 px in a bar that is already
   over its width. The orchestrator is holding this until the owner decides between an overflow menu for the later
   sections and collapsing the account cluster into one menu.

## R-GAP-000

No rulebook entry covers the launch canvas, so every board kind, every artboard preset, every refusal this workstream
makes and every cost note carries `R-GAP-000`. The gaps are: what a launch board may be fed by; what a generated
picture may be used as; what an artboard size should be; what a generated board costs; and what the smallest and
largest artboard are.
