# 0041: The template library (V3)

Status: Proposed. Built in plans/platform-v4.md, workstream V3.
Date: 2026-10-25

## Context

The product spec says a template library is the default starting point and a blank canvas the exception. A template is a
finished design on a garment Knitwright can make. The studio had three ways in (words, a sketch, a garment picker) and no
library. Plan V3 asks for a table of platform-owned templates, one click to make a copy in the member's brand, a filtered
paginated grid with a preview, twelve Knitwright-made seeds, and the guided start offering templates first.

## Decision

1. **One platform-owned table, `templates`** (migration `20261025030000_templates.sql`). A row holds a slug, title, sport,
   article id, wearer, style tags, colour family and the full design as an immutable JSON snapshot (a `GarmentSpec`, 256 KB
   at most). It refers to no other table, so migrations merge in any order.
2. **Every signed-in user reads it; no browser writes it.** There is a select policy and no write policy or grant for any
   browser role, a platform admin included. Writes go through the service client, as with `pattern_jobs`. The plan says
   "written only by platform admins"; with no admin screen in this workstream the only writer is the seed script, run by a
   person with the service key. An admin write screen would be a later change, and would call the service client after
   `requirePlatformAdmin()`.
3. **Sources.** `source` is `knitwright` or `designer`; a check constraint refuses `designer` until it is deliberately
   dropped. `review_state` is `not_reviewed` (default) or `reviewed`; `reviewed` requires a named reviewer and a date, matching
   the wording rules ("reviewed by", never "approved"). The screen says "Knitwright starter, not reviewed by a factory".
4. **"Use this template" is a copy.** `createFromTemplate` reads the row with the member's own client, copies the snapshot
   through JSON (so nothing is shared with the stored row), reads it the way the editor reads any stored design (upgraded and
   repaired if the registry moved on), and calls the same `create_project` function the guided start uses, with the service
   client. The brand and user come from the session, never from the form. The design is version 1; nothing links back.
   Using a template does not apply the brand's own size chart (the snapshot carries the starter chart's sizes, as a new design
   does when the brand has no chart); this is listed under what was left.
5. **Filters are read from the address and checked against lists.** Sport, garment, style and colour family; anything not
   listed is dropped, so a mistyped address still shows the library. The library is small and platform-owned, so the list
   (without designs) is read once, filtered and paged in memory (`lib/templates/filters.ts`, 12 per page), and designs are read
   only for the page shown. Beyond 500 rows this should move into the query. The page's filter form is a plain GET form.
6. **Colour family is a screen grouping** worked out from the main swatch (`colour-family.ts`); it helps people find a kit and
   is not a colour reference a factory can match.
7. **Preview** uses the existing flat renderer (`buildFlat`, `renderSvg`) for the front view and an image data address, so
   nothing in the drawing can run.
8. **Seeds.** `lib/templates/seed/build.ts` builds twelve starters from existing articles (team jersey, polo, crew, V-neck and
   long sleeve tee) and existing kit styles, with `createSpec`, the starter size chart and `kitStyleActions`. No date, random id
   or unordered map; a test builds twice and compares. `seedTemplates` upserts by slug and leaves a reviewed row alone. Run
   `pnpm --filter web exec tsx --env-file=.env.local lib/templates/seed/run.mts` after `supabase db reset`. Seeds do not use
   V2's new articles; V2 templates come in wave 2.
9. **The guided start offers templates first**: four from different sports, then "Or start from a blank canvas" and the
   existing three ways in. If the library cannot be read the start page still works.
10. **Rules kept.** Server only writes; rate limited by the existing `createProject` and `read` limits; no new dependency; no
    paid model call.

## Shared files touched (one or few lines each)

- `components/shell/StudioNav.tsx`: one entry, "Templates".
- `app/(app)/studio/start/page.tsx`: the templates section above the guided start.
- `vitest.config.mts`: `templates` added to the 90% coverage list the plan asks for.
- `tests/integration/isolation.test.ts`: the table is listed (a library table, read-only to browsers), because that suite
  fails on any table it does not know.

## Consequences

- Style tags hold one tag today (the kit style); the column is an array so more tags can come without a migration.
- Seed colours are written by `kitStyleActions` as the person's own choice (provenance `user-edited`). That is how every kit
  style works today; the template's label says whose design it is.
- A removed or renamed garment type makes a template unusable; the card shows no drawing and "Use" says so. Delete or replace
  the row through the service client.

## Evidence

| Claim | Test |
|---|---|
| Filters, paging, address round trip | `lib/templates/filters.test.ts` |
| Copy is a deep copy, refuses bad snapshots | `lib/templates/copy.test.ts`, `service.test.ts` |
| Twelve deterministic, valid, labelled seeds | `lib/templates/seed/build.test.ts` |
| Read by signed-in users; no browser write, admin included; designer source refused; review names a person | `tests/integration/templates.test.ts` (not run here, see the PR) |
| List, filter, use, version 1, templates first, accessibility | `e2e/templates.spec.ts` (not run here, see the PR) |

## Owner questions

1. Who may add a template, and should there be an admin screen for it (platform admins only), or is the seed script enough?
2. Which real kits should the first reviewed templates be, and which factory reviews them? Until one does, every template says
   it is not reviewed.
3. When designers can submit templates (`designer` source), who reviews them and are they paid? The source is reserved and off.
4. Should a template use the club's colours when the brand has set them (V4's kit), instead of the colours it was drawn in?
5. Sport list: football, cricket, running, training and "club and team wear" are Knitwright's tags. Which sports does the
   Australian winter code add once chosen (see V2)?
