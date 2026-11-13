import { describe, expect, it } from "vitest";
import { CHANNELS, channelCard, TEAM_STORE_HREF } from "./catalogue";
import { PAGE_STATES } from "./fixtures/page-states";
import { outcomeOf } from "./outcome";
import { NO_SIZES } from "./sku";
import type { ChannelOrderRow, ListingRow } from "./store";
import { channelProducts, costOf, marginOf, NOT_READY, withNames } from "./view";

const LADDER = [{ capabilityId: "c", qtyMin: 1, qtyMax: null, sellGbpMinor: 1450, sellAudMinor: null, label: "Tier 1" }] as never;

describe("the channel cards (screen 24, decision 0155)", () => {
  it("are the prototype's six, in its order, and only Shopify and API or CSV are built", () => {
    expect(CHANNELS.map((card) => card.key)).toEqual(["shopify", "etsy", "tiktok", "team_store", "woocommerce", "api_csv"]);
    expect(CHANNELS.filter((card) => card.availability === "built").map((card) => card.key)).toEqual(TEAM_STORE_HREF === null ? ["shopify", "api_csv"] : ["shopify", "team_store", "api_csv"]);
    for (const card of CHANNELS.filter((one) => one.availability === "later")) expect(card.laterReason).toMatch(/\.$/);
    expect(channelCard("etsy").laterReason).toMatch(/later/);
  });
});

describe("the products a brand may sell", () => {
  it("show the production cost, the listing and why one cannot be listed", () => {
    const listing = { productId: "p1", priceMinor: 3500, currency: "GBP", pushedAt: "t" } as ListingRow;
    const shown = channelProducts(
      [
        { productId: "p1", name: "Home", stage: "run", sizes: ["M"], ladder: LADDER },
        { productId: "p2", name: "Draft", stage: "sample", sizes: ["M"], ladder: [] },
        { productId: "p3", name: "No sizes", stage: "run", sizes: [], ladder: [] },
      ],
      [listing, { ...listing, sizeLabel: "L" } as ListingRow],
      "GBP",
    );
    expect(shown[0]).toMatchObject({ unitCostMinor: 1450, costNote: "Tier 1", listing: { priceMinor: 3500, sizes: 2 }, blocked: null });
    expect(shown[1]).toMatchObject({ unitCostMinor: null, blocked: NOT_READY, listing: null });
    expect(shown[1]!.costNote).toMatch(/invoices/);
    expect(shown[2]!.blocked).toBe(NO_SIZES);
    expect(costOf(LADDER, "AUD").unitCostMinor).toBeNull();
  });

  it("work out profit and margin per piece only with a production price", () => {
    expect(marginOf(3500, 1450)).toEqual({ profitMinor: 2050, marginPercent: 58.6 });
    expect(marginOf(3500, null)).toBeNull();
    expect(marginOf(0, 100)).toBeNull();
  });

  it("name each order's product, or say it was removed", () => {
    const order = { productId: "gone" } as ChannelOrderRow;
    expect(withNames([order, { productId: "p1" } as ChannelOrderRow], [{ productId: "p1", name: "Home" }]).map((one) => one.productName)).toEqual(["A removed product", "Home"]);
  });
});

describe("the install's outcome", () => {
  it("is a known sentence or nothing: the address cannot write on the page", () => {
    expect(outcomeOf("connected")?.tone).toBe("ok");
    expect(outcomeOf("refused-state")?.text).toMatch(/nothing was connected/);
    expect(outcomeOf("<script>")).toBeNull();
    expect(outcomeOf(["connected"])).toBeNull();
    expect(outcomeOf(undefined)).toBeNull();
  });
});

describe("the /dev fixtures", () => {
  it("cover connecting, connected, not set up, a viewer and empty", () => {
    expect(Object.keys(PAGE_STATES)).toEqual(["available", "connected", "not-set-up", "viewer", "empty"]);
    expect(PAGE_STATES.viewer).toMatchObject({ canConnect: false, canList: false });
  });
});
