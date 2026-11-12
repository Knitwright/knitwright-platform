# 0140: The Templates, Mockups and Marketing pages

Status: Accepted (plan v6, workstream P2)
Index: Accepted; /templates rebuilt as Discover rows and tabs, /mockups and /marketing built over the existing library, one launch-start action opens a canvas from any of them, Trending row owed
Index title: The Templates, Mockups and Marketing pages
Date: 2026-11-13
Plan step: v6 wave 2, P2. Builds on decisions 0137 (components) and 0138 (the shell and the placeholder routes).

## Context

Build pack v3.9 screens 7, 8 and 9 (`docs/spec/09-screen-map.md`, `08` §4.2 and §4.3, references d13–d15) copy
Kittl's Templates feed, mockup generator and Marketing page. The behaviour behind them already exists: the design
template library and its "Use this template" action (V3, L8), the marketing layouts (L4), the mockup scenes and their
renderer (L2), the video templates (L5) and the six flow packs (L6). What did not exist was a dashboard door to most
of them: a marketing layout, a mockup scene or a flow pack could only be used from inside a launch canvas someone had
already made.

## Decision

1. **One way into a launch canvas from the dashboard** (`lib/launch-start`). `startLaunchAction` takes a source
   (`flow`, `marketing`, `mockup`, `ad`), a template slug, and optionally a design and a colourway. It makes a launch
   project from the brand's newest design (or the one named), puts a Design board on it, adds the board the source
   asks for beside it and connects the two, then opens the canvas with that board selected (`?board=`, and
   `?panel=mockups` for a mockup). A flow pack is laid out by L6's own `applyFlowTemplate`. Every write goes through
   L1's `save_launch_board` and `connect_launch_boards`, so a dashboard page can wire nothing a person could not wire
   by hand, and nothing runs or is charged. With no design yet, the canvas opens without a Design board and says so,
   as the launch home always has.
2. **Templates** (`/templates`, `lib/templates/feed`, `components/templates/v3`): a grey band with the headline, a
   search form and twelve tabs (Discover, seven sports, Launch packs, Social, Videos, Tech packs), all in the address.
   Discover is a stack of carousel rows of square cards (For you, Kit launch packs, Team store promos, Videos,
   Matchday graphics, Size charts, Football kits, Cricket kits, Training wear, Tech packs); every other tab and any
   search is one grid. Each card's **Use template** reaches its kind's existing flow: a design is copied and opened
   in the editor (the unchanged `useTemplateAction`), a pack or a social layout opens a launch canvas (1), a video
   opens the newest design's 3D view where the video studio records it, a tech pack template starts a design. A video
   that waits on another workstream is shown disabled with `waitingLine`'s own sentence; an AI clip carries ♛.
   - Running and Gym both read `07`'s single `running-gym` sport tag. The tag set has no finer split.
   - The older filter address (`?sport=&article=&style=&colour=`) still works, as one grid, and its form lives behind
     the **Filters** button of `08` §4.2. Other specs and the studio's links depend on it.
   - Pictures are drawn only for the designs on screen.
3. **Mockups** (`/mockups`, `lib/mockups/gallery`, `components/mockups/v3`): **Use a product** lists the brand's
   designs; every card shows that design, in the colourway chosen, over the scene's own backdrop colours (data on the
   scene's row). Categories are read off what a scene already is — its group and how its garment is held — so no
   scene carries a second tag. A free scene downloads as a PNG, several as a zip (`/api/mockups/download`), drawn by
   L2's renderer from the same design; an AI scene and a chart card say why they are made on a canvas instead, and
   **Edit** opens one (1). AI scenes stay behind their flags: nothing here calls a model. **Upload** goes to the
   guided start, because a mockup only ever shows a garment the platform drew (spec decision 13).
4. **Marketing** (`/marketing`, `/marketing/launch-packs`, `lib/marketing/gallery`, `components/marketing/v3`): top
   bar tabs Ads and Launch packs; three letter marks of our own for the networks (no network's logo); **Create an ad**
   opens a canvas with an empty marketing board, whose panel holds the campaign form ("Start from a campaign
   instead"); **Plan a launch pack** opens the six packs. Featured concepts lead with seven layout keys of `07`'s
   marketing table. The Ad gallery is one card per layout (its first format sets the shape) plus the video templates,
   in a four-column masonry, filtered by All · Photo · Video · Concepts ▾ (the six marketing groups) · Sport ▾.
   **Sport changes the garment every card shows** to a starter of that sport and hides nothing: a concept is not tied
   to a sport, and inventing a tie would be a fact nobody gave.
5. **States** (`10` §9): each page has a skeleton `loading.tsx`, an `error.tsx` with Retry and the request reference,
   an Empty state (no product yet, no match, empty category) and disabled controls that say why. ♛ marks what spends
   credits.
6. **Fixture.** `/dev/pages?screen=templates|mockups|marketing` draws the three pages from the code's own library with
   no database and no session, for the 1440 × 900 comparisons with d13–d15. Same `DEV_UI_ROUTES` switch as `/dev/ui`.
7. `/templates` and `/dev/pages` join `FULL_WIDTH`.

## Owner question

`09` lists a **Trending** row. Nothing records how often a template is used across brands, so a trending order would
be invented; the row is left out. Should template uses be counted (beside the designer royalty count of decision
0061), and from when?

## Consequences

- No migration. The pages read the existing `templates` rows (kinds `design`, `marketing`, `mockup_scene`,
  `techpack`) through the member's own client, each read naming its kind.
- Kit bundle templates are not listed: nothing yet opens one.
- The card pictures on Mockups are the flat drawing without uploaded artwork (to keep the page light); the downloaded
  file and the canvas board carry the artwork.
