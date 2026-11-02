/**
 * The contract's own field list, and the walk that finds the fields a payload really has (plan v5 O2).
 *
 * Another product is written against this payload, so the shape is not allowed to change quietly.
 * `document.test.ts` builds every payload with everything the platform could hold and again with
 * the gaps that are there today, walks each one for its field paths, and holds the result to two
 * things:
 *
 *   1. the paths are exactly `CONTRACT_FIELDS`, so adding, renaming, moving or removing a field
 *      fails here;
 *   2. every path in `CONTRACT_FIELDS` appears, word for word, in `docs/store-contract-v2.md`, and
 *      that document names no path the payload does not have.
 *
 * So a change to the shape fails until the document changes with it.
 *
 * Three things are walked once rather than at every place they appear, because they are one shape
 * used in several and a reader wants one description of each:
 *
 *   * a `Gap` (`gap.*`): the four fields a missing value is sent as, wherever it appears;
 *   * the payloads this contract carries unchanged from another workstream (`collectionDrop.*`
 *     from decision 0085, `launchListing.*` from decision 0096);
 *   * the personalisation rules (`personalisation.*`), which a product and a team store both carry.
 */

/**
 * Keys whose own keys are data rather than fields: a measurement by size label, where the labels
 * come from the article's size run. The walk stops at these, and the document describes the map.
 */
export const OPEN_MAPS = ["valuesMm"] as const;

/** Keys whose subtree is one shape, documented once under its own prefix (see above). */
export const SHARED_SHAPES = ["payload", "personalisation"] as const;

/** The four fields a missing value is sent as. Documented once; they appear wherever a value can be absent. */
export const GAP_FIELDS = ["gap.because", "gap.missing", "gap.ruleId", "gap.status"] as const;

const stops = (key: string): boolean =>
  (OPEN_MAPS as readonly string[]).includes(key) || (SHARED_SHAPES as readonly string[]).includes(key);

const isGapNode = (node: object): boolean => (node as { status?: unknown }).status === "gap";

/**
 * Every field path in a value. An array contributes its own path once and its items are walked with
 * `[]` on the end, a `Gap` and a shared shape are leaves, and an open map is a leaf. Paths come back
 * sorted and without repeats, so two payloads can be compared.
 */
export function fieldPaths(value: unknown, prefix = ""): readonly string[] {
  const found = new Set<string>();
  const walk = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item, `${path}[]`);
      return;
    }
    if (node === null || typeof node !== "object" || isGapNode(node)) return;
    for (const [key, inner] of Object.entries(node)) {
      const next = path === "" ? key : `${path}.${key}`;
      found.add(next);
      if (!stops(key)) walk(inner, next);
    }
  };
  walk(value, prefix);
  return [...found].sort();
}

/** The paths of several payloads at once, so the held and the missing shapes are one list. */
export const allFieldPaths = (payloads: readonly Readonly<{ prefix: string; value: unknown }>[]): readonly string[] =>
  [...new Set([...GAP_FIELDS, ...payloads.flatMap((one) => fieldPaths(one.value, one.prefix))])].sort();

/** Every field path the contract may carry, as `allFieldPaths` writes them. Sorted, one per line. */
export const CONTRACT_FIELDS: readonly string[] = [
  "collectionDrop.assumes",
  "collectionDrop.collectionId",
  "collectionDrop.collectionName",
  "collectionDrop.currency",
  "collectionDrop.destinationCountry",
  "collectionDrop.generatedAt",
  "collectionDrop.handover",
  "collectionDrop.kind",
  "collectionDrop.labels",
  "collectionDrop.notes",
  "collectionDrop.payloadVersion",
  "collectionDrop.styles",
  "collectionDrop.styles[].articleCode",
  "collectionDrop.styles[].colourway",
  "collectionDrop.styles[].fabricCode",
  "collectionDrop.styles[].group",
  "collectionDrop.styles[].marginBp",
  "collectionDrop.styles[].name",
  "collectionDrop.styles[].productId",
  "collectionDrop.styles[].productionClass",
  "collectionDrop.styles[].rrpMinor",
  "collectionDrop.styles[].sizes",
  "collectionDrop.styles[].sizes[].size",
  "collectionDrop.styles[].sizes[].targetQty",
  "collectionDrop.styles[].status",
  "collectionDrop.styles[].styleId",
  "collectionDrop.styles[].targetUnits",
  "collectionDrop.styles[].unitCostMinor",
  "collectionDrop.styles[].wholesaleMinor",
  "collectionDrop.totals",
  "collectionDrop.totals.colourways",
  "collectionDrop.totals.d2cRevenueMinor",
  "collectionDrop.totals.landedCostMinor",
  "collectionDrop.totals.marginBp",
  "collectionDrop.totals.skus",
  "collectionDrop.totals.styles",
  "collectionDrop.totals.targetUnits",
  "collectionDrop.totals.wholesaleRevenueMinor",
  "contractVersion",
  "data",
  "data.endpoints",
  "data.endpoints[].kind",
  "data.endpoints[].path",
  "data.gaps",
  "data.gaps.gap",
  "data.gaps.held",
  "data.gaps.why",
  "data.notInThisContract",
  "data.token",
  "data.token.header",
  "data.token.lifetimeSeconds",
  "data.token.signsOver",
  "document",
  "gap.because",
  "gap.missing",
  "gap.ruleId",
  "gap.status",
  "generatedAt",
  "kind",
  "launchListing.designProjectId",
  "launchListing.designVersion",
  "launchListing.kind",
  "launchListing.launchProjectId",
  "launchListing.media",
  "launchListing.media[].boardId",
  "launchListing.media[].fileId",
  "launchListing.media[].format",
  "launchListing.media[].label",
  "launchListing.media[].name",
  "launchListing.media[].role",
  "launchListing.media[].sort",
  "launchListing.media[].trueColourFileId",
  "launchListing.note",
  "launchListing.payloadVersion",
  "launchListing.ruleId",
  "launchListing.title",
  "personalisation.nameCharacters",
  "personalisation.numbers",
  "personalisation.numbers[].highest",
  "personalisation.numbers[].label",
  "personalisation.numbers[].leadingZeroAllowed",
  "personalisation.numbers[].lowest",
  "personalisation.numbers[].note",
  "personalisation.numbers[].ruleId",
  "personalisation.numbers[].sport",
  "personalisation.screening",
  "personalisation.status",
  "personalisation.zones",
  "personalisation.zones[].label",
  "personalisation.zones[].maxCharacters",
  "personalisation.zones[].note",
  "personalisation.zones[].ruleId",
  "personalisation.zones[].zone",
  "store-drops.drops",
  "store-drops.drops[].brandId",
  "store-drops.drops[].collectionId",
  "store-drops.drops[].dropId",
  "store-drops.drops[].handedOverAt",
  "store-drops.drops[].payload",
  "store-drops.drops[].version",
  "store-drops.refused",
  "store-drops.refused[].id",
  "store-drops.refused[].reason",
  "store-drops.refused[].ruleId",
  "store-listings.listings",
  "store-listings.listings[].brandId",
  "store-listings.listings[].collected",
  "store-listings.listings[].collected.at",
  "store-listings.listings[].collected.status",
  "store-listings.listings[].handedOverAt",
  "store-listings.listings[].launchProjectId",
  "store-listings.listings[].listingId",
  "store-listings.listings[].payload",
  "store-listings.refused",
  "store-listings.refused[].id",
  "store-listings.refused[].reason",
  "store-listings.refused[].ruleId",
  "store-products.products",
  "store-products.products[].article",
  "store-products.products[].article.code",
  "store-products.products[].article.name",
  "store-products.products[].article.productionClass",
  "store-products.products[].article.status",
  "store-products.products[].brandId",
  "store-products.products[].delivery",
  "store-products.products[].delivery.productionStartsAt",
  "store-products.products[].delivery.promised",
  "store-products.products[].delivery.promised.promisedOn",
  "store-products.products[].delivery.promised.readyForQcOn",
  "store-products.products[].delivery.promised.shipsOn",
  "store-products.products[].delivery.promised.status",
  "store-products.products[].designProjectId",
  "store-products.products[].designVersion",
  "store-products.products[].media",
  "store-products.products[].media.items",
  "store-products.products[].media.items[].boardId",
  "store-products.products[].media.items[].fileId",
  "store-products.products[].media.items[].format",
  "store-products.products[].media.items[].label",
  "store-products.products[].media.items[].listingId",
  "store-products.products[].media.items[].name",
  "store-products.products[].media.items[].role",
  "store-products.products[].media.items[].sort",
  "store-products.products[].media.items[].trueColourFileId",
  "store-products.products[].media.status",
  "store-products.products[].name",
  "store-products.products[].personalisation",
  "store-products.products[].prices",
  "store-products.products[].prices.currencies",
  "store-products.products[].prices.status",
  "store-products.products[].prices.tiers",
  "store-products.products[].prices.tiers[].band",
  "store-products.products[].prices.tiers[].label",
  "store-products.products[].prices.tiers[].prices",
  "store-products.products[].prices.tiers[].prices.AUD",
  "store-products.products[].prices.tiers[].prices.AUD.status",
  "store-products.products[].prices.tiers[].prices.AUD.unitMinor",
  "store-products.products[].prices.tiers[].prices.GBP",
  "store-products.products[].prices.tiers[].prices.GBP.status",
  "store-products.products[].prices.tiers[].prices.GBP.unitMinor",
  "store-products.products[].prices.tiers[].qtyMax",
  "store-products.products[].prices.tiers[].qtyMin",
  "store-products.products[].prices.tiers[].ruleId",
  "store-products.products[].productId",
  "store-products.products[].publishedBy",
  "store-products.products[].publishedBy[].at",
  "store-products.products[].publishedBy[].collectionId",
  "store-products.products[].publishedBy[].dropId",
  "store-products.products[].publishedBy[].dropVersion",
  "store-products.products[].publishedBy[].launchProjectId",
  "store-products.products[].publishedBy[].listingId",
  "store-products.products[].publishedBy[].via",
  "store-products.products[].sellability",
  "store-products.products[].sellability.blockers",
  "store-products.products[].sellability.blockers[].code",
  "store-products.products[].sellability.blockers[].message",
  "store-products.products[].sellability.blockers[].ruleId",
  "store-products.products[].sellability.sellable",
  "store-products.products[].sizeChart",
  "store-products.products[].sizeChart.points",
  "store-products.products[].sizeChart.points[].code",
  "store-products.products[].sizeChart.points[].description",
  "store-products.products[].sizeChart.points[].letter",
  "store-products.products[].sizeChart.points[].ruleId",
  "store-products.products[].sizeChart.points[].tolMinusMm",
  "store-products.products[].sizeChart.points[].tolPlusMm",
  "store-products.products[].sizeChart.points[].valuesMm",
  "store-products.products[].sizeChart.sampleSize",
  "store-products.products[].sizeChart.sampleSize.size",
  "store-products.products[].sizeChart.sampleSize.status",
  "store-products.products[].sizeChart.sizes",
  "store-products.products[].sizeChart.source",
  "store-products.products[].sizeChart.status",
  "store-products.products[].sizeChart.unit",
  "store-products.products[].sizes",
  "store-products.products[].sizes.run",
  "store-products.products[].sizes.run[].inSizeRun",
  "store-products.products[].sizes.run[].planned",
  "store-products.products[].sizes.run[].planned.status",
  "store-products.products[].sizes.run[].planned.targetQty",
  "store-products.products[].sizes.run[].size",
  "store-products.products[].sizes.status",
  "store-products.products[].stage",
  "store-team-stores.teamStores",
  "store-team-stores.teamStores[].brandId",
  "store-team-stores.teamStores[].clubName",
  "store-team-stores.teamStores[].colours",
  "store-team-stores.teamStores[].colours[].colour",
  "store-team-stores.teamStores[].colours[].colour.hex",
  "store-team-stores.teamStores[].colours[].colour.status",
  "store-team-stores.teamStores[].colours[].slot",
  "store-team-stores.teamStores[].crest",
  "store-team-stores.teamStores[].crest.fileId",
  "store-team-stores.teamStores[].crest.status",
  "store-team-stores.teamStores[].design",
  "store-team-stores.teamStores[].design.name",
  "store-team-stores.teamStores[].design.projectId",
  "store-team-stores.teamStores[].design.status",
  "store-team-stores.teamStores[].design.version",
  "store-team-stores.teamStores[].handover",
  "store-team-stores.teamStores[].nameFont",
  "store-team-stores.teamStores[].numberFont",
  "store-team-stores.teamStores[].numbers",
  "store-team-stores.teamStores[].numbers.highest",
  "store-team-stores.teamStores[].numbers.label",
  "store-team-stores.teamStores[].numbers.leadingZeroAllowed",
  "store-team-stores.teamStores[].numbers.lowest",
  "store-team-stores.teamStores[].numbers.note",
  "store-team-stores.teamStores[].numbers.ruleId",
  "store-team-stores.teamStores[].numbers.sport",
  "store-team-stores.teamStores[].numbers.status",
  "store-team-stores.teamStores[].personalisation",
  "store-team-stores.teamStores[].seasons",
  "store-team-stores.teamStores[].seasons[].endsOn",
  "store-team-stores.teamStores[].seasons[].endsOn.date",
  "store-team-stores.teamStores[].seasons[].endsOn.status",
  "store-team-stores.teamStores[].seasons[].name",
  "store-team-stores.teamStores[].seasons[].seasonId",
  "store-team-stores.teamStores[].seasons[].startsOn",
  "store-team-stores.teamStores[].seasons[].startsOn.date",
  "store-team-stores.teamStores[].seasons[].startsOn.status",
  "store-team-stores.teamStores[].sizes",
  "store-team-stores.teamStores[].sizes.run",
  "store-team-stores.teamStores[].sizes.status",
  "store-team-stores.teamStores[].sponsors",
  "store-team-stores.teamStores[].sponsors[].logoFileId",
  "store-team-stores.teamStores[].sponsors[].name",
];
