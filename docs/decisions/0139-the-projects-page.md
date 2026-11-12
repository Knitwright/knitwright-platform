# 0139: The Projects page: Recent, Projects, AI Creations, folders, the Trash and shared-with-me

Status: Accepted (plan v6, workstream P1)
Index: Accepted; /projects with Recent (the old studio home, /studio 308s to it), Projects, AI Creations, Folders, Shared and Trash; folders and the Trash kept beside the two project tables
Index title: The Projects page
Date: 2026-11-13
Plan step: v6 wave 2, P1. Builds on decisions 0137 (components) and 0138 (the shell). Migration `20261222010000_project_folders_and_trash.sql`.

## Context

`09` screen 14 makes Projects Kittl's Projects page: top tabs Recent · Projects · AI Creations; under Projects the
sub-tabs Projects · Folders · Shared · Trash with a sort and a search; a New card, project cards with a board count,
and guide cards. Recent keeps the v3.6 home (the greeting, the dashed start cards, Jump back in). The prototype's
addresses are `/projects`, `/projects/recent`, `/projects/ai`, `/projects/folders`, `/projects/shared` and
`/projects/trash` (d01–d06). Until P1, `/projects` redirected to the v2.2 studio home at `/studio`.

Two tables hold projects until E1 unifies them: studio designs (`projects`) and launch canvases (`launch_projects`).
Nothing had folders, a Trash or a list of designs shared with a person.

## Decision

1. **Routes.** The six addresses above, under one layout that puts the three top tabs in the bar (`TopBarTabs`).
   The sub-tabs, sort and search are links and a GET form, so each view has its own address and works without a
   script (`?sort=recent|name|oldest&q=`). `/projects` and everything under it is full width (`FULL_WIDTH`).
2. **The studio home moved to Recent.** Its page, loading state, Needs-you panel, Jump back in and pagination moved
   from `app/(app)/studio/(home)` to `/projects/recent`, and `/studio` answers **308** to it (a new `MOVED_PAGES`
   list beside 0138's temporary aliases, with its own test). `/studio/<id>` and the other studio pages are unchanged.
   Sign-in now lands on `/projects/recent`; `/projects` and `/studio` both need a session in the proxy. The v2.2
   action cards became d02's five dashed start cards (`lib/projects-page/start-cards.ts`): Start a new design keeps
   the create-new modal, Range plan now opens the collection plans (built since the card said "coming"), and Mood
   board and Repeat print say "Coming in a later release" because neither has a page of its own. The studio sidebar
   stays on the catalogue, where it is still drawn; its Trash entry now opens the Trash.
3. **One card for two tables.** Projects lists designs and launch projects together (`lib/projects-page/items.ts`),
   each with a kind tag (Kit design, Launch pack). A launch project shows its board count as d01's `#` badge; a
   design has no artboards of its own until E1, so it shows none rather than an invented number. Cards are U1's
   `ProjectCard`; until E1 renders thumbnails, the picture is the kind's glyph.
4. **Folders and the Trash are kept beside the project tables** (v5 decision 4), in three new tables:
   `project_folders`, `project_folder_items` (an item in one folder at most) and `project_trash`. Each names exactly
   one of a design or a launch project through composite keys that go with the item and the brand. Members read
   their brand's rows; only six SECURITY DEFINER functions write, granted to the service role, and each refuses a
   viewer (`private.can_manage_kit`). The app checks the role first for a clear sentence.
5. **The Trash.** Moving to the Trash hides an item from Projects, folders and Recent (Recent embeds `project_trash`
   and keeps the designs with none). **A design that has been ordered cannot be trashed** (a version marked
   `ordered`, or an ops order), as d05 says. Restore takes it back into the folder it was in. **Delete for good** is
   offered only in the Trash, asks for the typed word, and goes through the existing deletion of each kind: a design
   through `lib/deletion`'s `deleteDesign` (its versions, download records and files only it uses), a launch project
   through `remove_launch_project`. No new erasure path is added; `project_folders` is listed in
   `NAMES_OF_THINGS` (a folder's name names a thing, not a person).
6. **Shared with me** is `public.shared_with_me()`, callable by a signed-in person: the open invites
   (`share_invites`, not revoked, not expired) sent to their own confirmed address, with the design's and the
   brand's names and the access. An invite's token is never stored (decision 0026), so the card cannot open the
   design; it says to open it from the invite email.
7. **AI Creations** is a two-column masonry of the brand's ready shoots (`shoot_jobs`, always garment-locked) and
   media sets' lifestyle pictures (`media_items`), each drawn through a one-minute signed link made with the member's
   own client and opening where it was made. Chips: All, Scenes, Lifestyle, Garment-locked.
8. **States (10 §9).** Loading is a skeleton of the sub-tabs and the grid (Recent keeps its own); every list has an
   Empty state; a failed read is U1's Error state with Retry and the request's reference; a viewer sees the
   no-permission state on the Trash and no ⋯ menus. `/dev/projects` draws each with made-up data
   (`?tab=recent|folders|shared|trash|ai|loading|error|viewer`).

## Consequences

- New: `lib/projects-page/**` (90 % coverage), `components/projects/v3/**`, `app/(app)/projects/**`,
  `app/dev/projects`, `e2e/projects.spec.ts`. Removed: `app/(app)/studio/(home)` and `components/studio/home/ActionCards.tsx`.
- e2e specs that waited for `/studio` after sign-in wait for `/projects/recent`; `studio-catalogue.spec.ts` checks
  the start cards on Recent and the sidebar on the catalogue; `shell.spec.ts` follows the rail to `/projects` and
  checks the `/studio` redirect. `mounted.test.ts` now names `StartCards` as the component Recent draws.
- The isolation suite has the three tables and the one callable function.

## Owner questions

1. **Purge.** d05 says deleted projects stay in the Trash for 30 days. Nothing purges them yet, and the page does not
   promise it. Should a daily job delete Trash items older than 30 days for good (it would go through the same
   deletions, with their storage)?
2. **Shared links.** A shared design can only be opened from its invite email, because the token is not stored.
   Should "Shared with you" open it directly for the invited, signed-in person (a new, address-checked way in)?
3. **Liked and Videos.** d06 has Liked and Videos chips. Nothing records a like, and clips are read by the server's key
   only, so neither is shown. Build both, or drop them from the design?

## R-GAP-000

No rulebook entry covers listing, filing or trashing projects; nothing here carries a rule id.
