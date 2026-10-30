# 0074: The studio home, the create-new modal and the catalogue

Status: Proposed
Date: 2026-10-30
Plan step: `plans/platform-v5.md`, wave 2, workstream Y1. Spec: `docs/spec/02-features.md` F-S4 (studio home, the
create-new modal and the catalogue) and F-S8 (the article page), `docs/spec/research/kittl-fabra/video-ui-notes.md`
Videos 1 and 2. Reads decisions 0066 (the base article catalogue) and 0071 (the factory model as data).

## Context

The studio home was two tiles ("Start a design", "Blank design") over a list of the brand's designs. The build pack asks
for a Fabra-shaped home — a left sidebar, a top bar with search, credits and notifications, action cards and a
"Jump back in" row — a create-new modal, a browsable catalogue of base products and templates, and an article page with
a price ladder, fabric spec cards, a size chart and a lead time, priced in GBP or AUD.

Most of what those screens want to show does not exist yet. There are no sample photographs. Only one of the eight
launch articles has measurements, options or ranges. One placeholder factory prices one article, in one currency, and
its cheapest tier starts at ten pieces. Nothing is created-dated or use-counted. The whole of this workstream is
therefore a question about what to do with a screen whose data is missing, and the answer below is the same every time:
show what the rows hold, say what they do not, and never fill a gap in.

## Decision

1. **No blank canvas.** The create-new modal offers Base products, Templates, From your crest or logo and Your team, and
   the home page's old "Blank design" tile is gone (spec F-S4: "No 'blank canvas / draft your own pattern' option.
   Custom patterns go through the pattern service request instead"). `lib/home/cards.test.ts` fails if any way's words
   mention a blank canvas, starting from scratch or drafting your own pattern. `/studio/new` itself is left alone — it
   is another workstream's screen and the existing journeys reach it by address — but nothing on the home links to it.

2. **A link to a section that is not built is never a dead link.** Every sidebar entry, action card and create-new way
   carries a `Target`: a page, the modal, an external address, or `later`. A `later` target is drawn as text with
   `aria-disabled` and the sentence **"Coming in a later release"**, and the "Jump back in" chips for Collections,
   Moodboards, Mockups and Flows say the same under the row. One sentence, one constant (`COMING_LATER`), so it reads
   the same everywhere.

3. **A base article is never called factory-approved.** The spec's words for the modal are "Start from a
   factory-approved base". Every seeded article is labelled "Knitwright draft v0.1, not reviewed by a factory"
   (decision 0066), so the modal says "Start from a Knitwright base article. Each one is a draft until a factory
   reviews it." The grid card shows the article's status in the same words. `lib/home/wording.test.ts` applies the
   wording rule of `lib/techpack/wording.test.ts` to every string in `lib/home/**` and `components/studio/home/**`.

4. **"From £x · from 1 pc" is read, not composed.** The amount is the lowest sell price among the article's tiers in the
   chosen currency; the quantity is the capability's own minimum order. No tier covers the seeded minimum of one piece,
   so the card adds "Priced from 10 pcs; no price is set for 1 pc yet." Where a currency has no price at all — AUD, for
   every row today — the card reads "No AUD price is set yet" rather than converting GBP or showing nothing. Every price
   shown carries the stored label of the tier it came from ("Placeholder club price from the build pack, not a factory
   quote") and its `ruleId`.

5. **Pictures say "Render, not photo".** There are no sample photographs and no artist models, so the catalogue card and
   the article page draw the existing placeholder outline with that label and the sentence "No sample of this article
   has been photographed. The picture is a placeholder outline, not this garment."

6. **The filter panel is built from the rows.** Sport, Article type, Fit, Gender, Production class and Fabric are
   derived from the articles themselves, each option with a count, and a group no article has a value for is left out
   with a line saying so — today that is Gender. A filter value in an address that no article carries is dropped, so a
   stale link shows the catalogue instead of an empty grid. Style is a template tag, not an article field, so it filters
   the Templates tab only, which says which filters belong to base products.

7. **Sort offers what the data supports.** Newest and Most used need a created date and a use count that neither the
   catalogue nor the template library keeps, so the sort offers Name A–Z, Name Z–A and Code A–Z and says why the other
   two are missing. For the same reason the spec's "NEW" tag is not shown; the article's status tag is, because that is
   a real column.

8. **"Edit this product's form" is built from the article's own options.** The icon is shown only where the article has
   an option group or a range, and its sentence is made of the groups and the number of ranges on file ("Collar, Sleeve
   finish and Pattern fill can be changed; 3 measurements move within the range on file"), rather than the spec's fixed
   tooltip, which describes JSY-SS-01 alone.

9. **The article page shows a gap as a gap.** A fabric that is not one of the fabric programme's rows (JSY-SS-01's
   `F-POLY-RIB`) shows the article's own words and says the programme has no row for it. An article with no points of
   measure says the build pack gives them for the worked article only. Care wording is not written anywhere, so the page
   says so; its `ruleId` is `R-GAP-000`. Every row of the ladder, every fabric card, every measurement, every fit note
   and the lead time carry a `ruleId` and a "Why?" link (decision 0067).

10. **The market selector is the two markets that sell.** UK | GBP and AU | AUD are the two `country_rules` rows with
    `selling_enabled` (decision 0071), and the selector keeps the country code of those rows, so a later wave can read
    a duty rule and a freight time for the market the reader chose. The US and the EU are present in the data and
    closed, so they are not offered.

11. **No Store concept.** The article page ends at the price and the lead time and hands off to the new-design screen.
    There is no basket, no quantity stepper that totals an order and no checkout.

12. **Where the screens live.** `app/(app)/studio/(home)/layout.tsx` and `app/(app)/catalogue/layout.tsx` each draw the
    sidebar and the top bar, so the frame is on the two sections this workstream owns and no other workstream's page
    changes shape. The sidebar's entries are data in `lib/home/sidebar.ts`; the sections' own pages check the session
    themselves, as every page in the app does.

13. **One credits counter, and no loading boundary on the catalogue.** The spec puts credits in the top bar; the studio
    header above it already shows the brand's balance, and a brand has one balance, so the home's top bar does not draw
    a second. The catalogue has no `loading.tsx`: a loading boundary flushes the shell before the page runs, and once
    the response has started `notFound()` can no longer set the status, so an article code the catalogue does not hold
    would answer 200. A correct 404 is worth more than a skeleton on a page that reads nine small rows.

14. **No text over the dotted pattern.** "Render, not photo" sits beside the picture rather than on it: a background
    image leaves an accessibility checker nothing to judge the contrast against.

15. **Reads go through the other workstreams' functions.** Base articles come from `listBaseArticles` and
    `getBaseArticle` on the member's own client; prices, fabrics, colours and lead times come from X6's store through
    the server's own client, because the factory tables have no browser access at all. A failed factory read never stops
    the catalogue: the book comes back empty and every price reads "not set yet". The catalogue reads the full article
    only for the rows it draws, because the summary carries no count of options.

## Consequences

- The studio home gains a sidebar and a search, and loses the "Blank design" tile. Two end-to-end specs
  (`editor.spec.ts`, `guided-flow.spec.ts`) reached `/studio/new` and `/studio/start` by pressing those tiles; they now
  go by address.
- Almost every value the catalogue shows is a labelled placeholder. That is the point: the screens are honest about a
  catalogue that has not been to a factory yet, and each gap is a named question rather than a plausible number.
- The catalogue prices from the first factory on file. Choosing a factory per article, and per market, is later work.
- `lib/home/load.ts` and `lib/home/reads.ts` join the screens to the database and hold no logic of their own, so they
  are listed in the coverage exclusions; the rest of `lib/home/**` is held to 90%.

## Owner questions

1. **No tier covers one piece.** Class A is sold "from 1 piece" (spec decision 4) and the seeded capability's minimum is
   1, but the build pack's club ladder starts at 10. Is there a 1–9 price, or is the real minimum ten pieces?
2. **No AUD price exists.** Australia is open for selling (decision 0071) and every tier's AUD price is null, so every
   Australian price on the catalogue reads "not set yet". Which is it: a conversion rule, or a second ladder?
3. **`F-POLY-RIB` is not in the fabric programme.** JSY-SS-01's rib is in `article.json` but not among X6's six
   programme fabrics, so its spec card has only the article's own sentence. Should the programme gain a rib row?
4. **Nothing is created-dated or use-counted**, so Newest and Most used cannot be offered and the "NEW" tag cannot be
   shown. Worth adding a created date and a use count to the catalogue, or leave the sort as it is?
5. **"From your crest or logo"** should open F-T2 crest-to-kit, which is not built. It currently opens `/club`, whose
   Club kit section puts a crest, colours and sponsors on a design. Right destination until F-T2 exists?
6. **Care wording** exists nowhere in the build pack. R-LAB-002 (fibre, care and origin per destination market) has no
   text yet, so the care row carries `R-GAP-000`.

## Rule ids used where no entry exists

`R-GAP-000` is carried by: the article's cut (no rulebook entry describes a fit), the care wording, a lead time with no
capability on file, a fabric with no programme row, and any price line with no tier in the chosen currency.
