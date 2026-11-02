import { describe, expect, it } from "vitest";
import { canExportDrop, DROP_PAYLOAD_VERSION, dropFindings, dropPayload } from "./drop";
import { dropPayloadSchema } from "./schemas";
import { ids, plan, pricing, style } from "./fixtures/plan";
import { SELL_THROUGH } from "./vocabulary";

/**
 * Decision 0085: "Create drop" exports a payload for the Store and nothing else (owner decision 1).
 *
 * The last test in this file is the one that matters most: a payload may not carry a Store concept.
 * No cart, no checkout, no payment, no storefront, no payout, in any key or any sentence. If a later
 * change puts one in, this test fails rather than the platform quietly growing a shop.
 */

const AT = new Date("2026-11-20T12:00:00Z");

describe("the drop payload", () => {
  it("names the plan, the destination, the currency and when it was made", () => {
    const payload = dropPayload(plan(), pricing(), AT);
    expect(payload).toMatchObject({
      kind: "collection-drop",
      payloadVersion: DROP_PAYLOAD_VERSION,
      collectionId: ids.collection,
      collectionName: "Spring drop",
      destinationCountry: "GB",
      currency: "GBP",
      generatedAt: "2026-11-20T12:00:00.000Z",
    });
  });

  it("carries every style with its sizes as targets, not as an order", () => {
    const payload = dropPayload(plan(), pricing(), AT);
    const navy = payload.styles.find((one) => one.styleId === ids.navy)!;
    expect(navy).toMatchObject({ name: "Matchday jersey", colourway: "Navy", status: "approved", group: "Core", targetUnits: 30 });
    expect(navy.sizes).toEqual([
      { size: "S", targetQty: 10 },
      { size: "M", targetQty: 20 },
    ]);
    expect(payload.handover).toContain("targets, not orders");
  });

  it("leaves a size planned at zero out of the targets", () => {
    const one = plan({ styles: [style({ sizes: [{ label: "S", qty: 0 }, { label: "M", qty: 4 }] })] });
    expect(dropPayload(one, pricing(one), AT).styles[0]!.sizes).toEqual([{ size: "M", targetQty: 4 }]);
  });

  it("carries the landed unit cost and the margin the plan showed, or null where there was none", () => {
    const payload = dropPayload(plan(), pricing(), AT);
    expect(payload.styles.find((one) => one.styleId === ids.navy)).toMatchObject({ unitCostMinor: 2934 });
    expect(payload.styles.find((one) => one.styleId === ids.tee)).toMatchObject({ unitCostMinor: null, marginBp: null });
  });

  it("carries the range's counters, the sell-through assumption and where the figures came from", () => {
    const payload = dropPayload(plan(), pricing(), AT);
    expect(payload.totals).toMatchObject({ styles: 2, colourways: 3, skus: 4, targetUnits: 45 });
    expect(payload.assumes).toBe(SELL_THROUGH);
    expect(payload.labels).toContain("Test freight row, not a carrier quote");
    expect(payload.notes).toContain("No price is on file for this style's article yet.");
  });

  it("is the shape the database is given, every time", () => {
    const one = plan({ styles: plan().styles.filter((card) => card.articleCode !== null) });
    expect(dropPayloadSchema.safeParse(dropPayload(one, pricing(one), AT)).success).toBe(true);
    expect(dropPayloadSchema.safeParse(dropPayload(plan(), pricing(), AT)).success).toBe(true);
  });
});

describe("what stops a drop", () => {
  it("refuses a plan with no styles", () => {
    const findings = dropFindings(plan({ styles: [] }));
    expect(findings.map((found) => found.code)).toEqual(["drop_no_styles"]);
    expect(canExportDrop(findings)).toBe(false);
  });

  it("refuses a plan where nothing is planned", () => {
    const findings = dropFindings(plan({ styles: [style({ sizes: [] })] }));
    expect(findings.map((found) => found.code)).toContain("drop_no_units");
    expect(canExportDrop(findings)).toBe(false);
  });

  it("warns about drafts and missing retail prices but still lets the drop out", () => {
    const findings = dropFindings(plan());
    expect(findings.map((found) => found.code)).toEqual(["drop_draft_styles"]);
    expect(canExportDrop(findings)).toBe(true);
  });

  it("warns where a style has no RRP, and carries a rule id on every finding", () => {
    const one = plan({ styles: [style({ rrpMinor: null })] });
    const findings = dropFindings(one);
    expect(findings.map((found) => found.code)).toEqual(["drop_no_rrp"]);
    for (const found of dropFindings(plan())) expect(found.ruleId).toMatch(/^R-[A-Z]+-\d{3}$/);
  });
});

describe("the platform is not a shop", () => {
  const STORE_WORDS = /cart|checkout|stripe|payment|pay\b|paid|payout|storefront|shopify|basket|invoice|card\b/i;

  it("has no key and no sentence in a payload that names a Store concept", () => {
    const payload = dropPayload(plan(), pricing(), AT);
    const text = JSON.stringify(payload);
    expect(text).not.toMatch(STORE_WORDS);
    const keys = (value: unknown): string[] =>
      typeof value !== "object" || value === null
        ? []
        : Array.isArray(value)
          ? value.flatMap(keys)
          : Object.entries(value).flatMap(([key, inner]) => [key, ...keys(inner)]);
    expect(keys(payload).filter((key) => STORE_WORDS.test(key))).toEqual([]);
  });
});
