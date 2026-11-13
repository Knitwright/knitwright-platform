import { describe, expect, it } from "vitest";
import { sampleListing } from "./fixtures/samples";
import { blockersOf, canPublish, listingHealth, type HealthFacts } from "./health";
import { priceRows } from "./pricing";

const COST = { status: "priced" as const, unitMinor: 1820, label: "" };

const facts = (over: Partial<HealthFacts> = {}): HealthFacts => ({
  rows: priceRows(["S", "M"], { S: 4500, M: 4500 }, COST),
  stage: "run",
  hasRelease: true,
  productionClass: "A",
  euResponsiblePerson: "EU Rep GmbH, Berlin",
  storefrontLive: true,
  ...over,
});

const stateOf = (lines: ReturnType<typeof listingHealth>, id: string) => lines.find((line) => line.id === id)?.state;

describe("listing health", () => {
  it("is all ticks for a complete listing, and Publish is allowed", () => {
    const lines = listingHealth(sampleListing(), facts());
    expect(lines.every((line) => line.state === "ok")).toBe(true);
    expect(lines[0]!.label).toBe("2 mockups");
    expect(canPublish(lines)).toBe(true);
  });

  it("warns without stopping Publish: EU person, size table, storefront not live, cost unknown", () => {
    const lines = listingHealth(sampleListing({ showSizeTable: false }), facts({ euResponsiblePerson: null, storefrontLive: false, rows: priceRows(["S"], { S: 4500 }, { status: "unpriced", reason: "" }) }));
    expect(lines.filter((line) => line.state === "warn").map((line) => line.label)).toEqual([
      "Size table hidden",
      "EU responsible person missing",
      "Production cost not on file yet",
      "Your storefront is not live yet",
    ]);
    expect(canPublish(lines)).toBe(true);
  });

  it("stops Publish for each thing a sale needs, and says each", () => {
    const listing = sampleListing({ media: [], title: "", fabricKey: null });
    const lines = listingHealth(listing, facts({ stage: "sample", hasRelease: false, productionClass: "B", rows: priceRows(["S"], {}, COST) }));
    expect(canPublish(lines)).toBe(false);
    expect(blockersOf(lines)).toBe(
      "Add at least one mockup. Add a title and a description. Set a retail price for at least one size. Approve the golden sample before selling. Freeze a version for production first. Choose the fabric it is made in. Made to order is Class A only: sell it as a drop.",
    );
  });

  it("stops Publish when a size sells at or below cost; a drop may be Class B; other channels skip the storefront line", () => {
    expect(stateOf(listingHealth(sampleListing(), facts({ rows: priceRows(["S"], { S: 1000 }, COST) })), "prices")).toBe("block");
    const drop = listingHealth(sampleListing({ mode: "drop", channel: "shopify" }), facts({ productionClass: "B" }));
    expect(stateOf(drop, "class")).toBeUndefined();
    expect(stateOf(drop, "storefront")).toBeUndefined();
    expect(listingHealth(sampleListing({ media: [sampleListing().media[0]!] }), facts())[0]!.label).toBe("1 mockup");
  });
});
