# 0094: The marketing studio (L4)

Status: Proposed; CMYK is refused because no colour profile may be committed, every slot figure and character limit is a labelled placeholder, owner questions listed
Date: 2026-11-02
Plan step: platform-v5 L4 (F-L2 of `docs/spec/02-features.md`, the marketing table of `docs/spec/07-template-library.md`)

## Context

F-L2 is two ways to make a post and one way to get it out of the building.

The first way is a template: one of `07`'s 50 marketing layouts, opened "as artboards with slots for
mockups, logo, text and brand colours", where **Replace keeps size and colours**, text is set in the
brand's Headline / Subheadline / Body styles, and every text field has **Write for me**. The second
is the campaign workflow form: seven numbered steps, an example on the right, and a footer that
generates. The way out is the export panel: quick PNG at 1x/2x/3x, then a full export with the
artboards chosen, width and height in px/in/mm, 72 or 300 dots per inch, a live print size,
PNG/JPEG/SVG/PDF, RGB or CMYK, Remove background, and a zip for several at once, with the free
plan's exports watermarked.

Three things already existed and are built on rather than around:

* **the panel contract** (L1, decision 0091, `lib/launch/panels.ts`): a panel is a default export
  taking `{ context, commands }`, and `LaunchCommands` is eighteen **requests**, never writes;
* **the template library** (L8, decision 0098): `templates.kind` already holds the seven kinds of
  `07`, and `lib/templates/service.ts` parses every row of that table against the design shape;
* **the platform's own watermark** (`lib/media/watermark.ts`), its zip (`fflate`), its PDF writer
  (`@react-pdf/renderer`), its image pipeline (`sharp`), its text-model interface with a
  deterministic stub (`lib/providers`), and its usage meter (`lib/usage`).

And one rule sits over all of it: **the garment is always locked**. A marketing layout is built
*around* a pixel-locked mockup. Nothing in this directory, and nothing a model produces, may
restyle, recolour or redraw the garment in a picture.

## Decision

1. **A slot is a fraction of the artboard, and names a colour role rather than a colour.**
   `lib/marketing/templates/types.ts`. Two things follow for nothing. One layout fits every format
   `07` gives it, so the same layout is a square post, a 4:5 post, a 9:16 story and an A4 poster
   without a second set of numbers (`layout.ts` turns fractions into pixels). And **Replace keeps
   the size and the colours because it cannot do otherwise**: the rectangle and the role belong to
   the slot, and a replacement carries neither (`replace.ts`). There is no code path in which
   replacing a picture resizes a slot.

2. **The 50 rows are 30 layouts at the formats each is for.** `07` names the layouts, not the rows:
   "kit countdown story (3, 2, 1)" is three stories, and F-L2's own acceptance test is a club making
   "a 'new kit' post in 3 formats", which is one layout at three sizes. A row is therefore a layout
   at one format, its slug says which, and `counts.test.ts` reads `07`'s own table and holds this
   directory to every name in it and to the count of 50.

3. **The garment lock is structural here, in the same three places L1 put it.**
   * *In the type system.* A slot's picture is a `DrawnAsset` (`assets.ts`), so a `SceneAsset` --
     what a model produces -- **cannot be written down** as the contents of a slot. Code that tries
     does not compile.
   * *At the seam.* `fillSlot` refuses a generated provenance at runtime, because a fill may be
     built from a row or a service reply the compiler never saw, and `withPicture` refuses it before
     the value is typed at all.
   * *In the words.* "Write for me" takes a `MarketingSlot` and **refuses any slot that is not a
     text field**, so a model is never asked to fill a mockup, a logo or a QR chip, and what comes
     back is `string[]` -- not a `LaunchAsset`, so it cannot be offered to the shell as artwork.

   `garment-lock.test.ts` is the test spec decision 13 asks for: it casts past the compiler and
   watches each door shut, and asks L1's own `acceptAsset` the same question so the two cannot drift.

4. **Nothing is laid out over a pixel-locked picture.** `placementVerdict` refuses a layout in which
   anything would cover a mockup, rather than moving or cropping the mockup to make room -- which
   would be this code deciding what the garment looks like in the picture. Every one of `07`'s
   layouts passes it, and `arrangements.test.ts` holds the arrangements to a stronger rule still:
   nothing overlaps anything.

5. **The campaign form generates deterministically and calls no model.** The spec allows a model to
   "restyle the layout and the background"; what is built is the free, repeatable version, because
   that is what makes the acceptance test pass with no credits and no drift: the campaign chooses
   which of `07`'s layouts are offered, the style orders them, the destination's own
   `launch_artboard_presets` row gives the size, and the layout's fractions become rectangles. A
   model-assisted restyle is a later change with a cost on the button.

6. **"Write for me" is metered, stubbed, and writes words only.** It goes through the one
   `TextModelProvider` interface; the tests use `createStubProvider`, so no call leaves the machine
   in CI or in an agent's own run. `meteredWriter` reserves the estimated cost before the call and
   gives it back when the call fails or comes back with nothing a field can hold, so nobody pays for
   an empty answer. The instructions carry the brand's **voice tags** -- the spec's own five (Bold,
   Gritty, Community, Premium, Playful) -- and a brand with no tags on file is told so rather than
   written for in a voice nobody chose. Every reply is untrusted: parsed, cleaned of control
   characters, held to the field's limit, and offered as three options a person chooses between.
   Nothing reaches the artboard until they pick one.

7. **The voice tags are Brand Studio's own list, and one adapter reads its record.** This branch was
   written against an interface of its own, because `lib/brand-studio` was not in `main` (plan
   lesson 9); Y6 (decision 0079) merged while it was in flight, so `copy/voice.ts` now re-exports
   `VOICE_TAGS` and `VOICE_TAG_LABELS` from `lib/brand-studio/words.ts` rather than keeping a second
   copy of the five tags, and `voiceFromRecord` is the one adapter from a `BrandRecord` to what
   "Write for me" needs. `BrandVoiceSource` stays an interface with a stub, so the writer's tests
   need no database.

8. **The export panel refuses what it cannot do, in words, and never exports something else.**
   `export/panel.ts` turns every choice into one verdict. A CMYK file with no profile on file, a
   transparent JPEG, more dots per inch than the plan allows, a size the canvas cannot draw, a file
   with more pixels than one file may hold: each is a sentence saying what to do, not a button that
   makes the wrong file. The **live print size is the size of the file that will really be made**,
   not the number typed in, because a file is a whole number of pixels.

9. **CMYK is server-side, through what the platform already ships, and only against a profile
   somebody has put on file. None is, so CMYK is refused and says why.**
   The maths needs no new dependency: `sharp` (Apache-2.0) is in the lock file, and the libvips it
   carries does ICC transforms through Little CMS (MIT). What is missing is the **profile**: the
   usable ones (Adobe's, the ECI and FOGRA sets) are not redistributable under MIT, BSD or Apache,
   and the plan forbids committing a third-party asset. A naive separation -- 255 minus each channel
   -- would open, print, and be wrong, with no warning to whoever sent it to a press. So
   `colour.ts` holds a `CmykProfileSource` that answers "none", the panel refuses CMYK with
   `WHY_NO_CMYK`, and the day a profile is on file the refusal becomes a separation with no other
   change. A browser library was rejected for the same reason: the cost is the licensed profile, not
   the arithmetic.

10. **One drawing, every format.** `export/svg.ts` draws the artboard once, and the SVG file, the
    pixels `sharp` makes from it, and the picture a PDF page carries all come from that one drawing,
    so a PNG and an SVG of the same artboard cannot disagree. The drawing embeds no font (text is
    set in generic families until Brand Studio's own fonts exist; the PDF's font is the one the app
    already ships, Geist, under the SIL Open Font License 1.1) and draws no garment.

11. **"Remove background" is the background slot left out, not a picture cut up.** The platform
    drew the layout, so it knows which rectangle is the background: leaving it out gives a
    transparent PNG, deterministically, with no segmentation and no model. Removing the background
    of a *photograph* is L2's and L3's.

12. **The watermark is the platform's existing one.** `watermarkSvg` from `lib/media/watermark.ts`
    is composited into the same `sharp` pipeline and embedded in the SVG output, so the mark on a
    marketing export is the mark on a media set. Nothing here draws a second one.

13. **Targets, resolutions, colour spaces and watermark rules are rows.**
    `marketing_export_targets` and `marketing_watermark_rules`. The spec's one sentence about
    watermarks ("Free plan exports are watermarked; paid exports go up to 300 DPI") is two rows, so
    an admin can change it and the panel can say which applies. A panel is handed only
    `LaunchPanelProps` and never fetches, so the same rows are written out in code
    (`export/seeded.ts`) and `seeded.test.ts` **reads the migration's own INSERT statements and
    holds the two together** -- the same bargain L1 struck with the board table.

14. **`templates` can hold a row that is not a design, and the design library's read is narrowed in
    the same change.** Five columns of that table describe a design and nothing else -- the sport,
    the article, the wearer, the style tags, the colour family -- and a marketing layout has none of
    them. They become nullable with a constraint saying they belong to a design, so a design row can
    still never be missing one, and nothing is filled in with an invented article code.
    `loadLibrary` and `createFromTemplate` now ask for `kind = 'design'`. **L2, L5 and L6 need
    exactly this**; whichever of us lands first adds it and the others keep it.

15. **Every rule here is `R-GAP-000`, and the gaps are a list rather than prose.** No rulebook entry
    covers marketing artwork: the nearest, `R-SUB-003` (150 DPI at 1:1 in sRGB) and `R-SUB-008` (the
    factory's own rich black), are about the print file a factory's RIP reads, not a poster.
    `MARKETING_GAPS` names the seven gaps, and the pull request lists them.

16. **The panels are mounted by one lookup, in this workstream's own file.**
    `components/marketing/panels.ts` maps each of the six panel ids to its component.
    `components/launch/RailPanels.tsx` and `Inspector.tsx` belong to L1 and are **not edited here**:
    five workstreams are filling panels in this wave, and a shared registry would be five conflicts.
    The pull request says exactly what the wiring step adds.

## Evidence

* `apps/web/lib/marketing/**` and `components/marketing/**`: 246 tests over the 50 templates against
  `07`'s own table, the slot geometry, every refusal the layout makes, Replace, the board's settings,
  the layers, the elements, the brand's voice, the writer and its meter, the campaign form and its
  generation, the export panel's verdicts, the colour decision, the drawing, the renderer, the zip,
  the reads and the words a panel may not use. 99.8% of lines, 99.5% of statements, 99.6% of
  functions and 98.2% of branches of `lib/marketing`, against the 90% it is held to.
* `apps/web/lib/marketing/garment-lock.test.ts`: the three doors, each watched with a cast past the
  compiler, plus L1's own `acceptAsset` asked the same question.
* `apps/web/lib/marketing/export/seeded.test.ts`: the migration's own rows against the code the
  panel reads them with.
* `apps/web/tests/integration/marketing.test.ts`: the database's own behaviour -- the 50 marketing
  rows with every design column empty, the constraint refusing a design row with them empty, the
  design library narrowed to design rows, and the two settings tables read by a member and written
  by nobody from a browser.
* `apps/web/tests/integration/isolation.test.ts`: the two new platform tables, in the existing shape.
* The spec's own words, read rather than remembered: F-L2 of `docs/spec/02-features.md` and the
  marketing table of `docs/spec/07-template-library.md`, both quoted back by tests that read the files.

## Alternatives

* **A template per format, with pixel geometry.** Rejected: 50 rows of numbers that cannot be
  changed together, and a layout that cannot be moved to a size nobody seeded. Fractions make one
  layout fit every size, which is also what makes the campaign form's destinations free.
* **A separate `template_marketing` table, as L8 did for bundles and tech packs.** Rejected: the
  plan and decision 0091 both say these are `templates` rows of kind `marketing`, and the narrowing
  of `loadLibrary` that goes with them is work L2, L5 and L6 need done once.
* **Filling the design columns with "general" and a garment code.** Rejected: five invented facts in
  the library's own table, and a marketing layout is not on an article.
* **A naive CMYK conversion, or shipping an ICC profile.** Rejected: the first exports something
  wrong without saying so, the second commits a third-party asset the plan forbids. Refusing with a
  reason is the honest third option.
* **"Remove background" through a segmentation model.** Rejected for the artboard: we drew it, so we
  know which rectangle the background is. A model would cost credits to answer a question we already
  know the answer to.
* **A model in the campaign form's generation.** Rejected for now: the deterministic version is
  free, repeatable, and enough for the acceptance test. The spec allows the restyle; it can be added
  with a cost on the button and no change to the layouts.
* **Editing L1's `RailPanels.tsx` to mount the panels.** Rejected: it is another workstream's file,
  and four other workstreams need the same two lines in the same wave.

## Consequences

* The panels exist and are tested, but **nothing mounts them yet**: the shell still draws
  `panelPlaceholder(id)` in their six places. That is one lookup in two L1 files, named on the pull
  request, and until it lands none of this is reachable on a screen -- so there is no end-to-end
  test or axe scan of these panels in this branch either.
* The 50 marketing rows are in `templates`. Anything that reads that table and expects a design must
  ask for `kind = 'design'`; two reads were narrowed here and a test now holds the first of them.
* A second copy of the export targets exists in code. `seeded.test.ts` fails when the two disagree,
  which is the only reason that test reads a migration.
* CMYK is a refusal until somebody puts a profile on file. That is a one-row change plus the bytes,
  not a code change.
* `templates`' five design columns are nullable. The constraint means a design row still cannot be
  missing one, but a reader that assumed the columns were never null is now wrong, and
  `summaryRow`'s own parse is what catches it.

## Dependencies

No new dependency. Everything used is already in the lock file:

| What | Licence | Why it is used here |
|---|---|---|
| `sharp` | Apache-2.0 | The drawing to PNG and JPEG, and the CMYK separation through the libvips it carries (whose ICC transforms are Little CMS, MIT). |
| `@react-pdf/renderer` | MIT | The one-page PDF of an artboard, as the tech pack and the factory sheet already use it. |
| `fflate` | MIT | The zip for several artboards, as `lib/print` and `lib/job-packet` already use it. |
| `zod` | MIT | Reading the rows back, kept out of every module a panel imports. |
| Geist (font) | SIL Open Font License 1.1 | Already in `assets/fonts`; the PDF's own font. No font file is added by this workstream. |

**No third-party asset is committed.** The elements the panel offers are paths this code draws, the
layouts carry no artwork, and no ICC profile, photograph or font is added.

## Owner questions

1. **What does a run of "Write for me" cost?** The spec's board table says a marketing board is
   "Free (AI copy uses credits)". The model spend is metered in microdollars like every other text
   call, but no credit price for AI copy exists, so nothing is charged in credits. What should one
   run cost?
2. **Which CMYK profile should we separate against?** None may be committed. If you have one from
   the printer you use, it goes on file once and CMYK stops being refused. Until then every CMYK
   export is refused with a reason.
3. **Is there a licensed sport-graphics library to buy?** The Elements panel offers shapes this code
   draws -- bands, sashes, chevrons, badges, dividers -- because no artwork may be committed. If you
   want a real graphics library, it needs a licence that covers merchandise.
4. **What should the character limits be?** Headline 40, subheadline 70, body 160, callout 48 and
   highlight 140 are Knitwright's own figures and nobody has reviewed them against a real post.
5. **What is a "free plan" here?** The spec says free-plan exports are watermarked and paid ones go
   to 300 DPI. This platform has no plan model: the rule is two rows, and the panel reads the free
   one. Should a watermark instead be lifted by spending credits, as the media sets do?
6. **Is "Team store" the right name for that group of layouts?** `07` calls it that. Owner decision
   1 keeps the Store out of this platform, so the layouts are posters with no link, no cart and no
   payment anywhere near them. `07`'s "Etsy/Shopify banner" is seeded as a web banner for the
   brand's own page, for the same reason.

## R-GAP-000

No rulebook entry covers marketing artwork, so every rule id in `lib/marketing` is the gap id. The
gaps, as `MARKETING_GAPS` lists them:

1. What a marketing layout's slots may be: how many mockups, how much text, and where each sits.
2. How long each text field may be.
3. Which destination a layout belongs in, and at what size and resolution.
4. What resolution a marketing export may be asked for, beyond the spec's 72 and 300.
5. Which colour profile a CMYK export is separated against.
6. Which exports carry the watermark, and what unlocks them.
7. What a run of "Write for me" costs, in credits as well as in model spend.
