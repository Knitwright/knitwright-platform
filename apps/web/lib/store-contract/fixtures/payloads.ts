import { dropsPayload, listingsPayload, manifestPayload, productsPayload, teamStoresPayload } from "../contract";
import { storePersonalisation } from "../personalisation";
import { bareProduct, dropRow, emptyTeamStore, fullProduct, fullTeamStore, listingPayloadSample, listingRow, numberRule, todayProduct, unpricedProduct, zones, AT } from "./samples";

/**
 * Every payload this contract can answer with, built twice over: once with everything the platform
 * could hold, and once with the gaps that are really there today. The field-path walk reads this
 * list, so a shape nobody put here is a shape nobody documented.
 *
 * The envelope is walked once, from the manifest, because all five answers share it. The payloads
 * this contract carries unchanged from another workstream, and the personalisation rules, are
 * walked once under their own prefix for the same reason.
 */
export const SAMPLE_PAYLOADS = (): readonly Readonly<{ prefix: string; value: unknown }>[] => {
  const drops = dropsPayload([dropRow()], AT);
  return [
    { prefix: "", value: manifestPayload(AT) },
    { prefix: "store-products", value: productsPayload([fullProduct(), todayProduct(), bareProduct(), unpricedProduct()], AT).data },
    { prefix: "store-drops", value: dropsPayload([dropRow(), dropRow({ dropId: "bad", payload: { kind: "nonsense" } })], AT).data },
    {
      prefix: "store-listings",
      value: listingsPayload([listingRow(), listingRow({ listingId: "bad", payload: {} }), listingRow({ collectedAt: AT.toISOString() })], AT).data,
    },
    { prefix: "store-team-stores", value: teamStoresPayload([fullTeamStore(), emptyTeamStore()], AT).data },
    { prefix: "collectionDrop", value: drops.data.drops[0]?.payload },
    { prefix: "launchListing", value: listingPayloadSample() },
    { prefix: "personalisation", value: storePersonalisation(zones, [numberRule]) },
  ];
};
