# 0103: Crest to kit, and the quote PDF

Status: Proposed
Index: Proposed; no Pantone data ships so no Pantone match is claimed, no delivery date can be shown, every kit's socks are unpriced, three template families deliberately not offered, owner questions listed
Date: 2026-11-02
Plan step: `plans/platform-v5.md`, wave 3, workstream Z6. Spec: `docs/spec/02-features.md` F-T2 (crest to kit) and F-T5
(instant quote PDF). Reads decisions 0066 (the base article catalogue), 0069 (validation on every save), 0071 (the
factory model as data), 0078 (the PDF machinery), 0079 (Brand Studio and the shared palette) and 0086 (the teamwear
configurator).

## Context

F-T2 asks for a crest (or up to three colours), a club name, a sport, which kits and a feel, and then six to nine
complete kits in under thirty seconds, each validated before it is shown, with the crest placed unaltered and an LLM
used only to rank and to write one line. Its acceptance tests are a hundred-crest set whose primaries match within
ΔE00 < 5, no candidate failing validation, and the crest unaltered.

F-T5 asks for a quote PDF: a number, the price per piece by tier with tiers counted across the whole basket, what is
included, a delivery estimate from the next batch cut-off, the VAT treatment, thirty days of validity and a link back.
Its acceptance test is a file in under five seconds whose numbers match to the penny.

Six things shaped every decision below.

- **Manufacturable by construction** (spec decision 5). Every structural value a proposed kit holds has to come from a
  base article's approved options and parameter ranges, and only one of the eight launch articles has any
  (`JSY-SS-01`, decision 0066).
- **AI never draws the garment** (spec decision 13). A model may order the kits and write one line. It may not produce
  a colour, a placement, a panel layer or a print file.
- **No Pantone data ships.** Pantone's colour values are licensed and this repository holds none (open item P6, and
  `lib/artwork-stack/colours.ts` says so). So "the nearest Pantone" of the plan cannot be answered.
- **No delivery date can be shown anywhere.** QC days and freight days are both unset in the factory data on file, so
  `promisedDate` (decision 0071) answers "not set" and the make and ops pages name what is missing instead of a date.
- **Socks map to no base article**, so a kit bundle cannot be fully priced (Z5's blocking owner question 6).
- **The Store is separate** (owner decision 1). The platform shows the price and hands the order over; it never takes
  money, so F-T5's "a link back to pay" cannot be built as one.

## Decision

1. **A template family is a catalogue code, not a picture.** The plan's third axis, "template family", is the base
   article's own `pattern_fill` option group: `P00` plain, `P01` vertical stripes, `P02` diagonal gradient on
   `JSY-SS-01`. `lib/crest-to-kit/families.ts` names six families a club would recognise and gives each the code it
   needs; a family with no code is never offered and is named on the screen. This is what makes a proposed kit
   manufacturable by construction, and it means the card shows the very code the factory reads.

   The alternative — `lib/kit-styles/presets.ts`, which has hoops, stripes, a sash and panels — cannot be used: its
   `OFFERED` table lists the studio registry types (`team-jersey`, `crew-tee`) and not the teamwear ones
   (`football-shirt`), and `kitPatternFits` requires the `tops` family, which no teamwear type is in. Z5 found the same
   wall and raised it; it is owner question 2 below and the same question as Z5's own.

2. **The kits vary along three axes, and every value on each comes from a row.** Role (Z5's own `bundleColours`, so a
   kit this engine proposes arranges colours exactly as the configurator's Home, Away and Goalkeeper buttons do), fill
   code (the family), and finish — the cross-product of the article's other option groups, ordered so the feel's own
   preference comes first. Three roles, two families and six finishes give more than nine, so the list is woven by role
   and cut to nine; on the launch catalogue a crest yields **nine kits** for any feel and any choice of roles.

3. **A feel is data, not code.** `FEEL_DEFINITIONS` gives each of the spec's four feels the families it offers, how
   many colours it uses and the code it prefers in each option group. Every row is labelled "Knitwright default, taken
   from the specification and not agreed with a factory".

4. **Each candidate is validated by X4 before it can be shown.** `lib/crest-to-kit/validate.ts` turns each part of each
   candidate into a design in memory — through Z5's own `partSpec`, the function the 3D stage draws from, so what is
   checked is what the club sees — and runs X4's `validateDesign` with the standard registry: the five guardrails,
   parameters in range and the moderation gate. A candidate with one blocker anywhere is **not offered**, and the
   screen says how many were set aside and what stopped the first of them.

5. **The crest is carried, never changed.** The bytes are read once, sniffed for their format by
   `lib/artwork-intake/sniff.ts` (never by their name), and passed by reference into every candidate. `decode.ts` is
   the only place they are decoded, and it decodes them into a copy that the palette counts colours in.
   `crest.test.ts` hashes the bytes before the run, reads the same array out of every kit afterwards, and asserts both
   the digest and array identity.

6. **Knitwright does not trace a raster crest into vectors.** The "vectorise check" of the spec is therefore a print
   quality check: a drawing is sharp at any size and says so; a picture is measured by the editor's own dpi arithmetic
   (`lib/artwork-intake/dpi.ts`) against R-SUB-003's 150 dpi at the width a crest is printed, and is **flagged** with
   the largest size it is big enough for. An automatic trace would change the club's artwork, which decision 5 above
   exists to prevent.

7. **"Nearest Pantone" is answered honestly or not at all.** `nearestReference` gives the nearest colour in a book, and
   the only book that ships is Knitwright's own named list (`CLUB_PALETTE`). Every answer names the list it came from,
   and `PANTONE_GAP` says in plain words that the platform holds no Pantone values and so no Pantone number can be
   given. Owner question 1.

8. **Every colour figure has a published basis.** The palette is the SHARED `lib/colour/palette.ts` (decision 0079), so
   Brand Studio and this screen can never disagree about a crest. The gamut is `lib/guardrails/gamut.ts`'s estimate,
   which has no ICC profile behind it. Every difference is CIEDE2000 from `lib/media-check/ciede2000.ts` over Lab from
   `lib/colour/convert.ts`, which is sRGB with a D65 white point and the 2-degree observer (owner decision 15). The
   screen says all of that beside the colours, and claims no colour match.

9. **A kit's body colour is the colour a print is estimated to reach, not the screen colour.** That is the colour a
   club would actually receive, so it is the one the kit is built in and the one the acceptance figure is measured
   against.

10. **The model's seam cannot carry anything but an order and a line.** `rank.ts` hands a ranker ids, words and
    catalogue codes, and takes back ids and lines. `applyRanking` then reads every value of the kit from the candidate
    the id names, so an answer carrying a colour, a code or a whole kit has nowhere to land. A line that holds a colour
    value, a measurement, a catalogue code or the word Pantone is refused and Knitwright's own line is kept.
    **No model ships**: the ranking that runs is arithmetic over the candidates, and `meteredRanker` exists so that one
    cannot be added without metering.

11. **The quote's figures come from `priceFor` and are checked against it again.** `buildQuote` prices the basket with
    X6's `priceBasket`, which reads the tier at the whole basket as F-T5 requires, and then re-derives every line with
    `priceFor` and **refuses to build the quote at all** if the two disagree. That is "the numbers match checkout to
    the penny" as code rather than as a comment.

12. **No tax is added to any figure.** `country_rules` gives the market, the rate and the row's own label; the factory's
    price tiers do not say whether a stored price is before or after tax. So the quote states the treatment and says
    plainly that the prices above are the tiers as stored and that nothing was added or taken off. Owner question 4.

13. **The quote says what it cannot know about delivery.** It prints Y7's own `deliveryLine` over X6's `promisedDate`,
    which today answers "No delivery date yet. Not set: the days for QC and the freight days." — the same words the
    make and ops pages use. No part of a date is filled in with a guess.

14. **The socks are named, never priced around.** Every part the catalogue does not cover is listed on the quote under
    "Not priced yet" with the reason, and the total says which parts it leaves out.

15. **"A link back" is a link back to the kit, not to pay.** There is no address to pay at: the Store takes the order
    and the money and is not built. The quote links back to the kit in the configurator and says that Knitwright takes
    no money for the quote.

16. **A quote number is derived, not counted.** Nothing stores a quote — this workstream adds no table and no
    migration — so the number is a function of the day and of what is being quoted: the same basket on the same day
    always gives the same number, which is what a club comparing two printouts needs. Owner question 5.

17. **One PDF path, not two.** The quote is built on the tech pack's own machinery: the registered Geist face
    (`lib/flat/pdf-font.ts`), the character guard (`exports/pdf-text.ts`), the heading and paragraph parts, the one set
    of sizes and colours (`exports/pdf/styles.ts`), and the download headers (`exports/headers.ts`). Its tests run in
    the `pdf` project beside the tech pack's own.

18. **The kits are built on the server and sent as a view model.** The browser is handed words, swatches, codes and two
    addresses, and never a kit it could change. It also keeps the garment rules, and so zod, out of the browser, which
    `tests/architecture/client-weight.test.ts` requires of every client component outside its own list.

19. **Nothing is stored.** There is no table, no bucket and no row behind either screen. The crest is read, its colours
    are counted from a decoded copy, and both are gone when the answer is sent; a quote is built in memory when its
    address is asked for and sent once.

20. **The screen's two panels are opaque, and no text on it sits straight on the page.** The aurora behind the glass
    has pale blobs (`components/shell/Aurora.tsx`), and text over one of them measures as little as 3.4:1, which fails
    WCAG AA — Brand Studio found that on its own tab strip and recorded it in `components/brand-studio/BrandTabs.tsx`.
    The accessibility scan of this screen found it again, on a phone, where the form wraps and lands under a pale blob.
    So the form and its answer each have a surface of their own (`--surface-solid`, opaque), the nested tiles are a
    faint raise over that, and every chip carries its own surface. Measured against `--surface-solid`: ink 15.6:1,
    ink-2 11.6:1, muted 9.4:1, warn 11.4:1, cobalt-soft 6.9:1 — and none of them depends on what the aurora is doing.
    The browser test holds this region to the same axe bar `e2e/mobile.spec.ts` holds every key screen to, and names
    the offending node when it fails.

## The measured acceptance figures

- **ΔE00 over the hundred-crest set: 100 of 100 within 5** (worst 0.884, mean 0.009), measured in
  `lib/crest-to-kit/fixtures.test.ts` as CIEDE2000 between each generated crest's dominant colour and the body colour
  of the kits built from it. The fixtures are drawn in flat colours, so the clustering recovers each one exactly; what
  the figure measures is therefore the snap to the estimated sublimation gamut, which is the honest thing to measure,
  because that snap is what a club's shirt would be printed in.
- **Kits per crest: nine**, for every feel and every choice of roles, on the launch catalogue.
- **No candidate fails validation**, because the engine can only express a kit the article offers — and `validate.ts`
  checks that again before a card is drawn, with a test that a value outside the approved range is set aside.
- **The crest is placed unaltered**, proven byte for byte.
- **The quote PDF is built in well under five seconds**, asserted in `lib/quotes/document.test.ts`.

## What was deliberately left

- **Three of the six template families are not offered**: bands, a sash and side panels. No base article carries a
  print fill code for any of them. They are listed in `MISSING_FAMILIES`, named on the screen, and are owner question 2.
- **No sock article**, so every kit's socks are a colour with no price (Z5's question 6, repeated here as question 3).
- **No real ranker.** The seam, the metering wrapper and the refusal rules are built; no model is wired, because none
  is needed for the feature to work and a live paid call may not be made from a test or an agent's own run.
- **No placement table**, so the crest is recorded in the configurator's fixed slot and placed in the Studio editor
  (Z5's question 7).
- **No delivery postcode.** F-T5's flow names one, but nothing in the factory data is finer than a country: freight days
  live on a `country_rules` row, and the market the club is reading in already says which country that is. A postcode
  would be a field with nothing behind it. It becomes useful the day a carrier gives rates by area, and is owner
  question 10.
- **The create-new modal's "From your crest or logo" card still opens `/club`.** `lib/home/cards.ts` is workstream Y1's
  file, not this one's; the card's target should become `/crest-to-kit`, and that is owner question 7.
- **No entry in the studio top bar.** The bar is structurally over capacity at every desktop width (Z5's question 8,
  pull request #101), and a feature workstream should not take width from another one. Crest to kit is reached by its
  own route and from the configurator's cards.

## Dependencies

No new dependency. The work uses what the repository already has: `sharp` (Apache-2.0) to decode a crest,
`@react-pdf/renderer` (MIT) for the document, `zod` (MIT) for the two schemas, and `pdfjs-dist` (Apache-2.0) in the
tests to read the document back. Every one of them was already a dependency of `apps/web`, under a licence the plan
allows.

## Rules with no entry (`R-GAP-000`)

The rulebook has no entry for: how many kits a crest should yield; the width a crest is printed at; VAT, duty or a
low-value threshold in any market (the seeded `country_rules` rows say so themselves); the validity window of a quote;
and the quote number's own format. Each one carries `R-GAP-000` in code and is listed on the pull request.

## Owner questions

1. **Is a licensed Pantone book coming?** Until one is, no screen can give a Pantone number, and the nearest colour
   comes from Knitwright's own named list. Brand Studio takes a Pantone TCX code a person types, which is the only
   Pantone value the platform holds about anything.
2. **Should the launch articles carry print fill codes for bands, a sash and side panels** — and should
   `lib/kit-styles/presets.ts` offer its styles for the teamwear registry types? These are the same question from two
   sides, and they are the reason three of six families are not offered. It is also Z5's question 2.
3. **Is a sock article coming?** Until one exists, no kit bundle can be fully priced, and every quote says the total
   leaves the socks out. It is Z5's question 6.
4. **Are the stored sell prices before or after VAT?** Until that is answered a quote cannot show a tax-inclusive
   total, and says so. The seeded market rows are placeholders "to confirm with a customs adviser".
5. **Should a quote be stored and numbered in a sequence**, so Knitwright can look one up when a club quotes it back?
   The number is derived from the day and the basket today, and nothing keeps a record of it.
6. **How wide is a crest printed on a shirt?** The dpi check measures against 80 mm, which is Knitwright's own figure
   and neither a factory's nor a league's.
7. **Should the create-new modal's "From your crest or logo" card open `/crest-to-kit`?** It opens `/club` today, and
   `lib/home/cards.ts` belongs to workstream Y1.
8. **Should the configurator's "ideas" rail button and its "Quote" button be wired to this workstream now?** Both
   seams exist on Z5's side (`unavailableIdeas`, `unavailableQuotes`) and this workstream ships the other half of the
   quote (`quoteSource`); wiring them is a one-line change in a file Z5 owns.
9. **What should a crest-to-kit run cost, if a model is ever wired to rank the kits?** `meteredRanker` takes a figure
   and reserves it before the call; no figure is set, because no model is wired.
10. **Should a quote take a delivery postcode?** F-T5's flow names one, and nothing in the factory data is finer than a
    country, so it would be a field with nothing behind it until a carrier gives rates by area.
