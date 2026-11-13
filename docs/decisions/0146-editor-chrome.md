# 0146: Editor chrome: the labelled rail and flyouts, the right panel, the floating task bar, the 4-group dock, menus and shortcuts

Status: Accepted (plan v6, workstream E2)
Index: Accepted; the Kittl chrome round the one canvas (e01, e03–e14, e35–e37): 11-item labelled rail with 320 px flyouts, right panel with Share/Export/Order slots, floating task bar with "n more", 4-group dock with zoom menu, ≡ menu, board context menu, `08` §5.8 shortcuts, focus-driven reveal; mount points for E3/E4/E5
Index title: Editor chrome
Date: 2026-11-13
Plan step: v6 wave 3, E2. Builds on 0145 (one canvas and its store), 0091 (launch panel contract), 0108/0092–0096 (the launch panels), 0137 (tokens), 0138 (shell). No migration.

## Context

E1 (0145) put every project on one infinite canvas at `/project/<id>`, but drew it inside the v2.2 launch shell:
a glass header, a 12-icon rail with panels always open, a wrapping task bar above the canvas and a dock below it.
`08` §5.1, `09` screen 12 and the prototype (e01, e03–e14, e15, e35–e37) give the editor the Kittl chrome instead,
with the whole window and no dashboard top bar. E3, E4 and E5 build inspectors, popovers and the prompt bar inside
this chrome in parallel, so it also has to give them places to mount without editing the same lines.

## Decision

1. **The frame** (`components/editor-chrome/EditorLayout.tsx`): 76 px rail · 320 px flyout · canvas (task bar
   floating over it, prompt pill and dock at its foot) · 310 px right panel, at `h-dvh`. On a page that draws
   it (`[data-editor-chrome]`) `globals.css` hides the dashboard top bar (`display:none`, so it also leaves the tab
   order) and drops the page padding; the rail's KW logo (→ `/ai-studio`) and ≡ menu are the way out. Below `lg`
   it stacks (canvas first, rail as a fixed bottom bar), as the launch shell did.
2. **The rail** (`lib/editor-chrome/rail.ts`, `components/launch/IconRail.tsx`) is the screen map's eleven items:
   Products · Templates · Text · Illustrations · AI Gallery · Mockups · Uploads | More · Learn · Layers · Help.
   Still a tab list named "Panels" (arrows open, Home/End jump); pressing the lit item closes the flyout. Labels are
   on by default; ≡ › Menu labels turns them off (60 px), kept per viewer in `localStorage`.
3. **Every launch panel stays reachable.** Templates, Text, Illustrations (= `elements`), AI Gallery (= `ai-image`),
   Mockups and Uploads mount the same L-panels; **More** lists Photos, Chat (`assistant`), Likes, Brand, Textures
   (`pattern-fills`) and Team (`/team`), each opening its panel with a "Back to More"; **Layers** lists every board
   (select + `reveal`) and mounts L4's layer list under it. A unit test proves the union is every `RAIL_ITEMS` id.
   The panel contract (0091) is unchanged: the flyout is the editor's own state, a launch panel still opens through
   `openPanel` so `?panel=` keeps working, and `?fly=<own id>|none` names the editor's own flyouts. A plain
   address opens Products, as the reference does.
4. **Own flyouts.** *Products* (search, sport chips, My products → places the design as a Garment board via a new
   `placeGarment` in `useLaunchShell`; Knitwright bases → the product page, whose "Create my design" is the one
   door that makes a design, P4/0142). Shelves are read on the server (`loadShelf`), each failing on its own.
   *Learn* lessons each open the flyout they are about. *Help* lists the shortcuts from the same table the key
   handler reads, and a contact address.
5. **Right panel** (`RightPanel.tsx`): Share · Export (ink) · Order (gold), project name + version history (the
   existing history page), then `ProjectPanel` with nothing selected (Project Colors as hex/100% rows with "See all
   n colors", add, Browse Color Palettes → Brand; Tools: AI Image Board, AI Video Board, Mockup, Tech Pack, plus
   Marketing board and Info card so nothing the launch inspector offered is lost; the run summary) or
   `Inspector.tsx` (E3's) with a board selected. `Inspector.tsx` itself is not edited; its own no-selection branch
   is no longer reached and can be deleted once E3 lands.
6. **Mount points** (`components/editor-chrome/slots.ts`): `POPOVER_SLOTS.share | export | order` (E4) and
   `PROMPT_BAR` (E5), one line each. Until filled, each button opens a popover with the doors that exist today
   (board download, `/studio/<id>/tech-pack`, `/studio/<id>/make`, `/orders`, Settings members) — never a dead link.
7. **Task bar** (`TaskBar.tsx`, `lib/editor-chrome/task-bar.ts`): floats above the primary selection, held inside
   the canvas, placed after layout by hand (no re-render per pan frame). Up to three named actions (boards it can
   feed first), "n more ▾" for the rest, then duplicate, download and ⋯ (the context menu). Content is still
   `lib/launch/task-bar.ts` + `offeredBar`.
8. **Dock** (`BottomDock.tsx`): four groups — tools (V F R P T C, AI); undo/redo and − zoom% + where the per-cent
   opens the zoom menu (Fit to content, Fit to selection, 50/100/200%) through the store's `fit`/`zoomTo`/`zoomStep`;
   the KW coin → `/credits`; Upgrade → the plans modal (0144). The prompt pill sits above it (`PromptPill.tsx`).
9. **Menus.** ≡ (`MainMenu.tsx`): New project, My projects, Duplicate, Settings (units as radio items), Menu labels,
   Save (Ctrl+S), Version history. Board context menu (`BoardContextMenu.tsx`): right-click, Shift+F10, the Menu key
   or ⋯ — Duplicate, Delete, Zoom to this board, Quick export, Open in editor (garment), Add artboard. Rows that
   cannot be used say why.
10. **Shortcuts** (`08` §5.8, `lib/editor-chrome/shortcuts.ts`, `useEditorInput.ts`), read on the window and never
    while typing: V/F/R/O/P/T/C tools; Ctrl/⌘ + − 0 zoom and fit; Ctrl/⌘ S save; Ctrl/⌘ Z / ⇧Z / Y undo/redo;
    Ctrl/⌘ D duplicate; Delete/Backspace and Esc only when focus is on the canvas. Space-drag and plain + − 0 1 stay
    E1's.
11. **Focus-driven reveal** (left by E1): any board that takes focus inside the stage is brought onto the screen with
    the store's `reveal`, so a board panned above or left of the canvas (which the browser cannot scroll to) is
    never focused off-screen.

## Left out on purpose (nothing behind them yet)

Kittl's Copy, Paste, Copy/Paste as, Add to Brand, Convert to Image; ≡ View › Grid/Rulers/Margin and Dark mode
(`10` §2: no dark mode in v1); ⌘G/⇧G group (boards do not group; layers inside a board are E3's); Alt-drag duplicate;
the dock's Select ▾ and Shape ▾ carets; collaborator avatars (no presence); More's Pinterest, Bulk Mockups, Shopify,
QR code and Names & Numbers apps; "from £x" prices on product cards (the price book is not read in the editor).

## Owner questions (defaults chosen)

1. Is the KW logo's "dashboard" `/ai-studio` or `/projects`? Default: `/ai-studio` (the prototype's `go('ai')`).
2. Should the Order button be disabled until a Garment board validates (`08` §5.1)? Default: enabled, opening a
   popover that says to select a garment and links to its Make page; E4 owns the real gate with the Order drawer.

## Consequences

- The e2e specs open panels through `openEditorPanel` (`e2e/support.ts`), which knows where each launch panel moved.
- A 1440 × 900 side-by-side with e01 is in the PR; `/dev/canvas?fly=<id>` opens any own flyout.
