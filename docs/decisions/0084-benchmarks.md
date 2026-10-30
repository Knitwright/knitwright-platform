# 0084: Benchmarks — compare products without copying one

Status: Proposed. Every number in it (the fetch allowances, the two closeness thresholds, the eight-word paraphrase
rule) is a Knitwright draft, chosen to be cautious rather than tuned, and not reviewed by a lawyer. Owner questions
below.
Date: 2026-10-30
Plan step: platform v5, wave 3, Z3 (`plans/platform-v5.md`). Spec: F-S2 and its guardrails
(`docs/spec/02-features.md`), F-G1, spec decision 11 ("every rule explains itself").

## Context

F-S2 asks for a comparison of competing products: paste one to five product links, upload photos or paste review text;
the server reads each page **once**, logged out, honouring robots.txt, with a polite user agent; a vision-capable model
fills a fixed card; every field is tagged `observed`, `inferred` or `unknown` and a person may confirm or correct any of
it; two to five cards go side by side with a feature matrix and complaint themes; and "Apply to my design" maps the
*functional* features onto a base article's own options and ranges. The spec's own storage rule is the sharpest line in
the feature: **derived facts and the source URL only** — no page HTML, no third-party images, no review text beyond
short theme summaries. F-G1 adds that logos, brand names, prints and distinctive graphics are never carried into a
design, and that a linked benchmark triggers a design-around check that warns on close matches.

Nothing in the platform read a third-party page before this. The risk is not technical: it is that a tool built to
compare quietly becomes a tool to copy. Every decision below is chosen so that copying is the thing the code cannot do,
rather than the thing a policy asks people not to do.

## Decision

1. **A card is a fixed schema where every field says how it is known**, and the schema, not the model, decides what a
   card may say (`apps/web/lib/benchmarks/schema.ts`). A field that is not known holds no value, and a field that holds
   a value is never `unknown`. Three rules are applied by our parser and never trusted to the model
   (`normalise.ts`):
   - a photo shows nothing *in words*, so nothing read from one is ever `observed`;
   - **a price or a GSM may only be `observed` or `unknown`.** An inferred measurement is an invented measurement,
     which the plan forbids outright, so the schema has no way to express one;
   - a complaint theme that runs on word for word with the words it came from is dropped, because only a paraphrase may
     be kept.

2. **Nothing out of a page's source can be stored, by construction.** The page's HTML never leaves `fetch.ts`: what
   comes back is the plain words, which go to the extractor and nowhere else. The card is what is stored. There is no
   column for HTML, for a third-party picture or for a review. `scrub.ts` refuses any string carrying a tag, a tag
   opening or an HTML entity; `storable()` re-checks every card on its way to the database; and the database refuses
   the same thing again in a check constraint, so a caller that skipped the library still cannot store a copy.

3. **The fetch is polite, and refusing is the safe default** (`fetch.ts`, `robots.ts`). Two requests and no crawl:
   robots.txt, then the page. The user agent is `KnitwrightBenchmark/1.0 (+https://knitwright.com/bot)` with a name a
   site owner can disallow (`knitwrightbenchmark`). robots.txt is read for our own group, falling back to `*`, longest
   rule wins, ties to Allow (RFC 9309). **A robots.txt we cannot read at all is treated as a refusal**: a polite
   fetcher does not guess. No cookies are sent and none are kept (`credentials: "omit"`), nothing is cached, a private
   or loopback address is refused before anything is fetched, and anything that is not an HTML or text page is refused
   rather than downloaded.

4. **Fetched once, per brand, in the database rather than in the code**
   (`supabase/migrations/20261120030000_benchmarks.sql`). `benchmark_fetches` is unique on (brand, URL hash): the
   unique index *is* the promise, and the second ask gets `already` and the card the brand already has. The record of a
   fetch can never be unsaid — only its outcome is filled in, once — so "we read this page" is a fact with a date
   against it. The rate limits are per **brand** as well as per person (`limits.ts`): twenty pages an hour for a brand
   and five from any one site, counted with the existing limiter so ten people in one brand cannot read a hundred of a
   competitor's pages between them.

5. **The model is an interface with a deterministic stub** (`extract.ts`, Lesson 9). No test and no local run reaches a
   paid model; the stub answers an empty card, which is the honest answer when nothing is known. The real adapter goes
   through the existing provider interface and its existing key and adds no vendor of its own, and it pays through the
   usage meter like every other AI call (`metered.ts`): reserved before, refunded on failure. With no key, or with
   `AI_PROVIDER_STUB=on`, the stub is used and nothing is charged.

6. **A person's correction is theirs, and clearing a box is an answer** (`corrections.ts`). A field they typed becomes
   `observed` and `corrected`, and the screen then says "corrected by your team" rather than "stated on the page". An
   empty box means "not known": the value goes. Only the card's own fields are boxes; the complaint themes are not,
   because a free-text box there would be a way to paste a review back in.

7. **The compare view leaves the competitor's identity out of the comparison** (`compare.ts`). The feature matrix holds
   functional and decorative features; a logo, a brand name and a print are `graphic` in the taxonomy and are never
   rows, because nothing about them may be carried over. Themes from two cards with the same words are one row with the
   counts added, ranked by frequency, and the view says in so many words that the themes are our summaries, not
   reviewers' words.

8. **"Apply to my design" maps features onto the base article's own rows, and never onto anything else** (`apply.ts`).
   Only `functional` features are considered. A feature becomes either an option of the base (with its catalogue code)
   or a parameter of the base (with the range a factory approved), and the plan carries the **rule id of that catalogue
   row**, which is what a "Why?" resolves (F-S5). A feature the base has no row for is listed as "not available on this
   base", which is the honest answer and never a nudge to make the base do it anyway. The plan reads the card's feature
   list and never its words, and a test asserts that no part of a plan holds the benchmark's brand or product name.

9. **The design-around check warns, names what is shared in our own words, and claims nothing**
   (`design-around.ts`, `shape.ts`). The design is read as a silhouette (features from the base's own options and
   declared parameters) and a coarse layout ("something of this kind sits in this zone" — no shape, no size, no
   wording). It warns at three silhouette choices in common, and at three surface places in common when they are most
   of the benchmark's. It never says a design is safe, cleared or infringing: a test asserts those words are absent,
   because saying them would be exactly the settled-sounding claim the wording rules exist to stop. Both thresholds and
   both findings carry `R-GAP-000`.

10. **Three tables, read by members of the brand, written only by their own functions.** `benchmarks` (a comparison,
    optionally tied to a design of the same brand), `benchmark_cards` (the card, the source URL, the host, and the
    member's own photo by id) and `benchmark_fetches`. The card's provenance rules are written down again in
    `private.benchmark_card_fault`, so a card that explains itself badly cannot be stored even by the server's own key,
    and the five-card limit is counted under an advisory lock so two at once cannot both pass.

## What was left, and why

- **No photo uploader on the screen.** The photo intake exists as an action and is tested, but the only upload path in
  the app today (`POST /api/artwork`) asks the person to confirm they may use the picture *on garments*. A photograph of
  a competitor's product is not that, and mislabelling it would put a false statement on the file's row (decision
  0025). A benchmark photo needs an upload kind of its own, with its own wording. Owner question 3.
- **No "link each mapped feature to its F-S5 explanation" popover.** The plan carries the rule id; the Why? popover
  lives in the rulebook's own components (decision 0067) and no page outside the admin one carries one yet. When the
  Why? link is offered on ordinary screens, these rule ids are ready for it.
- **Accuracy is not measured.** F-S2's acceptance asks for 90% of `observed` fields correct on a 50-page test set. That
  needs 50 real competitor pages, read with a real model: it cannot be done in CI without a paid call, and the pages
  cannot be committed. The schema, the parser and the refusals are tested exhaustively; the accuracy figure is an owner
  action, to be measured once against a real key and recorded here.
- **The 20-second budget is not asserted.** It is a figure about a third party's page and a paid model, neither of
  which CI may touch. The fetch has a 10-second timeout and the extraction a bounded reply, which is the part we
  control.

## Rule gaps (`R-GAP-000`)

The rulebook has no entries for either of these, and the plan forbids inventing a rule's text:

- **benchmark feature mapping** — which of a competitor's features a base article may be asked for, and on whose
  authority. Today an unsupported feature is simply listed as unavailable.
- **design-around closeness** — how close a silhouette and a surface layout may come to a benchmark before anyone
  should be warned, and what the warning should ask for. Today: three silhouette choices, or three surface places that
  are 70% of the benchmark's.

## Owner questions

1. **Are the fetch allowances right?** Twenty competitor pages an hour per brand, five from any one site, is a guess
   chosen to be polite. A brand doing a serious range review may want more; a site owner may think five is plenty.
2. **Eight words is our paraphrase line.** A complaint theme sharing more than eight consecutive words with the text it
   came from is dropped as a copy. That is a drafting convention, not a legal opinion, and it should be checked by
   whoever advises on copyright.
3. **A benchmark photo needs an upload kind of its own.** May we add one — a private photo of somebody else's product,
   kept for comparison, never placed on a panel — with wording that says so, rather than reusing the artwork upload
   and its rights statement?
4. **Should a benchmark expire?** The spec does not say. A card is a fact about a page on a day; a year later it may be
   wrong in every line. We keep it until a member removes it, and the card carries the date it was read.
5. **Who may read a brand's benchmarks?** Today every member of the brand, as with designs. A benchmark can say
   uncomfortable things about a competitor, so an owner may want it narrower.
6. **Accuracy against a real key.** The 90%-of-`observed` acceptance test needs a measurement run outside CI. When
   should it happen, and against which model?

## How it is tested

- `apps/web/lib/benchmarks/*.test.ts`: the schema and its provenance rules; robots.txt parsing and the longest-rule
  decision; the fetch's refusals and its headers; the parser's three rules; the compare view; the apply plan, including
  the test that no brand or product name crosses over; the design-around check, including that it never says "safe";
  the corrections; the metered extractor; the store and its refusals. No test reaches a model or the network.
- `apps/web/tests/integration/benchmarks.test.ts`: what the database promises whatever the app does — one fetch per
  page per brand, five cards at most, the provenance rules, a card carrying markup refused, another brand's rows not
  found, and everything going with the brand.
- `apps/web/e2e/benchmarks.spec.ts`: making a comparison, taking review text in, correcting a card and seeing that the
  words are marked as the team's, two cards with a feature matrix, the mapping onto `JSY-SS-01` with `R-PAT-005` on the
  drop tail and the side split listed as unavailable, a private address refused with nothing fetched, and axe.
