# 0145: One infinite canvas: every project at /project/<id>, garment, tech pack and order boards

Status: Accepted (plan v6, workstream E1)
Index: Accepted; /project/<id> for every design and launch canvas (/studio/<id> and /launch/<id> 308 to it); infinite plane with pan, zoom, culling and marquee; the canvas store E2–E5 read; garment, tech_pack and order kinds; a home canvas per design
Index title: One infinite canvas
Date: 2026-11-13
Plan step: v6 wave 3, E1. Builds on 0091 (launch shell), 0096 (flows), 0133 (capabilities), 0137 (components), 0138 (shell), 0139 (Projects). Migration `20261224010000_one_canvas.sql`.

## Context

`08` §5 and §6: "there is no separate editor; the Kittl canvas is the editor". Design, mockups, AI images and
video, tech pack and order are boards on one infinite canvas joined by connectors (screens 12–13, e01, e15–e21).
Until now there were two surfaces with two models: the studio editor (`/studio/<id>`, `projects` +
`spec_versions`) and the launch canvas (`/launch/<id>`, `launch_projects` + `boards` + `board_edges`), whose
"zoom" was CSS `zoom` on a scrolling sheet. E2–E5 build the chrome, inspectors, tech pack/order boards and prompt
bar on top of what this record fixes: the route, the plane, the store and the board model.

## Decision

1. **One route.** `app/(app)/project/[id]` takes either a canvas id (`launch_projects.id`) or a studio design's id
   (`projects.id`), which opens that design's home canvas (`lib/canvas/server.ts resolveCanvas`, one read with
   `id = x or studio_project_id = x`, RLS deciding). `?focus=garment` (the home design's garment) or
   `?focus=<board id>` opens a garment board in **focused mode**: the existing editor (`GarmentEditor`, moved
   unchanged out of the old studio page) in place on the same address, with "Back to canvas". Without `focus`, the
   canvas inside the launch shell's rail, panels, inspector, task bar and dock, so every v5 panel keeps its door
   until E2's Kittl rail replaces them. `/project/*` is a canvas page (`lib/shell/help.ts`): no dashboard rail, no
   help bubble.
2. **Old routes.** `MOVED_PAGES` (308, query carried): `/studio/<uuid>` → `/project/<uuid>?focus=garment`,
   `/launch/<uuid>` → `/project/<uuid>`. Only an id moves: `/studio/new|start|charts|collections` and the pages
   under a design (`tech-pack`, `make/*`, `layers`, `guide`, `kit-styles`, `pattern-service`, `delete`) and under a
   launch canvas (`history`, `delete`) keep their addresses. Links that open a design now use
   `garmentEditorHref(id)`; Projects cards, AI Creations and the launch paths use `/project/<id>`. A few helpers
   that build `/studio/<id>` strings for tests' sake (file menu, needs-you, workspace tools, templates) still do and
   are served by the redirect. The old addresses keep a page each that only `permanentRedirect`s to the same place
   (`movedHref`): the `next.config` rule answers a browser's request, but a server action's `redirect()` and the
   client router's navigation never reach it (CI showed both landing on a missing page).
3. **The board model.** `lib/launch/boards.ts` adds `garment`, `tech_pack`, `order` (deterministic, free):
   - **garment** references a studio project (`settings.designProjectId` and the typed column
     `boards.design_project_id`, kept equal by the trigger `boards_garment_reference`, which refuses a garment board
     with no design or another brand's when it is made or re-pointed: hint `garment_without_design`; a design's
     removal only nulls the reference, and the card says the design is gone). It shows the design's **current** spec
     version: the board read embeds `projects(current_version)` and a garment board's `inputVersion` is that, so it
     is live-linked. It is still the design object: it holds a reference, never a copy; every write and check goes
     through the editor and `lib/validation`, and the order gate (D1) is untouched. The card shows the platform's
     front flat and the last stored validation result; 3D stays in the editor behind `SHOW_3D`.
   - `GARMENT_KINDS = design, garment` (`isGarmentKind`): every garment-lock rule that asked for a Design board
     (`garmentSource`, `runnable`, `launch_board_has_design`, `connect_launch_boards`, the shoot trigger, the panels
     that look for "the design") now takes either. AI never draws the garment: generated kinds are unchanged and the
     never-artwork constraint lists the three new kinds as deterministic.
   - **tech_pack** and **order** (`LINKED_KINDS`) accept one input, from a garment board only (the Add… menu after a
     launch-era Design board is unchanged), and are never run; their card links to `/studio/<id>/tech-pack` and
     `/studio/<id>/make` until E4 fills them.
   - A launch kind's `width/height` stays its export artboard; its box on the canvas is L6's card (248 × 168), so
     existing packs laid out 360 apart do not pile up. The new kinds store their canvas box (`GARMENT_BOX` 320 × 380,
     `LINKED_BOX` 320 × 220). `lib/canvas/boards.ts boxOf` is the one place this is decided.
4. **The mapping** (migration, mirrored and tested in `lib/canvas/mapping.ts`):
   - every studio project gets a **home canvas**: a `launch_projects` row with `studio_project_id` (unique,
     composite FK to `projects (id, brand_id)`, cascade) and one garment board at the origin. Existing projects get
     one in the migration; new ones from the trigger `projects_have_a_canvas`; a rename renames it. The home canvas
     cannot be removed on its own (`remove_launch_project` hint `home_canvas`). Launch canvas names stay unique per
     brand (now a partial unique index); home canvases carry their design's name, which need not be unique.
   - every launch project is a canvas already and keeps every board and connector. Its **Design boards point at
     their design**: `design_project_id` from the board's own `settings.designProjectId`, else the launch project's
     `design_project_id` (also written into settings). Nothing is deleted, moved or re-kinded.
   - No new table, so the isolation lists are unchanged; RLS and server-only writes are the launch tables' own.
     Home canvases are left out of the launch list and the Projects list (the design's card stands for them).
5. **The plane.** `components/canvas/InfiniteCanvas.tsx`: one CSS transform; `soft-2` ground with a 24-unit dot
   grid that moves with it; wheel pans, Ctrl/⌘-wheel and pinch zoom about the pointer; Space-drag and the middle
   button pan; a drag on empty canvas draws a marquee (Shift adds); + / − / 0 / 1 zoom in, out, to fit, to 100%
   (10%–400%); from `CULL_FROM` (24) boards, culling draws only boards and connectors within the screen plus
   240 px, always keeping the selected boards (a smaller canvas is drawn whole); a board just added is brought on
   screen. Boards (`CanvasBoard`) sit at their box with a 13 px label above that keeps its screen size; click
   selects, Shift-click toggles, a drag moves every selected board; Tab / Shift-Tab on a board go to the next board
   in reading order and bring it on screen, Enter selects it and moves into its controls, arrows nudge as before.
   Connectors are L6's curves between the real boxes (fan-in and fan-out), 1.5 px electric with an arrow. L6's card
   (`FlowBoardCard`) is still on every board with all its controls; its Add… and Connect lists are drawn over the
   plane in screen space (`BoardMenus`) so a clipped canvas never hides them.
6. **The canvas store** (`lib/canvas/store.ts`, React binding `components/canvas/CanvasStore.tsx`). State:
   `viewport {x, y, scale}`, `selection: string[]` (primary first), `focus: string | null`,
   `marquee {from, to} | null` (world units), `screen {width, height}`. Commands: `select(id|null)`, `toggle(id)`,
   `selectMany(ids)`, `setViewport`, `panBy`, `zoomTo(scale, about?)`, `zoomStep(±1, about?)`,
   `zoomWheel(deltaY, about)`, `fit(bounds, padding?)`, `reveal(box)`, `setScreen`, `beginMarquee`,
   `moveMarquee`, `endMarquee(caught, additive)`, `setFocus`. Read with `useCanvas(selector)` (a
   `useSyncExternalStore`; unchanged parts keep their identity) and command with `useCanvasStore()`, under the
   `CanvasStoreProvider` the launch shell mounts. Helpers: `primaryOf`, `marqueeRect`, `revealed`. The launch
   shell's single `?board=` follows the primary selection both ways, and the dock's zoom shows the store's figure
   and writes `?zoom=` on its own steps. Geometry for E2–E5: `viewport.ts` (`zoomAt`, `fitTo`, `visibleRect`,
   `screenToWorld`…) and `boards.ts` (`boxOf`, `connectorsBetween`, `visibleBoards`, `marqueeHits`, `nextInOrder`).
7. **Fixture.** `/dev/canvas` (same `DEV_UI_ROUTES` switch) draws a garment board feeding two mockups, an AI image,
   a tech pack and an order, for the 1440 × 900 comparison with e01.

## What E2–E5 build on

- E2 replaces the launch shell's header, rail, inspector and dock around `ProjectCanvas` and reads/commands the
  store (zoom menu = `zoomTo`/`fit`; Layers = `selection`). It owns the shortcut table beyond zoom and pan.
- E3 replaces focused mode's editor with the garment inspector on the canvas (`focus` in the store), and draws the
  garment page switcher on the garment board.
- E4 fills `tech_pack` and `order` boards (`isLinkedKind`) and the Order drawer; the D1 gate stays the order path.
- E5's prompt bar adds boards through `LaunchCommands.addBoard` with `newBoardSize(kind)`.

## Consequences

- One shell for both kinds of project; the studio editor survives intact as focused mode until E3.
- Some helpers still emit `/studio/<id>` and rely on the 308; they cost one redirect.
- The `design` kind stays as the launch-era name of a garment board. Folding it into `garment` would rewrite flow
  templates and runs and is left for when E3/E4 touch them.
- Owner questions: should G1's Garment Studio keep `/studio/<designId>` (plan v6 wave 4), which this record
  redirects? Should deleting a design from Projects also offer to keep its home canvas's non-garment boards?
