# 0124: Every panel has a door, and a test that says so

Status: Proposed. Four panels, three deletes and one undo are reachable from a screen a person is already looking at; one panel and one action are reported rather than wired, because the file they mount from belongs to an open pull request; `tests/architecture/mounted.test.ts` fails CI for the next one.
Index: Proposed; the design-import, artwork, pattern-look and launch-pack panels mounted, three deletes and the size-map undo given doors, `components/home/StartWays.tsx` deleted as superseded, and a three-way sweep (components, server actions, API routes) added as an architecture test with a reasoned allow-list
Index title: Every panel has a door, and a test that says so
Date: 2026-11-02
Plan step: platform v5, review and hardening (`plans/platform-v5.md`, "R1–R4"), closing the last of
the unwired seams the wave-4 and wave-2 wiring changes did not own.

## Context

A sweep of `apps/web` for transitive reachability from every `app/**/{page,layout,route}` root found
**ninety components that no page could reach**. Most belonged to two wiring pull requests in flight
at the time (#140 for wave 4, which merged while this was being written, and #150 for wave 2, still
open). What was left over belonged to nobody:

| Built | Routed | Tested | Reachable |
|---|---|---|---|
| `components/design-import/**` (8 files) | five routes under `/api/design-import` | yes | **no** |
| `components/artwork/ArtworkPanel.tsx`, `ArtworkCard.tsx` | `/api/artwork` and three more | yes | **no** |
| `components/artwork/generators/GeneratorGallery.tsx` | — | yes | **no** |
| `components/flows/FlowTemplates.tsx`, `FlowThumbnail.tsx` | `applyFlowTemplateAction` | yes | **no** |
| `components/home/StartWays.tsx` | — | no | **no** |

Two more sweeps of the same kind found the same shape of hole elsewhere: **seven exported server
actions that nothing called**, three of them deletes, and **seven API routes that nothing fetched**.

Every one of these passed the type checker, the lint rules, 21,000 unit tests and the coverage
floors, because none of those asks the only question that matters about a screen: **can a person get
to it?** The worst of them was design import — a vision pipeline, a landmark fitter, a pattern
matcher, five routes, a migration and a 90% coverage floor, with no door at all — and the one that
cost a person the most was the deletes: a founder could make a collection plan, a style card and a
launch project and had no way to get rid of any of them.

## Decision

### 1. Nothing is given a door this repository had not already chosen for it

Each panel was mounted where the product already said it belonged, and the record that said so is
named beside it:

| Panel | Door | What says so |
|---|---|---|
| Design import | the Garment tool of the design workspace, section `design-import` | decision 0038's own consequence: "a line in `lib/workspace/tools.ts` to mount `DesignImportPanel`" |
| Your artwork | the Logos tool, section `own-artwork`, under the logos placed on this design | `components/brand-studio/PicturesPanel.tsx`'s empty state: "Upload your crest in a design's artwork first, then choose it here" (decisions 0036 and 0079) |
| Every pattern we can draw | `/studio/[projectId]/kit-styles`, under the kit styles, reached from the Colours tool's own link | plan W7c: "Gallery component for the editor" (decision 0037) |
| Launch packs | the Templates panel of the launch rail | L1's own contract: the `templates` panel is for "Marketing, kit-bundle and **flow** templates" (`lib/launch/panels.ts`); decision 0096's owner question 6 ("reached inside the launch shell") |

**No navigation was added.** The owner's top bar is settled (decision 0103), so every one of these is
reached from a screen a person is already on: a tool on the rail, a link in a panel, or a tab in the
launch rail.

### 2. `StartWays` is deleted, not mounted

`components/home/StartWays.tsx` was the studio home's old "two ways in" panel. Decision 0074 rebuilt
that home to spec F-S4 — the greeting, the action cards, "Jump back in" — and the cards are the
door: `ACTION_CARDS` offers "Start a new design", "Browse bases and templates" and four more, and
`CREATE_WAYS` lists the ways into a new design. Mounting a second panel that claims to be "the big
glass panel at the top of the studio home" would be two doors disagreeing about one thing. The
feature has a door; the file was a leftover, and it is gone.

What it carried that the cards do not is the **guided flow**: `/studio/start` is reached from
`/templates` and from nowhere else. That is owner question 3 below, not a thing to fix by bringing
back a panel the spec replaced.

### 3. The design-import door is drawn only while the feature is switched on

Decision 0038 item 7: off or unset, every route answers 404 and no screen is shown. So the switch is
read **on the server** (`designImportEnabled()`, which reads `process.env.DESIGN_IMPORT` and is not a
`NEXT_PUBLIC_` value), and the page fills a slot with the panel or with null. A null slot draws
nothing at all, heading included, which is what `PanelSections` does for every slot. The browser
tests are the one place the switch is on (`playwright.config.ts`), because a panel nobody can reach
is exactly what this record is about; no model is called there, as `AI_PROVIDER_STUB` already holds.

### 3a. The design-import panel says what accepting does **not** do

Mounting the panel on a design's own screen made a sentence it already carried into a promise it
cannot keep. `acceptImport` keeps the chosen layers on the reading's own row and keeps the pictures
cut from the picture as the brand's artwork. **It does not write them onto the design the panel is
open on.** Decision 0038 item 6 left that to the step after it — "applying the accepted stack to a
project's design is phase B, because it needs W7b's assets for the crops" — and nothing in the
repository does it: `designWithStack` (`lib/panel-layers/save.ts`) is the function that would, and no
import path calls it.

So the panel says so, in plain words, in two places: a standing note above the picture chooser,
before anyone accepts, and the sentence after an accept, which now reads "Accepted. The reading is
kept and its pictures are in your artwork. This design is unchanged." The old sentence said "Saved.
The layers you chose are now part of your design", which was the one thing it must not say.

This is the same choice decision 0121 made for a point of measure a person types: the loss is named
on the screen that would otherwise hide it, and the gap is written down rather than papered over.
**Applying an accepted reading to its design is the follow-up this record leaves open** (owner
question 6), and when it is built, that note and that sentence are what change.

### 4. The pattern gallery says what each look can and cannot do

The platform can **draw** seventeen pattern styles (decision 0037) and a stored design can **hold**
eight (`kitPattern`). The gallery shows all fifty-one looks — seventeen styles, three settings each —
and under every picture says which it is: a kit style this garment offers, which is picked from the
gallery above it on the same page; a kit style another garment offers; or a look that cannot be saved
on a design yet, in the same words `lib/panel-layers/library.ts` already uses for the same list.
Every note carries `R-GAP-000`: no rulebook entry says which pattern a garment may be printed with.

It would have been easy to put a "Use this look" button under all fifty-one. It would also have been
a lie for forty-three of them, and for the eight kit presets it would have applied the style without
the preset's settings — a picture promising something the save could not keep. The gallery is for
choosing a look, says so, and sends a person to the control that really applies one.

### 5. Three deletes and one undo, each asked for in proportion to what it destroys

| Action | Door | How it asks |
|---|---|---|
| `removeCollectionAction` | "Delete this plan" in the plan's own Actions section → `/studio/collections/[collectionId]/delete` | the typed word, as deleting a design does (`components/deletion/DeleteForm.tsx`) |
| `removeLaunchProjectAction` | "Delete" on the row of `/launch` → `/launch/[launchProjectId]/delete` | the same typed word |
| `removeStyleAction` | "Remove" on the style card | a question that **names the style** and says its sizes and quantities go with it and the design does not |
| `DELETE /api/fabrics/size-map` | "Use the suggestion" beside a size label the brand has set | nothing: it puts a value back to the suggestion and destroys no record of anything |

**The typed word is now part of the body, not only of the screen.** `removeCollectionBody` and
`removeLaunchProjectBody` carry `confirmField`, the shared field of `lib/deletion/schemas.ts`. Before
this, a `confirm` box on either screen would have been a decoration: the schema dropped the field and
the delete ran either way. A confirmation that is not checked is worse than none, because it teaches
a person that the box means something.

The two whole-object deletes end on the list they came from (`redirect`), as deleting a design does,
because the page they were pressed on no longer names anything. The style removal and the size-map
undo read their page again where they are.

**What goes is named on the screen, counted from the real rows**: the plan's groups, its style cards
with their sizes and quantities, and any drop payload waiting for the Store to collect; the canvas's
boards and connectors, its saved versions, the runs recorded against it, and anything it has written
for the Store. Both say what is **not** touched — the designs behind the style cards, the design a
launch launches, the pictures its runs made — because that is the question a person actually has.

### 6. The size-map undo is the part of that route nothing had

`/api/fabrics/size-map` came out of the route sweep as fetched by nobody. Two thirds of it were a
second door to something that already had a screen: the fabrics page reads the effective map on the
server and `SizeMapRowForm` sets one through `saveSizeMapAction`. Its **DELETE** was the exception —
the only way back from a brand's own choice, and a brand that typed a pattern size by mistake was
stuck with "Typed in by you" for good. That one is now wired, through `lib/fabrics/size-map-client.ts`,
and the row goes back to reading "Suggested by Knitwright", which is the thing a value nobody chose
must say.

### 7. One test, three sweeps, and an allow-list that has to explain itself

`apps/web/tests/architecture/mounted.test.ts` (with `mounted.ts` doing the reading) asks all three
questions on every run:

* **a component** must be reachable, through imports, from an `app/**` page, layout or route;
* **a server action** (`export const …Action` in a `"use server"` module) must be really used by some
  file outside its own module;
* **an API route** must have its address written down somewhere in the app.

It reads source with the TypeScript parser rather than matching text, which is not a detail: the
throwaway scripts this started from counted `runFlowAction` as used because a comment names it, and
would have counted a barrel's `export { x } from "./y"` as a use. Template addresses are read with
their substitutions as `*`, so `` `/api/artwork/${id}/tile` `` names its route.

The allow-list has two kinds of entry and **every entry carries a reason**:

* `helper` — not a screen and never meant to be mounted: four test builders and browser scripts, the
  three `print-profiles` routes and `/api/templates` (doors named in `plans/production-outputs.md`
  and `plans/platform-v4.md`), `/api/me` (the account menu's identity read),
  `/api/pattern-library/programmes` (dark behind `patternLibraryOpenTo`), and
  `publishFlowListingAction` (see item 8).
* `in-flight` — built by one wave and mounted by a pull request that is open **right now**, each
  entry naming that pull request so it can be deleted when it merges.
* `reported` — a seam whose door is a file another workstream owns, written down here with the lines
  it takes: `components/flows/BoardActions.tsx` and `flowOperationAction` (see the alternatives).

A stale entry is printed as a line to delete rather than failing the build, and the file says why: the
order those pull requests merge in is not this branch's to choose, and a red `main` that nobody broke
teaches people to ignore the test. What the test is strict about is the thing it exists for — a
component, an action or a route that appears with no door and no entry fails it.

**That mechanism was used within the hour.** PR #140 merged while this branch was being written, the
test printed its thirty-one component entries and `runFlowAction` as lines to delete, and they were
deleted. What is left `in-flight` is PR #150's ten files and nothing else.

The test also guards itself: it asserts that the sweep reaches components a page really draws, that
it does not reach a test builder, that every allow-list path names a file or route that exists, that
every entry's reason is a sentence, and that every `in-flight` entry names a pull request number.

### 8. Two seams found and deliberately left open

* **`publishFlowListingAction`.** It appends a listing payload to `flow_listings` for wave 5's Store
  contract to collect. Owner decision 1 keeps the Store out of this platform, so a "Publish to store"
  button in this repository is exactly what must not be built. The door belongs to that contract, and
  the allow-list says so, so the next sweep reads it as answered rather than finding it again.
* **`/api/pattern-library/programmes`.** Its POST is gated behind `patternLibraryOpenTo`
  (`lib/patterns/access.ts`) and answers "The pattern library is not open yet." to everyone else.
  Having no screen is the state that gate describes. The screen belongs with opening the library.

## Alternatives

- **Mount `FlowTemplates` on the launch canvas, as decision 0108's note said.** Rejected: L1's own
  panel contract names the Templates panel as the home of a flow template, the canvas files
  (`components/launch/{BoardCanvas,LaunchShell,Inspector}`) were being rewritten by #140 at the time,
  and a panel is where a person goes to look for a template. Reading those files after #140 merged
  did not change the answer: the canvas draws boards and connectors, and none of its four flow
  components is a place a list of packs could live.
- **Put a "Use this look" button under all fifty-one pattern looks.** Rejected: item 4.
- **Leave the typed word to the screen and not the body.** Rejected: item 5. A box the schema ignores
  is a lie about what it takes to delete something.
- **Mount `components/flows/BoardActions.tsx` and wire `flowOperationAction`.** Rejected, and
  reported instead, which is what the orchestrator asked for while #140 was open and again after it
  merged. Flatten, Upscale and Reframe hang off a selected board, so the door is the inspector's
  board panel, and all three files it takes are L1's own shell. #140 built three quarters of it: the
  inspector already takes a `flow` prop carrying a `FlowCostSource`, and `useLaunchShell` already
  calls one of L6's actions (`runFlowAction`) through its `send` helper. What is left is
  **three lines in three files L1 owns**:

  1. `components/launch/useLaunchShell.ts`: an `runOperation` callback beside `runCanvas`, calling
     `flowOperationAction({ launchProjectId, boardId, operation, factor?, presetKey? })` through the
     same `send`, so a refusal shows in the shell's own note;
  2. `components/launch/LaunchShell.tsx`: add it to the `flow` prop it already builds
     (`flow={{ costs: flowCostSource(costs), onRunAll: shell.runCanvas, onOperation: shell.runOperation }}`);
  3. `components/launch/Inspector.tsx`: in `BoardPanel`, draw `<BoardActions>` with the selected
     board, `flow.costs`, the presets it already has and that callback.

  Nothing else is needed: the three operations are already offered in the contextual task bar, which
  hands them to the board's own panel (`lib/launch/task-bar.ts`, and the comment in `LaunchShell`
  saying "Flatten, Upscale, Reframe … are the panels' own work"). So the gap is that panel, not the
  bar, and `BoardActions` is the panel. This branch does not reach into another workstream's shell to
  land it; the allow-list carries it as `reported` with this recipe named.
- **Resurrect `StartWays` rather than delete it.** Rejected: item 2.
- **A directory-level allow-list.** Rejected: it would have been a handful of lines instead of one
  per file, and a new unmounted component inside one of those directories would never have been
  noticed. The list names files.
- **Fail the test on a stale `in-flight` entry.** Rejected: item 7.

## Evidence

| Claim | Test |
|---|---|
| The design-import panel is a section of the Garment tool, with its own heading, and draws nothing while the switch is off | `components/studio/workspace/panel-sections.test.ts`, `apps/web/e2e/design-import.spec.ts` |
| The panel's own words are on screen — a close reading, nothing kept until accepted — and the picture cannot be chosen before the rights tick | `apps/web/e2e/design-import.spec.ts` |
| The panel says, before anyone accepts, that accepting keeps the reading and leaves this design unchanged | same, and `components/design-import/not-applied.test.ts` |
| "Your artwork" is in the Logos tool, says what it is for, and is the screen Brand Studio sends a brand to | same |
| Every pattern style and preset has a labelled picture, and every one says what can be done with it, with its rule id | `components/kit-styles/pattern-looks.test.ts`, `apps/web/e2e/design-import.spec.ts` |
| The six packs are in the Templates panel, open onto the canvas in one save, and spend nothing | `components/launch/panels/flow-packs.test.ts`, `components/launch/panels/placing-packs.test.ts`, `apps/web/e2e/launch-packs.spec.ts` |
| A pack dropped beside what is already on the canvas does not land on it | `components/launch/panels/placing-packs.test.ts` |
| A plan and a launch project are deleted only with the word typed, and the schema is what holds that | `lib/launch/schemas.test.ts`, `apps/web/e2e/launch-packs.spec.ts`, `apps/web/e2e/collection-deletes.spec.ts` |
| A style is removed after a question that names it, and "Keep it" keeps it | `apps/web/e2e/collection-deletes.spec.ts` |
| A brand can put a size label back to the suggestion, and the row says "Suggested by Knitwright" again | `lib/fabrics/size-map-client.test.ts`, `apps/web/e2e/fabrics.spec.ts` |
| axe finds no serious or critical problem on each new panel, at a desktop width and at 390 × 844, with no sideways scroll | the three browser specs above |
| No component, server action or API route is unreachable without a reason | `apps/web/tests/architecture/mounted.test.ts` |
| The sweep itself works: it reaches what a page draws, misses what nothing imports, and names a route in a directory called `tests` | same |

Three screens have their axe scan taken over the new part rather than the whole page
(`accessible(page, within)`, the one addition to `e2e/chrome.ts`): the design workspace, the kit
style gallery and the collection board. No spec scans any of the three whole today, and a panel
landing on one should be held to the bar without standing or falling on everything else that screen
already draws. The launch canvas and both new delete pages are scanned whole.

## Consequences

- Design import has a door for the first time. It is still behind `DESIGN_IMPORT`, which is owner
  question P12 of decision 0038, so switching it on for real people is still the owner's call and the
  paragraph that record owes `docs/data-processing.md` is still owed.
- A brand's own artwork uploads have a screen, so Brand Studio's Logos, Graphics and Sportswear tabs
  can be filled by following their own empty state instead of ending at a page that did not exist.
- `TemplatesPanel` no longer tells anyone that "a flow is started from the canvas", because it starts
  here. `PANEL_LEADS.templates` and `OTHER_KINDS` in `lib/launch-panels/words.ts` say what is true.
- `removeCollectionBody` and `removeLaunchProjectBody` now require `confirm`. Nothing else calls
  either, so nothing else changes; a future panel that wants to delete one must ask for the word too,
  which is the point.
- The architecture test will fail the next wave that builds a panel and does not mount it. That is
  the only part of this record that keeps working after the branch is forgotten.
- `components/studio/Editor.tsx` is reachable **only** because `components/guided/GuidedFlow.tsx`
  imports a type from it. It is the older workspace shell, superseded by `EditorShell`, and the sweep
  counts a type-only import as an edge, so it passes. Narrowing the sweep to value imports is a
  change with its own findings and its own owner; it is written down here rather than done quietly.

## Owner questions

1. **Should `DESIGN_IMPORT` be on?** The feature now has a screen and is still switched off
   everywhere but the browser tests. P12 of decision 0038 is unchanged: both providers receive the
   person's picture, and the privacy paragraph is owed before it is on for real people.
2. **Should a design be able to store a pattern layer, so the other nine styles can be chosen?** The
   gallery draws fifty-one looks and eight of the seventeen styles can be saved. Decision 0037 left
   this open ("a change type that carries a stack, and an entry in the reply schema"); until it is
   answered, forty-three pictures say they cannot be used yet.
3. **Should the studio home offer the step-by-step start?** `/studio/start` is reached from
   `/templates` alone. Spec F-S4's cards do not list it, and `StartWays`, the panel that did, is gone
   as a duplicate of those cards.
4. **Who is `/api/pattern-library/programmes` for, and when does the pattern library open?** The
   route is dark behind `patternLibraryOpenTo` and nothing names its screen.
5. **Is "Use the suggestion" the right way back from a chosen pattern size?** It drops the brand's own
   row, so the suggestion stands again. Nothing records that a brand once chose 50 for M.
6. **Who builds "apply this reading to this design"?** Item 3a: accepting a reading keeps it and keeps
   its pictures, and the design it was read for is untouched, because the step decision 0038 deferred
   was never built. The panel says so. It needs a design version written from an accepted stack
   (`designWithStack` exists), which touches the editor's own save path, and it is a feature rather
   than a wiring, so it is not taken here.

## R-GAP-000

No rulebook entry covers any of this, so every sentence the new screens state about a rule carries
`R-GAP-000`: which pattern a garment may be printed with (the gallery's notes), and what a launch
pack costs or produces (decision 0096's own gaps, unchanged). Nothing here states a measurement, a
price or a lab result.

## Dependencies

No dependency was added, no migration, no new Postgres function and nothing to revoke.
`supabase/config.toml` is untouched. Nothing here reads or writes a Store concept: the one action
that writes the Store's hand-off payload is deliberately left without a door (item 8).
