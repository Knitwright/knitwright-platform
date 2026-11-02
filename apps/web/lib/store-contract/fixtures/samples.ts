import type { ArticlePom } from "@/lib/catalogue";
import { dropPayload } from "@/lib/collections/drop";
import { plan, pricing } from "@/lib/collections/fixtures/plan";
import { appTier } from "@/lib/factory/fixtures/rows";
import type { Ladder } from "@/lib/factory/pricing";
import { LISTING_KIND, LISTING_NOTE, LISTING_PAYLOAD_VERSION, type ListingPayload } from "@/lib/flows/listing";
import type { Kit } from "@/lib/clubs/kit";
import type { DeliveryInput } from "../delivery";
import type { DropRow } from "../drops";
import type { ListingRow } from "../listings";
import { storePersonalisation, type NumberRule, type PersonalisationZone } from "../personalisation";
import type { ProductInput } from "../product";
import type { TeamStoreInput } from "../team-store";

/**
 * Samples for the tests of this directory. Every label says "test", so no figure from here can be
 * mistaken for one a factory agreed, and every sample is built twice: once with everything the
 * platform could hold, and once with the gaps that are actually there today.
 */

export const ids = {
  product: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
  project: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
  brand: "ffffffff-ffff-4fff-8fff-fffffffffff1",
  drop: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9",
  collection: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  listing: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb9",
  launch: "44444444-4444-4444-8444-444444444444",
  season: "cccccccc-cccc-4ccc-8ccc-ccccccccccc9",
} as const;

export const AT = new Date("2027-01-04T09:00:00.000Z");

/** The seeded British ladder: priced in pounds, with nothing in Australian dollars (decision 0104). */
export const gbpOnlyLadder: Ladder = [appTier(10, 19, 2900), appTier(20, 49, 2500), appTier(50, null, 2200)];

/** A ladder with both figures, for the test that proves the shape works once a figure exists. */
export const bothLadder: Ladder = [appTier(10, 19, 2900, 5600), appTier(20, 49, 2500, 4800), appTier(50, null, 2200, 4200)];

export const pom = (over: Partial<ArticlePom> = {}): ArticlePom => ({
  letter: "A",
  code: "CHEST_1CM_BELOW_ARMHOLE",
  description: "Chest, 1 cm below the armhole, laid flat",
  gradeType: "linear",
  gradeMm: 20,
  tolMinusMm: 10,
  tolPlusMm: 10,
  valuesMm: { S: 500, M: 520, L: 540 },
  ruleId: "R-POM-001",
  ...over,
});

export const zones: readonly PersonalisationZone[] = [
  { zone: "back-name", label: "Name across the upper back", maxCharacters: 12, ruleId: "R-PER-001", note: "test row, from the article's rulebook" },
  { zone: "back-number", label: "Number on the back", maxCharacters: 2, ruleId: "R-GAP-000", note: "test row, no rulebook entry" },
];

export const numberRule: NumberRule = {
  sport: "football",
  label: "Football",
  lowest: 1,
  highest: 99,
  leadingZeroAllowed: true,
  ruleId: "R-GAP-000",
  note: "test row, not read against any league rule book",
};

export const personalisation = () => storePersonalisation(zones, [numberRule]);

/** Today's dates: a lead time agreed, and neither QC nor freight on file. */
export const deliveryToday: DeliveryInput = {
  orderAt: AT,
  productionClass: "A",
  timeZone: "Asia/Karachi",
  cutoff: { weekday: 1, minutes: 720 },
  leadTimeDays: 21,
  qcDays: null,
  freightDays: null,
};

export const deliveryComplete: DeliveryInput = { ...deliveryToday, qcDays: 3, freightDays: 7 };

export const listingMedia: ListingPayload["media"] = [
  { boardId: "b1", name: "Front flat", fileId: "f1", format: "png", role: "image", label: null, trueColourFileId: null, sort: 1 },
  { boardId: "b2", name: "Scene", fileId: "f2", format: "jpg", role: "image", label: "AI-generated", trueColourFileId: "f1", sort: 2 },
];

export const listingPayloadSample = (over: Partial<ListingPayload> = {}): ListingPayload => ({
  kind: LISTING_KIND,
  payloadVersion: LISTING_PAYLOAD_VERSION,
  launchProjectId: ids.launch,
  title: "Home kit 2027",
  designProjectId: ids.project,
  designVersion: 7,
  media: listingMedia,
  note: LISTING_NOTE,
  ruleId: "R-GAP-000",
  ...over,
});

export const listingRow = (over: Partial<ListingRow> = {}): ListingRow => ({
  listingId: ids.listing,
  brandId: ids.brand,
  launchProjectId: ids.launch,
  createdAt: "2027-01-03T10:00:00.000Z",
  collectedAt: null,
  payload: listingPayloadSample(),
  ...over,
});

export const dropRow = (over: Partial<DropRow> = {}): DropRow => ({
  dropId: ids.drop,
  brandId: ids.brand,
  collectionId: ids.collection,
  version: 1,
  createdAt: "2027-01-02T10:00:00.000Z",
  payload: dropPayload(plan(), pricing(), AT),
  ...over,
});

/** A product with everything the platform could hold about it. */
export const fullProduct = (over: Partial<ProductInput> = {}): ProductInput => ({
  productId: ids.product,
  brandId: ids.brand,
  designProjectId: ids.project,
  designVersion: 7,
  name: "Home jersey 2027",
  stage: "run",
  publications: [{ via: "collection-drop", collectionId: ids.collection, dropId: ids.drop, dropVersion: 1, at: "2027-01-02T10:00:00.000Z" }],
  article: { code: "JSY-SS-01", name: "Short-sleeve jersey", productionClass: "A", sizes: ["S", "M", "L"], sampleSize: "M", poms: [pom()] },
  ladder: bothLadder,
  planned: [{ size: "M", targetQty: 20 }],
  media: listingMedia.map((item) => ({ ...item, listingId: ids.listing })),
  delivery: deliveryComplete,
  personalisation: personalisation(),
  ...over,
});

/** Handed over by a launch pack rather than a plan, with no article behind it and nothing priced. */
export const bareProduct = (over: Partial<ProductInput> = {}): ProductInput =>
  fullProduct({
    publications: [{ via: "flow-listing", listingId: ids.listing, launchProjectId: ids.launch, at: "2027-01-03T10:00:00.000Z" }],
    article: null,
    ladder: [],
    planned: [],
    media: [],
    delivery: deliveryToday,
    personalisation: storePersonalisation([], []),
    ...over,
  });

/** A ladder with a band nobody has priced in either currency, so both sides of the band are gaps. */
export const unpricedProduct = (over: Partial<ProductInput> = {}): ProductInput =>
  fullProduct({ ladder: [appTier(10, null, null, null)], ...over });

/** The same product as the platform really holds it today: no measurement, no date, no Australian figure. */
export const todayProduct = (over: Partial<ProductInput> = {}): ProductInput =>
  fullProduct({
    article: { code: "SHT-01", name: "Shorts", productionClass: "A", sizes: ["S", "M", "L"], sampleSize: null, poms: [] },
    ladder: gbpOnlyLadder,
    planned: [],
    media: [],
    delivery: deliveryToday,
    ...over,
  });

export const fullKit: Kit = {
  primaryColour: "#0b3d91",
  secondaryColour: "#ffffff",
  accentColour: "#c8102e",
  crestFileId: "11111111-1111-4111-8111-111111111112",
  sponsors: [{ name: "Test Sponsor", logoFileId: null }],
  nameFont: "geist",
  numberFont: "geist",
};

export const emptyKit: Kit = {
  primaryColour: null,
  secondaryColour: null,
  accentColour: null,
  crestFileId: null,
  sponsors: [],
  nameFont: "geist",
  numberFont: "geist",
};

export const fullTeamStore = (over: Partial<TeamStoreInput> = {}): TeamStoreInput => ({
  brandId: ids.brand,
  clubName: "Test Rangers",
  kit: fullKit,
  design: { projectId: ids.project, version: 7, name: "Home kit 2027" },
  seasons: [{ seasonId: ids.season, name: "2027", startsOn: "2027-08-01", endsOn: "2028-05-31" }],
  numbers: numberRule,
  sizes: ["S", "M", "L"],
  personalisation: personalisation(),
  ...over,
});

export const emptyTeamStore = (over: Partial<TeamStoreInput> = {}): TeamStoreInput =>
  fullTeamStore({
    kit: emptyKit,
    design: null,
    seasons: [{ seasonId: ids.season, name: "2027", startsOn: null, endsOn: null }],
    numbers: null,
    sizes: [],
    ...over,
  });
