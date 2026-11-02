# 0106: The Store contract v2 — what the separate Store reads, and what it is told we do not have

Status: Proposed; every gap in the payload is a gap because the platform really holds nothing there, nothing is
sellable today, and the AUD and delivery gaps are the two the owner's own decisions put there; owner questions listed
Index: Proposed; five read endpoints behind a signed service token, a 247-field document locked to the shape by a
test, every absent value sent as an explicit gap instead of a null, no AUD figure and no delivery date anywhere, and
nothing sellable today because the care label refuses every order
Index title: The Store contract v2: read endpoints, a documented payload and explicit gaps
Date: 2026-11-02
Plan step: wave 5, O2. Builds on decisions 0062 (brand products), 0066 (base articles), 0071 (the factory model),
0085 (the collection drop), 0086 (teamwear and the roster sign-up), 0089 (compliance), 0090 (the remaining article
data), 0096 (flows and the listing hand-off), 0100 (the cron secret idiom) and 0104 (the Australian tiers).

## Context

The Store is a **separate product** (owner decision 1). This platform holds no cart, no till, no provider, no shop
front and no takings, and the one hand-off to production is `submit_order_for_production`. So O2 is not a shop: it is
an interface another product is written against.

Two workstreams had already built the hand-offs this interface is made of, and neither publishes anything:

* **"Create drop"** (Z4, decision 0085) writes a payload into `collection_drops`, append-only, numbered per
  collection. Its own file says the payload is "what the Knitwright Store collects, and nothing more".
* **"Publish to store"** (L6, decision 0096) writes a payload into `flow_listings`, append-only, and its own file
  says plainly that it "does not publish anything". `flow_listings.collected_at` carries a comment saying it is
  "set by wave 5".

So the records exist. What did not exist was a way for the Store to read them, and a written shape it could be built
against.

### The two things that are true today and had to stay true in the payload

**No delivery date can be shown anywhere.** `promisedDate` (decision 0071) answers "not set" unless the factory's
lead time, the days for QC and the destination's freight days are all on file. The QC window is a platform setting
nobody has set and no `country_rules` row selling is on for carries freight days, so the answer is "not set" for
every article in every market. Every screen in the platform already names what is missing instead of a date.

**No Australian dollar price exists.** O3 (decision 0104) seeded the Australian tiers with `sell_aud_minor` null on
all three, because no Australian figure is published anywhere, and holds a test to no digit appearing in an unpriced
Australian row.

A reader we do not control cannot be trusted with a `null` in either place. A `null` delivery date renders as today;
a `null` price renders as free. Both would be Knitwright telling a lie through another product's page.

### What the platform actually holds about a product

* Seven of the eight base articles publish **no point of measure at all** (decision 0090): their tables are
  deliberately empty, because the factory's pattern master has supplied none.
* The production package **refuses every order on its care label** (decision 0089): ISO 3758 is not in this
  repository, so no care symbol and no care wording exists, so no label may be printed for any market.
* `brand_products` holds no article code. A product's article is known only from a hand-off that names one.
* Nothing records which base article a club's kit is made from: the kit holds colours, a crest, sponsors and fonts,
  and "Design in Studio" **copies** them into a design rather than linking back (decision 0062).

## Decision

**Five read endpoints under `/api/store`, each behind a signed service token, answering one envelope whose every
absent value is an explicit gap, and one document — `docs/store-contract-v2.md` — that a test holds the shape to.**

1. **The gap, not the null.** Every field that can be absent is a union of two shapes tagged on `status`: `held`
   with the value, or `gap` with `missing`, `because` and `ruleId` — and **no value field at all**, not an empty one
   and not a null one. `lib/store-contract/gap.test.ts` holds a gap to carrying no value-shaped key and no null, and
   `team-store.test.ts` holds a whole empty configuration to carrying the text `null` nowhere.
2. **`GET /api/store`** — a manifest: the endpoints, how a call is signed, the gap rule, and the sentence saying
   nothing here takes money.
3. **`GET /api/store/products`** — published products with their media, sizes, tier prices in GBP and AUD, delivery,
   personalisation rules, size chart and a sellability verdict. **A product is in the answer because the platform
   holds a hand-off naming it** — a drop style with its `productId`, or a listing whose design is the product's.
   `publishedBy` says which, and is never empty; a product nobody handed over is not in the answer at all.
4. **`GET /api/store/drops`** and **`GET /api/store/listings`** — Z4's and L6's payloads, carried through unchanged
   with the row's identity around them. No second listing payload is written anywhere in this workstream.
5. **`GET /api/store/team-stores`** — a club's configuration from its kit and its listed design: the colours, the
   crest, the sponsors, the fonts, the seasons, the numbers its sport allows. A configuration, never a shop.
6. **The token.** `v1.<payload kind>.<expiry>.<digest of the canonical query>` plus an HMAC-SHA256 of all of it,
   under `STORE_SERVICE_TOKEN`, in the `x-knitwright-store-token` header, compared with `timingSafeEqual`. The same
   idiom as the files-service token (decision 0070). **Binding the payload kind and the query** is what the token
   proves: a token for the drops cannot read the products, and a token caught in a log cannot be replayed against
   another brand's `brandId`.
7. **Switched off rather than open.** With the secret unset — which is every environment today, including CI — every
   endpoint answers 503 and reads nothing. That is decision 0100's choice for the weekly cut, for the same reason: an
   open read of every brand's products is worse than an endpoint that answers nothing. A token that does not verify
   answers 404, with one sentence naming the header and what to sign, identical however it failed.

### Nothing is sellable today, and the payload says so

`sellability` on every product carries `care_label_refused` (`R-LAB-002`), because no care label can be printed, so
no order can be made. Alongside it every product today carries `no_price_aud` and `no_delivery_date`; seven of the
eight articles carry `no_size_chart`; a product handed over by a drop and no launch pack carries `no_media`. Each
reason is read off the payload's own fields, so the verdict cannot disagree with what the payload shows.

## Evidence

* `lib/store-contract` unit tests: 146 across 14 files, **100% of statements, branches, functions and lines** (the
  directory is held to 90% in `vitest.config.mts`). `lib/store-contract/server.ts` is the one file excluded, with a
  line beside the fifteen neighbours that are excluded for the same reason: it joins the contract to the database
  and holds no rule of its own.
* `document.test.ts` walks every payload, built once with everything the platform could hold and again with the gaps
  that are really there, and finds **247 field paths**. It fails unless each one appears word for word in
  `docs/store-contract-v2.md` and unless that document names no path a payload does not have. So the shape cannot
  change without the document changing with it.
* `no-payment.test.ts` reads every key and every sentence of every payload, and every string of every file in
  `lib/store-contract` and `app/api/store`, against `cart|checkout|stripe|paypal|payment|pay\b|paid|payout|
  storefront|shopify|basket|tender|till|refund|discount|coupon|voucher|subscription`. The one allowance is the
  sentence that says none of them is in the contract.
* `app/api/store/routes.test.ts`: 38 tests over the five endpoints, including the one that matters — **a signed-in
  member's own session, with no token, still answers 404**. A session is not a key here.
* `tests/integration/store-contract.test.ts` proves the database's half: row security is on for every table these
  endpoints read, a browser may only read the nine a member may see and may do **nothing at all** to
  `price_tiers`, `shirt_zone_limits`, `sport_number_rules` and `platform_settings`, a visitor with no session sees
  nothing, and a member sees no row of another brand — which is why the cross-brand answer has to be server-only. It
  also reads back the three facts the payload rests on: no tier carries an Australian figure, no market selling is on
  for carries freight days and no QC window is set, and one base article of eight publishes a point of measure.
* **No migration.** Every row this contract reads already exists and the service role already holds SELECT on all of
  them. The table list was checked against `supabase/migrations` before claiming a timestamp, and none was claimed.
* **No new dependency.** Everything is `node:crypto`, `zod` and the platform's own modules.

## Alternatives

* **A `published_products` table with a publish flag.** Rejected: it would be a second record of something the
  platform already records twice, and a flag is a guess where a hand-off is a fact. The two append-only hand-off
  tables are the record, and reading them means a drop exported in a year still reads as the brand exported it.
* **Null for an absent value, with the meaning in the document.** Rejected, and this is the decision the whole
  shape turns on. A document is read once and a field is read every render. The gap is a different *shape*, so a
  reader that forgets is a type error rather than a wrong date on a page.
* **Converting the GBP figure into AUD at a rate.** Refused. A rate nobody published is as invented as a price
  nobody published, and `money.test.ts` holds the pound figure to appearing nowhere inside an Australian entry.
* **Leaving a product with gaps out of the payload.** Rejected: it would make the Store's catalogue look complete
  by hiding what is missing. Everything is handed over, with `sellability` saying what each gap stops.
* **A session for the Store.** Rejected: the Store is a service and reads across brands, which no session may do.
* **Marking a listing collected (`flow_listings.collected_at`).** Left out deliberately. It is a write, the service
  role holds SELECT only on that table, and it would need a SECURITY DEFINER function and a migration. The field
  stays as L6 left it and the payload reports it as a state. See the owner questions.
* **A screen showing the owner what the Store would receive.** Not built. O2 is an interface, and a page that
  rendered the payload would be a second reading of it to keep in step. The document is the thing to read.

## Consequences

* The Store can be built against a written shape, and told in the same breath that it may show no date and no
  Australian price, and that nothing is sellable yet.
* The shape is now locked to its document by a test. Adding a field means adding a row to
  `docs/store-contract-v2.md`; changing what a field means raises `contractVersion`.
* Two figures are taken from thin data and the decision record says so rather than hiding it: a team store's design
  is the club's **most recently listed product**, because nothing records which design a kit was settled on; and its
  number rule comes from the sport on the club's **roster sign-up link**, falling back to the `default` row.
* A team store's size run is a gap for every club, because nothing records the kit's base article.
* `R-GAP-000` is used for every check this workstream adds. The rulebook has no entry for any of them, and they are
  listed in the pull request comment.
* What would make us revisit it: a care label source arriving (it would make `sellable` able to be true); an AUD
  figure or a QC and freight figure arriving (they would turn two gaps into held values with no shape change); the
  Store needing to say it has collected a hand-off (a write, and a migration).

## Owner questions

1. **Which design is a team store's?** Nothing records which design a club's kit was settled on, so the newest
   listed product's design is used. Should the kit hold the design it was applied to?
2. **Should the Store be able to mark a hand-off collected?** `flow_listings.collected_at` was left for this wave
   and is still null everywhere. It is a write, so it needs a function and a migration.
3. **Does personalisation cost extra, and who decides?** `price_tiers.personalisation_cost_minor` is a factory cost
   in the factory's own currency. It is deliberately not published: a retail decision belongs to the Store.
4. **Should a product with gaps be offered at all?** The payload hands over everything and says what each gap stops.
   The alternative is for Knitwright to withhold a product until it is whole.
5. **How long should a token live, and should the Store get one secret or one per environment?** Five minutes per
   call today, one secret per deploy.
6. **Which markets may the Store sell in?** `country_rules.selling_enabled` is the switch. Only the markets with it
   on are read for freight days.
