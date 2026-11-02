# The Store contract, version 2

What the separate Knitwright Store reads out of the Knitwright platform, field by field.

The Store is a different product. **This platform holds no cart, no till, no provider, no shop front and
no takings, and nothing in this contract can be used to take money.** It answers reads: what a brand has
published, what it is made of, what Knitwright holds about it and — just as plainly — what Knitwright does
not. The one hand-off to production happens inside Knitwright, through `submit_order_for_production`.

This document is the contract. `apps/web/lib/store-contract/document.test.ts` walks every payload for its
fields and fails unless each one appears here, word for word, and unless every field this document names is
one a payload really has. So the shape cannot change without this file changing with it.

## Two things that are true today

**No delivery date exists.** The days for QC and the freight days are both unset: no factory has agreed a QC
window and no destination row carries freight days. So `delivery.promised` is a gap for every product, in
every market, and it carries no date field at all. Name what is missing; do not show a date.

**No Australian dollar price exists.** The Australian quantity bands are seeded with no figure in them,
because none is published anywhere. So the `AUD` side of every band is a gap. **Do not convert the pound
figure**: a rate nobody published is as invented as a price nobody published.

## Signing a call

Every endpoint wants a token in the `x-knitwright-store-token` header. It is

    v1.<payload kind>.<expiry in seconds>.<digest of the canonical query>.<HMAC-SHA256 of all of that>

signed with the shared secret, where the canonical query is this call's query with its keys sorted and its
empty values left out, joined by `&`, and the digest is `HMAC-SHA256("knitwright-store-query", query)` in
hex. A token is good for five minutes; sign one per call. Binding the payload kind and the query means a
token caught in a log cannot be replayed to read something else.

Without the secret set on the deploy, every endpoint answers 503 and reads nothing: switched off is safer
than open. A token that does not verify gets 404, with one sentence saying how to sign.

## Errors

| Answer | What it means |
|---|---|
| 503 | The endpoint is switched off on this deploy: the secret is not set. Nothing was read. |
| 404 | The token is missing or does not verify. The answer says which header to send and what to sign over. |
| 400 | The query is wrong. The answer names the field. |
| 429 | Too many calls. Wait for the window in the `retry-after` header. |

## The envelope

Every answer has the same four fields around its payload.

| Field | What it is |
|---|---|
| `contractVersion` | The version of this contract, `2`. Raised when a field below changes meaning. A reader that does not know the number should stop rather than guess. |
| `data` | The payload itself. Its shape depends on `kind`; one section below for each. |
| `document` | The path of this document inside the Knitwright repository, so an answer always says where its own field list is. |
| `generatedAt` | When this answer was built, as an ISO instant. It is not a cache time and nothing may be inferred from it. |
| `kind` | Which payload this is: `store-manifest`, `store-products`, `store-drops`, `store-listings` or `store-team-stores`. |

## A gap: a value Knitwright does not hold

This is the one idea the contract rests on, so read it before anything else.

A field that could be absent is one of two shapes, told apart by `status`:

```json
{ "status": "held", "unitMinor": 2900 }
```

```json
{
  "status": "gap",
  "missing": ["the days for QC", "the freight days"],
  "because": "Not set: the days for QC and the freight days. No delivery date exists, so the Store names what is missing instead of showing one.",
  "ruleId": "R-GAP-000"
}
```

A gap carries **no value field at all** — not an empty one and not a null one. That is deliberate: a null delivery date renders as today and a null price renders as free, and both would be a lie Knitwright told through another product's page. Where a field is a gap, show `because`.

Wherever this document says "or a gap", these four fields are what arrives instead.

| Field | What it is |
|---|---|
| `gap.because` | One sentence a reader may show in place of the value. Written for a person, and safe to put on a page. |
| `gap.missing` | What the platform does not hold, in its own words, one entry per missing thing. Never empty. |
| `gap.ruleId` | The rulebook entry that explains the gap, as `R-TOPIC-000`. `R-GAP-000` where the rulebook has no entry for it yet. |
| `gap.status` | Always the text `"gap"`. The one field to look at: a value the platform holds has `"held"` here instead. |

## `GET /api/store` — the manifest

Describes the contract to a reader that has only the address. Signed over `store-manifest`.

| Field | What it is |
|---|---|
| `data.endpoints` | Every endpoint of this contract. |
| `data.endpoints[].kind` | The payload kind that endpoint answers with, which is also the text a token for it is signed over. |
| `data.endpoints[].path` | The endpoint's path on the Knitwright deploy. |
| `data.gaps` | The rule for a value the platform does not hold, repeated inside every answer so it cannot be missed. |
| `data.gaps.gap` | What a field reads when it does not. |
| `data.gaps.held` | What a field reads when the platform holds it. |
| `data.gaps.why` | Why there is never a null here. |
| `data.notInThisContract` | Said plainly: nothing in this contract takes money, and nothing in it names a cart, a till, a provider, a shop front or any takings. |
| `data.token` | How a call is signed. |
| `data.token.header` | The header the token goes in: `x-knitwright-store-token`. |
| `data.token.lifetimeSeconds` | How long a token stays good for. Sign one per call. |
| `data.token.signsOver` | The text that is signed, before the HMAC is appended to it. |

## `GET /api/store/products` — published products

Signed over `store-products`. Takes `limit` (1 to 200, 50 by default), `brandId`, `currency` and `country`.

A product is here because Knitwright holds a hand-off naming it: a drop exported from a collection plan, or a launch pack handed over from a flow canvas. **A product nobody handed over is not in this payload**, and `publishedBy` is never empty. Nothing is left out because it has gaps, and nothing is presented as complete because its gaps were quiet: read `sellability` first.

| Field | What it is |
|---|---|
| `store-products.products` | Every published product, one entry each. A product with no hand-off naming it is not here at all. |
| `store-products.products[].article` | The base article the product is made from, or a gap where no hand-off and no run names one. |
| `store-products.products[].article.code` | The article code, such as `JSY-SS-01`. |
| `store-products.products[].article.name` | The article's name in the Knitwright catalogue. |
| `store-products.products[].article.productionClass` | `A` for the weekly batch programme, `B` for a one-off run. |
| `store-products.products[].article.status` | `"held"`. |
| `store-products.products[].brandId` | The brand that owns the product. |
| `store-products.products[].delivery` | When an order placed now would be delivered. |
| `store-products.products[].delivery.productionStartsAt` | When production would start counting: the factory's next weekly cut-off read on its own clock, or the moment of a Class B order. An ISO instant. **It is not a delivery date and must never be shown as one.** |
| `store-products.products[].delivery.promised` | The delivery promise, or a gap. **It is a gap for every product today**: the days for QC and the freight days are both unset, so no date exists and the Store must name what is missing instead. |
| `store-products.products[].delivery.promised.promisedOn` | The day it would arrive. The only field that is a delivery date. |
| `store-products.products[].delivery.promised.readyForQcOn` | The day the run would be ready for inspection, as `YYYY-MM-DD`. |
| `store-products.products[].delivery.promised.shipsOn` | The day it would leave the factory. |
| `store-products.products[].delivery.promised.status` | `"held"`. |
| `store-products.products[].designProjectId` | The design behind the product. |
| `store-products.products[].designVersion` | The saved version of that design the product stands on. A later version is a later product entry, never a silent change to this one. |
| `store-products.products[].media` | The pictures and clips of the product, or a gap where no launch pack has been handed over for it. |
| `store-products.products[].media.items` | One entry per picture or clip, in the order the hand-off set. |
| `store-products.products[].media.items[].boardId` | The board on the flow canvas that made it. |
| `store-products.products[].media.items[].fileId` | The file's id in Knitwright. Ask for the file through the files endpoint; this contract carries no bytes. |
| `store-products.products[].media.items[].format` | `png`, `jpg`, `mp4` or `pdf`. |
| `store-products.products[].media.items[].label` | `AI-generated` where a model made or touched the item, otherwise `null`. **A labelled item may not be shown as a photograph.** |
| `store-products.products[].media.items[].listingId` | The listing hand-off the item came from. |
| `store-products.products[].media.items[].name` | What that board was called. |
| `store-products.products[].media.items[].role` | `image` or `video`. |
| `store-products.products[].media.items[].sort` | The order to show the items in, smallest first. |
| `store-products.products[].media.items[].trueColourFileId` | The picture Knitwright drew itself that must be shown beside an AI scene, so a shopper sees the true colour. `null` where this item is such a picture already, or where the nearest one Knitwright drew is a live render with no file behind it. |
| `store-products.products[].media.status` | `"held"`. |
| `store-products.products[].name` | What the brand called the product. |
| `store-products.products[].personalisation` | The rules for a name or a number on this product. One shape, described under *Personalisation rules* below. |
| `store-products.products[].prices` | The price ladder, or a gap where no factory on file has priced the article. |
| `store-products.products[].prices.currencies` | The currencies this contract carries, whether or not each has a figure: `GBP` and `AUD`. |
| `store-products.products[].prices.status` | `"held"`. |
| `store-products.products[].prices.tiers` | One entry per quantity band, smallest first. |
| `store-products.products[].prices.tiers[].band` | How the band reads: `10-19`, `50+`. |
| `store-products.products[].prices.tiers[].label` | The provenance label of the row the figures came from, word for word. Every seeded figure today is a labelled Knitwright draft no factory has agreed. |
| `store-products.products[].prices.tiers[].prices` | One entry per currency. |
| `store-products.products[].prices.tiers[].prices.AUD` | What one piece costs in Australian dollars in this band, or a gap. **It is a gap on every band today** (decision 0104): no Australian figure is published anywhere, and the pound figure must not be converted into one. |
| `store-products.products[].prices.tiers[].prices.AUD.status` | `"held"`. |
| `store-products.products[].prices.tiers[].prices.AUD.unitMinor` | Australian cents for one piece, as a whole number. Absent today. |
| `store-products.products[].prices.tiers[].prices.GBP` | What one piece costs in pounds in this band, or a gap. |
| `store-products.products[].prices.tiers[].prices.GBP.status` | `"held"`. |
| `store-products.products[].prices.tiers[].prices.GBP.unitMinor` | Pence for one piece, as a whole number. Multiply; never round. |
| `store-products.products[].prices.tiers[].qtyMax` | The largest, or `null` for the open top band. `null` here is a band with no top, not a missing figure. |
| `store-products.products[].prices.tiers[].qtyMin` | The smallest number of pieces in the band. |
| `store-products.products[].prices.tiers[].ruleId` | The rulebook entry behind the band. |
| `store-products.products[].productId` | The product's id in Knitwright. Stable; use it as the key. |
| `store-products.products[].publishedBy` | Why this product is in the payload: every hand-off that names it. Never empty. |
| `store-products.products[].publishedBy[].at` | When that hand-off was written, as an ISO instant. |
| `store-products.products[].publishedBy[].collectionId` | The collection plan the drop came from. Only on a `collection-drop`. |
| `store-products.products[].publishedBy[].dropId` | The drop row. Only on a `collection-drop`. |
| `store-products.products[].publishedBy[].dropVersion` | Which export of that collection it was: 1, then 2 on the next. Only on a `collection-drop`. |
| `store-products.products[].publishedBy[].launchProjectId` | The flow canvas the pack came from. Only on a `flow-listing`. |
| `store-products.products[].publishedBy[].listingId` | The listing row. Only on a `flow-listing`. |
| `store-products.products[].publishedBy[].via` | `collection-drop` for a drop exported from a collection plan, `flow-listing` for a launch pack handed over from a flow canvas. |
| `store-products.products[].sellability` | Whether the product can be sold at all, and why not. |
| `store-products.products[].sellability.blockers` | Every reason the product cannot be sold, in the order to act on them. |
| `store-products.products[].sellability.blockers[].code` | A stable code: `care_label_refused`, `no_price_gbp`, `no_price_aud`, `no_delivery_date`, `no_size_chart`, `no_media`. |
| `store-products.products[].sellability.blockers[].message` | The reason in words, safe to show to a person. |
| `store-products.products[].sellability.blockers[].ruleId` | The rulebook entry that explains the refusal. |
| `store-products.products[].sellability.sellable` | False while any blocker holds. **It is false for every product today.** Read this before offering anything. |
| `store-products.products[].sizeChart` | The size chart, or a gap. **Seven of the eight base articles are a gap** (decision 0090): their point-of-measure tables are deliberately empty, because no pattern master has supplied one and Knitwright invents no measurement. |
| `store-products.products[].sizeChart.points` | One entry per measured place. A place with no figure in any size is left out rather than sent empty. |
| `store-products.products[].sizeChart.points[].code` | The measurement's code, stable across articles. |
| `store-products.products[].sizeChart.points[].description` | What is being measured, and how, in words. |
| `store-products.products[].sizeChart.points[].letter` | The letter the tech pack's diagram marks this place with. |
| `store-products.products[].sizeChart.points[].ruleId` | The rulebook entry that explains the measurement. |
| `store-products.products[].sizeChart.points[].tolMinusMm` | How far under the figure a garment may measure and still be accepted, in millimetres. |
| `store-products.products[].sizeChart.points[].tolPlusMm` | How far over. |
| `store-products.products[].sizeChart.points[].valuesMm` | An object of size label to millimetres, with one key per size in `sizeChart.sizes`. A size with no figure has no key, which is a missing figure and not a zero. |
| `store-products.products[].sizeChart.sampleSize` | The size the article was made and measured in, or a gap where the article names none. |
| `store-products.products[].sizeChart.sampleSize.size` | The size label. |
| `store-products.products[].sizeChart.sampleSize.status` | `"held"`. |
| `store-products.products[].sizeChart.sizes` | The sizes the chart covers, in grading order. |
| `store-products.products[].sizeChart.source` | Which kind of chart this is: the garment's own points of measure, as the tech pack prints them. It is not a body chart, and no body chart is published for any base article. |
| `store-products.products[].sizeChart.status` | `"held"`. |
| `store-products.products[].sizeChart.unit` | Always `mm`. Every length in this contract is millimetres. |
| `store-products.products[].sizes` | The size run on offer, or a gap where there is no article and no plan to take one from. |
| `store-products.products[].sizes.run` | One entry per size, the article's own grading order first. |
| `store-products.products[].sizes.run[].inSizeRun` | True where the article grades to this size. False means a collection plan asked for a size the article has no grade for, which the Store should not offer. |
| `store-products.products[].sizes.run[].planned` | The target a collection plan set for this size, or a gap where none did. |
| `store-products.products[].sizes.run[].planned.status` | `"held"`. |
| `store-products.products[].sizes.run[].planned.targetQty` | The number of pieces the plan hoped to sell in this size. **A plan, not an amount held and not a limit.** Knitwright holds no stock figure of any kind. |
| `store-products.products[].sizes.run[].size` | The size label, as the article grades it. |
| `store-products.products[].sizes.status` | `"held"`. |
| `store-products.products[].stage` | How far the product has got inside Knitwright: `idea`, `sample` or `run`. It is not a shop state and says nothing about whether the product can be sold; read `sellability` for that. |

## `GET /api/store/drops` — drops from collection plans

Signed over `store-drops`. Takes `limit` and `brandId`.

| Field | What it is |
|---|---|
| `store-drops.drops` | Every exported drop, newest first. |
| `store-drops.drops[].brandId` | The brand that exported it. |
| `store-drops.drops[].collectionId` | The collection plan it was exported from. |
| `store-drops.drops[].dropId` | The drop row's id. |
| `store-drops.drops[].handedOverAt` | When it was exported, as an ISO instant. |
| `store-drops.drops[].payload` | The drop itself, carried through unchanged from the collection plan. Described under *The collection drop* below. |
| `store-drops.drops[].version` | Which export of that collection it was: 1, then 2 on the next. A reader that has seen a higher version need not read a lower one. |
| `store-drops.refused` | Rows this contract could not carry, so a reader is told rather than handed a half-read record. |
| `store-drops.refused[].id` | The row that was refused. |
| `store-drops.refused[].reason` | What is wrong with it and what to do about it. |
| `store-drops.refused[].ruleId` | The rulebook entry behind the refusal. |

## `GET /api/store/listings` — launch packs handed over

Signed over `store-listings`. Takes `limit` and `brandId`.

| Field | What it is |
|---|---|
| `store-listings.listings` | Every launch pack handed over, newest first. |
| `store-listings.listings[].brandId` | The brand that handed it over. |
| `store-listings.listings[].collected` | Whether anything has read this hand-off yet. A state Knitwright holds, not a gap. |
| `store-listings.listings[].collected.at` | When it was collected, as an ISO instant. Only on `collected`. |
| `store-listings.listings[].collected.status` | `collected` or `not-collected`. |
| `store-listings.listings[].handedOverAt` | When it was handed over, as an ISO instant. |
| `store-listings.listings[].launchProjectId` | The flow canvas it came from. |
| `store-listings.listings[].listingId` | The listing row's id. |
| `store-listings.listings[].payload` | The listing itself, carried through unchanged from the flow canvas. Described under *The launch listing* below. |
| `store-listings.refused` | Rows this contract could not carry. |
| `store-listings.refused[].id` | The row that was refused. |
| `store-listings.refused[].reason` | What is wrong with it and what to do about it. |
| `store-listings.refused[].ruleId` | The rulebook entry behind the refusal. |

## `GET /api/store/team-stores` — team store configuration

Signed over `store-team-stores`. Takes `limit` and `brandId`.

A configuration and nothing else. There is no link here, no shop front, no takings and no way to pay: a team store is the Store's own product, and this is what the club settled.

| Field | What it is |
|---|---|
| `store-team-stores.teamStores` | One entry per club that has a kit settled. |
| `store-team-stores.teamStores[].brandId` | The club's brand in Knitwright. |
| `store-team-stores.teamStores[].clubName` | The club's name. |
| `store-team-stores.teamStores[].colours` | The club's colours, one entry per slot. |
| `store-team-stores.teamStores[].colours[].colour` | The colour, or a gap where the club has not chosen one. A gap is not black: ask the club. |
| `store-team-stores.teamStores[].colours[].colour.hex` | The colour as `#rrggbb`. |
| `store-team-stores.teamStores[].colours[].colour.status` | `"held"`. |
| `store-team-stores.teamStores[].colours[].slot` | `primary`, `secondary` or `accent`. |
| `store-team-stores.teamStores[].crest` | The club's crest, or a gap where it has none on file. |
| `store-team-stores.teamStores[].crest.fileId` | The crest file's id in Knitwright. |
| `store-team-stores.teamStores[].crest.status` | `"held"`. |
| `store-team-stores.teamStores[].design` | The saved design the kit was settled on, or a gap where the club has a kit but no design behind it. |
| `store-team-stores.teamStores[].design.name` | What the club called it. |
| `store-team-stores.teamStores[].design.projectId` | The design. |
| `store-team-stores.teamStores[].design.status` | `"held"`. |
| `store-team-stores.teamStores[].design.version` | The saved version of it. |
| `store-team-stores.teamStores[].handover` | Said plainly: this is a configuration, not a shop. Knitwright holds no shop front for a team store and no way to take money for one. |
| `store-team-stores.teamStores[].nameFont` | The font a player's name is printed in. Only `geist` exists: it is the one face Knitwright holds a licence for. |
| `store-team-stores.teamStores[].numberFont` | The font a number is printed in. Only `geist` exists, for the same reason. |
| `store-team-stores.teamStores[].numbers` | The numbers the club's sport allows, or a gap where no rule for the sport is on file. On a gap the Store should take no number at all. |
| `store-team-stores.teamStores[].numbers.highest` | The highest. |
| `store-team-stores.teamStores[].numbers.label` | The sport's name for a screen. |
| `store-team-stores.teamStores[].numbers.leadingZeroAllowed` | Whether `07` keeps its leading zero. |
| `store-team-stores.teamStores[].numbers.lowest` | The lowest number allowed. |
| `store-team-stores.teamStores[].numbers.note` | Where the range came from, word for word from the row. Most are Knitwright drafts no league rule book has been read against. |
| `store-team-stores.teamStores[].numbers.ruleId` | The rulebook entry behind the range, or `R-GAP-000`. |
| `store-team-stores.teamStores[].numbers.sport` | The sport the rule is for. |
| `store-team-stores.teamStores[].numbers.status` | `"held"`. |
| `store-team-stores.teamStores[].personalisation` | The rules for a name or a number on this kit. One shape, described below. |
| `store-team-stores.teamStores[].seasons` | The club's seasons. |
| `store-team-stores.teamStores[].seasons[].endsOn` | The day it ends, or a gap. |
| `store-team-stores.teamStores[].seasons[].endsOn.date` | The day, as `YYYY-MM-DD`. |
| `store-team-stores.teamStores[].seasons[].endsOn.status` | `"held"`. |
| `store-team-stores.teamStores[].seasons[].name` | What the club called it. |
| `store-team-stores.teamStores[].seasons[].seasonId` | The season's id. |
| `store-team-stores.teamStores[].seasons[].startsOn` | The day it starts, or a gap where the club gave none. |
| `store-team-stores.teamStores[].seasons[].startsOn.date` | The day, as `YYYY-MM-DD`. |
| `store-team-stores.teamStores[].seasons[].startsOn.status` | `"held"`. |
| `store-team-stores.teamStores[].sizes` | The size run of the kit's article, or a gap where the article has none. |
| `store-team-stores.teamStores[].sizes.run` | The size labels, in grading order. |
| `store-team-stores.teamStores[].sizes.status` | `"held"`. |
| `store-team-stores.teamStores[].sponsors` | Up to three sponsors, in the order the club set. |
| `store-team-stores.teamStores[].sponsors[].logoFileId` | The sponsor's logo file, or `null` where the club gave none. |
| `store-team-stores.teamStores[].sponsors[].name` | The sponsor's name, as the club typed it and as it will be printed. |

## Personalisation rules

One shape, carried by a product and by a team store.

| Field | What it is |
|---|---|
| `personalisation.nameCharacters` | The character rule every typed name is held to, in Knitwright's own words. The Store should refuse the same names, so a wearer reads one explanation and not two. |
| `personalisation.numbers` | One entry per sport, by name. The row for `default` applies where a sport has none of its own. |
| `personalisation.numbers[].highest` | The highest. |
| `personalisation.numbers[].label` | The sport's name for a screen. |
| `personalisation.numbers[].leadingZeroAllowed` | Whether `07` keeps its leading zero. |
| `personalisation.numbers[].lowest` | The lowest number allowed. |
| `personalisation.numbers[].note` | Where the range came from, word for word from the row. |
| `personalisation.numbers[].ruleId` | The rulebook entry behind it, or `R-GAP-000`. |
| `personalisation.numbers[].sport` | The sport the rule is for. |
| `personalisation.screening` | Said plainly: a name or a number the Store takes is screened again by Knitwright before it reaches a print file. |
| `personalisation.status` | `"held"`, or a gap where no zone row and no number row is on file. On a gap the Store should take no name and no number. |
| `personalisation.zones` | One entry per printed zone. |
| `personalisation.zones[].label` | What the zone is called on a screen. |
| `personalisation.zones[].maxCharacters` | The longest text the zone takes. |
| `personalisation.zones[].note` | Where the figure came from, word for word from the row. |
| `personalisation.zones[].ruleId` | The rulebook entry behind it, or `R-GAP-000`. |
| `personalisation.zones[].zone` | `back-name`, `back-number`, `front-number` or `leg-number`. |

## The collection drop

Carried through unchanged from the collection plan (Knitwright decision 0085), which is the authority for every field below. It has its own `payloadVersion`.

| Field | What it is |
|---|---|
| `collectionDrop.assumes` | The assumption the margin figures rest on, word for word from the plan's own footer. |
| `collectionDrop.collectionId` | The collection plan. |
| `collectionDrop.collectionName` | What the brand called it. |
| `collectionDrop.currency` | The currency every figure in the drop is in. |
| `collectionDrop.destinationCountry` | The market the plan was costed for, ISO 3166 alpha-2. |
| `collectionDrop.generatedAt` | When the drop was built, as an ISO instant. |
| `collectionDrop.handover` | What the drop is for, so nobody reads it as an order. |
| `collectionDrop.kind` | Always `collection-drop`. |
| `collectionDrop.labels` | The provenance label of every row the money came from. |
| `collectionDrop.notes` | What was not on file when the drop was built. |
| `collectionDrop.payloadVersion` | The drop's own version, separate from `contractVersion`. |
| `collectionDrop.styles` | One entry per style in one colourway. |
| `collectionDrop.styles[].articleCode` | The base article, or `null` where the plan names none. |
| `collectionDrop.styles[].colourway` | The colourway. |
| `collectionDrop.styles[].fabricCode` | The fabric, or `null`. |
| `collectionDrop.styles[].group` | The named group on the plan's canvas, or `null`. |
| `collectionDrop.styles[].marginBp` | The plan's margin in basis points, or `null` where it could not be worked out. |
| `collectionDrop.styles[].name` | What the brand called the style. |
| `collectionDrop.styles[].productId` | The product in Knitwright, where the brand has listed one. This is the key that joins a drop to `store-products`. |
| `collectionDrop.styles[].productionClass` | `A`, `B`, or `null` where the plan names none. |
| `collectionDrop.styles[].rrpMinor` | The retail figure the plan carried, or `null` where none was set. `null` is not free. |
| `collectionDrop.styles[].sizes` | The planned pieces, by size. |
| `collectionDrop.styles[].sizes[].size` | The size label. |
| `collectionDrop.styles[].sizes[].targetQty` | The pieces planned in that size. A target, not an amount held. |
| `collectionDrop.styles[].status` | How far the style got in the plan. A draft goes into the drop carrying that status. |
| `collectionDrop.styles[].styleId` | The style card in the plan. |
| `collectionDrop.styles[].targetUnits` | The style's planned pieces in all, the sum of its sizes. |
| `collectionDrop.styles[].unitCostMinor` | The landed unit cost the plan showed, or `null` where no price was on file. |
| `collectionDrop.styles[].wholesaleMinor` | The wholesale figure the plan carried, in minor units, or `null` where none was set. |
| `collectionDrop.totals` | The plan's totals, as its own line plan showed them. |
| `collectionDrop.totals.colourways` | How many colourways. |
| `collectionDrop.totals.d2cRevenueMinor` | The direct side of the plan, or `null`. |
| `collectionDrop.totals.landedCostMinor` | The landed cost in all, or `null` while any line had no price. |
| `collectionDrop.totals.marginBp` | The plan's margin in basis points, or `null`. |
| `collectionDrop.totals.skus` | How many size and colourway pairs. |
| `collectionDrop.totals.styles` | How many styles. |
| `collectionDrop.totals.targetUnits` | The planned pieces in all. |
| `collectionDrop.totals.wholesaleRevenueMinor` | The wholesale side of the plan, or `null`. |

## The launch listing

Carried through unchanged from the flow canvas (Knitwright decision 0096), which is the authority for every field below. It has its own `payloadVersion`.

| Field | What it is |
|---|---|
| `launchListing.designProjectId` | The design the pack was made from, so the sizes and the chart are read from it. `null` where no design was on the canvas. |
| `launchListing.designVersion` | The saved version of that design, or `null`. |
| `launchListing.kind` | Always `launch-listing`. |
| `launchListing.launchProjectId` | The flow canvas the pack came from. |
| `launchListing.media` | One entry per finished picture or clip. A board with nothing on it is left out rather than sent empty. |
| `launchListing.media[].boardId` | The board that made it. |
| `launchListing.media[].fileId` | The file's id in Knitwright. |
| `launchListing.media[].format` | `png`, `jpg`, `mp4` or `pdf`. |
| `launchListing.media[].label` | `AI-generated` where a model made or touched it, otherwise `null`. A labelled item may not be shown as a photograph. |
| `launchListing.media[].name` | What that board was called. |
| `launchListing.media[].role` | `image` or `video`. |
| `launchListing.media[].sort` | The order to show the items in. |
| `launchListing.media[].trueColourFileId` | The picture Knitwright drew that must be shown beside an AI scene. `null` where this item is such a picture already, or where the nearest one is a live render with no file behind it. |
| `launchListing.note` | Said plainly: a hand-off, not a publication. Nothing has been published, priced or put on sale. |
| `launchListing.payloadVersion` | The listing's own version, separate from `contractVersion`. |
| `launchListing.ruleId` | The rulebook entry behind the hand-off, or `R-GAP-000`. |
| `launchListing.title` | What the brand called the listing. |

## What is not in this contract

No cart, no checkout, no provider, no shop front, no takings, no team store link, no basket, no
stock figure, no reservation. If a field looks as though it is about taking money, it belongs to the
Store, not to Knitwright, and it is not here. A test in `apps/web/lib/store-contract` reads every key
and every sentence of every payload and fails on any of those words.

## What is sellable today

Nothing. Every product carries at least the `care_label_refused` blocker: the care symbol standard is not in
the Knitwright repository, so no care symbol and no care wording exists, so no label can be printed for any
market, so the production package refuses every order. Alongside it, every product today also carries
`no_price_aud` and `no_delivery_date`, seven of the eight base articles carry `no_size_chart`, and a product
handed over without a launch pack carries `no_media`.

That is the honest state of the platform, and this contract's job is to say so rather than to hand over a
listing that looks ready.

## Changing this document

Add, rename or move a field and `document.test.ts` fails, naming the path. Add the path to
`CONTRACT_FIELDS` in `apps/web/lib/store-contract/document.ts` and a row for it here, in the section its
payload belongs to. Raise `contractVersion` when an existing field changes meaning.
