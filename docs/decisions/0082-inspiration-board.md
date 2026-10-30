# 0082: The inspiration board

Status: Proposed. Every provider is an interface with a deterministic stub; only Unsplash, Pexels and Pinterest have
real adapters, and none of the three has been run against a live key. The mood-image price, the moodboard limit and
the per-source budget are Knitwright defaults, not measured. Owner questions below.
Date: 2026-10-30
Plan step: platform v5, wave 3, Z1 (`plans/platform-v5.md`). Spec: F-S1 (`docs/spec/02-features.md`), spec decision 13
and principle 4 (`docs/spec/01-product-direction.md`). Builds on decision 0069 (validation), 0073 (moderation),
0067 (the rulebook's "Why?") and the existing image and text provider interfaces.

## Context

F-S1 asks for a side panel that shows inspiration related to what someone is making, from six sources, and turns the
cards they like into **manufacturable suggestions**. Its acceptance is four lines: the board refreshes within three
seconds of a change; every suggestion passes the F-0 checks before it is shown; **no third-party image is ever written
to a panel layer or a print file**; and every card shows its source and opens it.

Two of those four are the reason this workstream is risky rather than ornamental. A board that holds pictures from six
places, one of them a model's own output, sits one careless line away from a garment printed with somebody else's
photograph; and a suggestion that has not been through validation is a promise the factory cannot keep.

## Decision

1. **A suggestion is one of three design diffs, and that is what keeps the pictures out.** `lib/design-diff` already
   has four kinds; a suggestion made from an inspiration card may only ever be `set-colour`, `swap-style` or
   `change-option` (`lib/inspiration/suggest/to-diffs.ts`, `SUGGESTION_DIFF_KINDS`). None of those three has a field
   that can name a file, an asset or an address, so no sequence of suggestions can change which pictures a design
   uses. The fourth kind, `move-placement`, moves a picture the person uploaded and is never built here.

   `lib/inspiration/no-pixels.ts` makes the rule checkable rather than merely true: `pictureRefsOf` lists every road a
   picture takes into the stored design (an artwork's file, an `image-fill` layer's asset, a `graphic` layer's asset or
   file), and `pixelBreach` refuses an applied change whose kind is wrong, whose picture list moved, or which added a
   layer. The apply action calls it as its last gate. **`lib/inspiration/no-pixels.test.ts` is the test the plan names:
   it drives the whole pipeline with a model that tries to smuggle a picture in through every field it has, for a card
   of each of the six sources, and asserts the design's picture list is unchanged afterwards.** A print file is drawn
   from the stored design object, so a design whose pictures cannot change is a print file whose pictures cannot change.

2. **Every patch goes through X4 before it is shown.** `suggestFromCard` previews each candidate against the factory
   profile and the guardrails (`previewDiff`), then runs validation over the design the patch *would* make, through
   the `DesignChecker` port that `server.ts` wires to `validateDesign` over the standard registry. A patch with a
   blocker is never offered: its reason is said plainly in `notPossible` instead. At most three stand up, as F-S1 asks.

3. **Nothing third-party is stored, in the code and in the database.** A moodboard item is a source address, a preview
   address and the attribution words — `moodboardItemSchema` has five fields and no field a picture could sit in. The
   migration says the same thing in SQL: `private.is_reference_url` demands `https://` and refuses `data:`, `blob:` and
   `file:` by name, and the column checks apply it to both addresses, so a row that broke the rule could not be stored
   even by the server. Stock pictures are hotlinked from the address the API returned, as Unsplash's and Pexels' terms
   require, with the photographer named and Unsplash's referral marks on its links. A product page is fetched **once**,
   logged out, with Knitwright's own user agent, read for its Open Graph words, and dropped.

4. **An AI mood image is never stored, so it can never be placed.** It is made through the existing `ImageProvider`
   interface, comes back as a `data:` address inside the one answer, carries the label "AI mood image" wherever it is
   shown, and says of itself that it cannot be saved to a moodboard. Its prompt asks for "colour, light and texture
   only" and forbids a garment, a person, a logo and text: spec decision 13 says AI never draws the garment, and the
   prompt is where that is kept, not only the storage rules. The call is metered as a `photoreal` cost before it is
   made and refunded when it fails, and it happens only when the person presses the button, so no refresh spends money
   by itself.

5. **Six sources, in the spec's order, each one switched on by its own key.** `knitwright-library`,
   `pinterest-board`, `unsplash`, `pexels`, `link-preview`, `ai-mood`. A source whose key is absent is not built at
   all: the board carries one plain sentence naming the key Knitwright needs, and every other source still answers.
   Pinterest sits behind **both** `PINTEREST_APP_ID` and `NEXT_PUBLIC_INSPIRATION_PINTEREST=on`, because production
   needs Pinterest's Standard access, which has not been applied for. Behance and Pinterest search are **buttons**
   that open the site with the context query, since Behance has issued no API keys since 2021 and neither site may be
   scraped.

6. **The refresh budget is kept by giving each source its own share of it.** Every source is asked at once, so the
   board takes as long as its slowest source; a source over `SOURCE_BUDGET_MS` (2 s, inside F-S1's 3 s) is dropped
   with a sentence and its request is aborted. The panel asks for the whole board in one server action, because this
   version of Next.js dispatches server actions one at a time per client: several calls would queue and blow the
   budget.

7. **The context query is read from the design object, and the person steers it.** Sport and article name (through the
   catalogue port), the colour names a person typed (never a hex code), the style words of the chosen options and the
   kit pattern, and the brand kit's mood words (through the brand port). Tags are tidied to lower case, kept once, and
   held to twelve. A pinned tag the design does not imply is added at the end; a removed tag is left out and
   remembered, in `inspiration_tag_steers`.

8. **Three tables, written only by their own functions** (`supabase/migrations/20261120010000_inspiration.sql`):
   `design_moodboards` (one per design, made on first use), `moodboard_items` (the five fields of decision 3) and
   `inspiration_tag_steers`. Members read their own brand's rows; there is no insert, update or delete policy on any
   of them; `save_moodboard_item`, `remove_moodboard_item` and `set_inspiration_tag` are `security definer`, check the
   membership with `private.belongs_to` and check that the design belongs to the brand. Saving the same address twice
   is one item. No suggestion is stored: a suggestion is worked out again from the design each time, because it is
   only ever shown after validation has looked at the design as it is now, and a stored one would be a stale one.

9. **Interfaces where the other side is not merged** (`lib/inspiration/ports.ts`): the Knitwright library (templates,
   past designs with permission, sample photos), the brand kit's mood words (Y6), the article's sport tags (X1) and a
   moderation screen over the cards (X8). Each has an unwired version that says "nothing known", which shortens the
   board rather than breaking it.

10. **Every finding and suggestion carries `R-GAP-000`.** The rulebook has no inspiration entries, and the plan forbids
    inventing a rule's text. The suggestion card carries a "Why?" link, so the gap is logged for the team each time
    someone asks. The PR lists the gap.

## What this does not do

* **No live call has ever been made.** The Unsplash, Pexels and Pinterest adapters are driven in the tests by a fetch
  the test supplies. Their reply shapes come from each API's published documentation, not from a run.
* **No panel is mounted yet.** Y3 leaves a labelled "Inspiration" slot in the editor's Library panel; this workstream
  does not edit `components/studio/editor/**`, so `<InspirationPanel>` has no page of its own and there is no browser
  test of it. The panel's words and attributes are covered by rendering tests instead.
* **A moodboard holds no AI mood image**, by decision 4. Nothing stores the picture, so there is nothing to keep.
* **The Pinterest OAuth flow is not built.** `pinterestProvider` takes a token and the board ids the person chose; the
  sign-in that produces them is a route, and routes are not in this workstream's paths.

## Owner questions

1. **Which stock providers do we actually hold keys for?** The code is ready for Unsplash and Pexels. Unsplash's free
   tier is 50 requests an hour, which one busy designer can spend in a morning, and its production tier needs their
   approval of the application. Do we apply for both, or run one?
2. **Do we apply for Pinterest Standard access now?** Without it the boards source is a demo for the owner's own
   account only. It is behind a flag either way.
3. **What is a mood image worth?** `MOOD_IMAGE_COST_MICRODOLLARS` is a labelled default of $0.04 against the usage
   meter's `photoreal` allowance. The spec says AI mood images are "charged as credits"; `lib/credits` has three
   output kinds and none of them is an inspiration image. Adding one is a change to a shared file this workstream does
   not own, so the meter carries the cost today and no credit is spent. **This one is money.**
4. **Should a product page be fetched by this board at all, or only by F-S2?** Z3 builds the benchmark fetcher with
   robots.txt and a rate limit per brand. This board fetches a page once for its Open Graph words and keeps nothing,
   which is lighter, but it is a second fetcher. The orchestrator may want one of them to go.
5. **Sixty items a moodboard, two seconds a source, twelve tags a query** are all Knitwright defaults chosen here. None
   was measured.
