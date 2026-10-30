# 0081: Names & numbers, the repeat maker, and Share

Status: Proposed. Owner questions are listed at the end and in `apps/web/lib/share/OWNER-QUESTIONS.md`.
Date: 2026-10-30
Plan step: plan v5 wave 2, Y8 (`plans/platform-v5.md`, "Y8. Names & numbers, repeat maker and Share (F-S4)")

## Context

Spec F-S4 asks for three things this workstream owns:

- **Names & numbers:** pick the font from the licensed list, a colour role and an outline. Zones are
  fixed by the base article (R-PER rules). A preview roster entry, "SMITH 7", shows on 3D.
- **Repeat / pattern-fill maker:** upload a picture or draw, then tile size (cm/in) and repeat style
  (Full drop · Half-drop · Brick · Mirror), with tile bounds, layers and a background colour.
  **Publish** saves it to Your library. Uploads pass moderation (F-G1).
- **Share:** invite by email with Can view / Can comment / Can edit and a message; Copy link with
  link access "Only invited people" or "Anyone with the link can view"; a People-with-access list.

What was already built and is reused rather than rebuilt: the saved shape of player names and
numbers and its editor rules (decision 0027, `lib/garment/names-numbers.ts`,
`lib/projects/names-numbers-controls.ts`); share links, their one-time tokens and their answers
(decision 0026, `lib/share/**`, `supabase/migrations/20261011030000_share_links.sql`); the artwork
upload and the moderation screen it runs (decision 0073, X8 `screenUpload` through
`lib/moderation/server.ts` and `/api/artwork`); the editor's slot contract (decision 0075,
`lib/editor/slots.ts`).

## Decision

### Part 1: Names & numbers

1. **The font list calls exactly one font licensed, and labels the rest.** Knitwright has licensed
   no kit-font kit. The only font this repository holds a licence for is **Geist, under the SIL Open
   Font License 1.1**, whose file ships in `assets/fonts` and which the flats, the PDF and the print
   files already letter in (`lib/flat/pdf-font.ts`, `lib/print/text/outline.ts`). So the list in
   `components/studio/editor/names-numbers/fonts.ts` has that one font plus the three other
   lettering styles of decision 0027 — Varsity, Rounded, Italic — each of which says **"No font file
   for this style is licensed yet"**, and the whole list is headed "Placeholder list, not a licensed
   kit-font kit". Nothing anywhere says a font is licensed where that is unknown. Owner question 1.
2. **A font is a lettering style, so nothing about the saved design changes.** The spec's font list
   and the four lettering styles decision 0027 stores are the same choice, so picking a font writes
   the style the tech pack, the flats and every export already read. No new spec field, no version
   bump, and nothing in `lib/garment/` had to be touched.
3. **A zone is never invented.** The zones offered are exactly the places the garment has a panel
   and a named anchor for, which `lib/projects/names-numbers-controls.ts` works out from the
   registry. `components/studio/editor/names-numbers/zones.ts` adds only the rulebook entry behind
   each one, so a Why? can show the rule's own words: R-PER-001 back name, R-PER-002 back number,
   R-PER-003 front number, and **R-GAP-000 for a number on the leg**, because the rulebook of the
   worked article names no rule for it. The method carries R-PER-004. No cap height, drop below the
   back neck or character limit is restated in TypeScript: those are the rulebook's words and are
   read through the popover.
4. **A height nobody typed stays unset**, as decision 0027 item 9 holds, and the preview says
   plainly "Not drawn to the finished size" so the picture is never read as a measurement.
5. **The outline is written into the one colour instruction the design already stores**, as
   "Navy 19-4024 TCX · outline White" (`names-numbers/colour.ts`, round-tripped by `splitColour`).
   A field of its own would have to be carried by the tech pack's player-mark row, the Excel sheet,
   the PDF and the flats, which Y4 and Y5 own; the instruction puts the outline in front of the
   factory today, in the cell that already says what colour the lettering is. Owner question 2.
6. **The preview reads SMITH 7.** A design with no names and numbers yet starts at that sample, so
   the preview reads exactly as the spec's example until someone types their own.

### Part 2: The repeat maker

7. **The tiling rules are data and functions, not drawing.** `lib/repeat/` answers where each tile
   goes (`tiling.ts`), what a layer draws including the copies that join a tile at its edges
   (`preview.ts`), what crosses the tile's bounds (`layers.ts`), what is wrong with the repeat
   (`findings.ts`) and what it publishes as (`publish.ts`). The panel and the published PNG both
   draw from those answers, so a preview and a print file can never disagree about the layout.
8. **The four styles are the spec's own.** Full drop repeats straight; half-drop drops every second
   column by half the tile; brick shifts every second row across by half the tile; mirror flips
   every second column and row. A style that shifts starts a column or row before the corner, so no
   bare strip is left at the top or the left edge.
9. **A tile is typed in centimetres or inches and kept in tenths of a millimetre**, like every other
   measurement in the platform. Switching units never resizes a tile. The range, 1 cm to 200 cm, is
   a **Knitwright default labelled "not reviewed by a print house"** and the sentence beside the
   field says so. Owner question 3.
10. **Every finding carries its rulebook entry.** The resolution bar is the guardrails' own 150 DPI
    setting, so a repeat and a piece of artwork are judged by the same bar, and `repeat-min-dpi`
    resolves to **R-SUB-003**. The tile's own checks have no entry written yet and carry R-GAP-000:
    `repeat-no-name`, `repeat-tile-out-of-range`, `repeat-no-layers`, `repeat-layer-outside-tile`.
11. **Uploads go through X8's `screenUpload`, by reusing the artwork upload.** The panel uses the
    existing `<ArtworkUpload>`, which posts to `/api/artwork`, which passes `uploadGate` →
    `screenUpload`. A blocked picture leaves nothing behind, exactly as decision 0073 built it. No
    second upload path was added.
12. **Publish draws the tile at 300 DPI and puts that PNG in the brand's own library** through the
    same screened upload, named for the repeat, its style and its tile size
    ("Club hoops - Half-drop 10x10cm.png"). So a published tile is held, screened and found exactly
    like any other picture in Your library. **The tile's recipe — its layers and their places — is
    not stored yet**: that needs a `pattern_fills` table, and only the share migration was assigned
    to this workstream, so it is a follow-up rather than a second migration taken quietly.
    Owner question 4.

### Part 3: Share

13. **An invite is a row with its own one-time token.** `share_invites` holds the address (lower
    case and trimmed, so one person is never on the list twice), what they may do, the member's
    message, and the **SHA-256 of the token and nothing else** — the token is shown to the member
    once and cannot be read back, copying decision 0026 exactly. Inviting an address that already
    has an open invite changes that invite rather than making a second one, so the
    People-with-access list has one row per person and the link already sent still works.
14. **Nobody writes to the table directly.** Every write goes through a SECURITY DEFINER function
    only the server's own key may run, which checks the member's brand itself; members hold SELECT
    on their own brand's rows through RLS and nothing else. No grant was weakened.
15. **A link is "Anyone with the link can view" or "Only invited people".** `share_links.audience`
    defaults to `anyone`, which is what decision 0026 built, so no existing link changes.
    `private.open_share_link` was rewritten to open an `anyone` link only, so a link set to
    "Only invited people" **opens nothing at all**, and that is the database's decision, not a
    page's.
16. **An invite's token opens the shared design page**, read-only. `openShare` falls back to
    `open_share_invite`, and `loadSharePage` answers `canAnswer: false` for an invite, so the answer
    form is not offered rather than offered and then refused. **Leaving a vote or comment through an
    invite is not built**: `share_responses` hangs off a link, and widening it would change the
    tally and the listing decision 0026 owns. Someone who should comment is given the link as well.
    Owner question 5.
17. **No email is sent without a key.** `EmailSender` is an interface with a recording stub;
    `inviteSender()` answers `noEmailSender` unless `SHARE_EMAIL_PROVIDER`, `SHARE_EMAIL_KEY` and
    `SHARE_EMAIL_FROM` are all set, and then it is Resend's HTTP API — one request, no new
    dependency. No test and no local run reaches a provider. `email_sent_at` is written **after** a
    provider took the message, so the People-with-access list never claims an email nobody sent; it
    says instead "We have not emailed them. Send them the invite link yourself."
18. **The invite's words claim nothing.** They say who shared what, what the reader may do, the
    member's own words where there are any, and that the reader will not be emailed about anything
    else. The body holds one link and no picture, so there is nothing to track a reader with.

## Evidence

Unit tests: `lib/repeat/units.test.ts`, `tiling.test.ts`, `layers.test.ts`, `findings.test.ts`,
`preview.test.ts`, `publish.test.ts`; `lib/share/invites.test.ts`, `email.test.ts`;
`components/studio/editor/names-numbers/panel.test.ts`;
`components/studio/editor/repeat-maker/panel.test.ts`. Database tests:
`tests/integration/share-invites.test.ts`, and `share_invites` added to the isolation suite's
shared-table list with the `audience` column on `share_links`.

## Alternatives

- **A second migration for `pattern_fills`.** Only the share migration was assigned, and the plan's
  rule for an unlisted migration asks for a note on the pull request; a table that needs a
  re-editing read model as well is better taken as one piece than squeezed in here.
- **An outline field on the saved design.** Rejected for now: see decision 5. It is additive and
  cheap in `lib/garment`, but it is only useful once the tech pack row, the Excel sheet, the PDF and
  the flats carry it, and those belong to Y4 and Y5.
- **A placeholder list of named kit fonts** (Varsity Block, Collegiate, and so on) with licences
  "to be confirmed". Rejected: naming a font a person might recognise invites the reading that we
  may set it, which is exactly the licence claim the rules forbid.
- **Taking answers through an invite** by widening `share_responses`. Rejected for this workstream:
  see decision 16.
- **A repeat stored as a picture only.** Rejected as the whole answer: the recipe matters, which is
  why `lib/repeat` holds it and decision 12 names the gap rather than hiding it.

## Owner questions

1. **Kit fonts.** Which fonts may Knitwright letter player names and numbers in, and do we hold or
   will we buy a licence that covers embedding them in print files and in a PDF sent to a factory?
   Until this is answered the panel shows one open-licensed font and three labelled placeholders.
2. **The outline.** Should the outline colour become a field of its own on the saved design, carried
   through the tech pack, the Excel sheet, the PDF and the flats? Today it is written into the one
   colour instruction, which the factory reads but which no checker can read apart.
3. **Tile size.** The smallest and largest tile, 1 cm to 200 cm, is Knitwright's own default. What
   will the print house actually hold, and is there a preferred tile for a sublimation run?
4. **Published pattern fills.** Should a published repeat keep its recipe — tile, style, layers and
   background — so it can be re-opened and changed, and may it then be shared between designs of one
   brand? That is the `pattern_fills` table named in decision 12.
5. **Commenting through an invite.** Should a Can comment invite be able to leave a vote and a
   comment of its own, counted in the design's tally beside the answers left through a link?
6. **Can edit.** An edit invite is recorded, and the email says the reader needs a Knitwright
   account. What should actually happen when they sign in: do they join the brand workspace, or does
   the design get a guest editor who sees that design alone?
7. **The email provider.** Resend is the adapter written. Which provider and which sending address
   should Knitwright use, and what should the invite's subject line say?
