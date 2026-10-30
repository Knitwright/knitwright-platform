import { describe, expect, it } from "vitest";
import { articleBook, emptyBook, testBook } from "./fixtures/kit";
import { handoffFor, handoffReference, HANDOFF_LABEL, HANDOFF_NOTE, PRICE_FIRST, SAVE_FIRST } from "./handoff";
import { startingKit, withPart } from "./kit";
import { kitPrice } from "./pricing";

const SAVED = { projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", version: 3 };

/**
 * A football kit whose every part is priced. The socks have no base article, so a club that wants a
 * hand-off takes them out of the kit; `kitParts` then lists the two parts that are left.
 */
const pricedKit = () => {
  const kit = startingKit("football", articleBook());
  const parts = Object.fromEntries(Object.entries(kit.parts).filter(([id]) => id !== "socks"));
  return { ...kit, parts };
};

describe("the Store hand-off", () => {
  it("is a hand-off and never an Add to cart, and says who takes the money", () => {
    expect(HANDOFF_LABEL).toBe("Order through the Knitwright Store");
    expect(HANDOFF_LABEL.toLowerCase()).not.toContain("cart");
    expect(HANDOFF_NOTE).toMatch(/does not take payment here/);
  });

  it("waits for a saved design, because the Store is handed a version and not a screen", () => {
    const kit = startingKit("football", articleBook());
    expect(handoffFor(kit, null, kitPrice(kit, testBook(), "GBP"))).toEqual({ ok: false, reason: SAVE_FIRST });
  });

  it("waits until something in the kit has a price", () => {
    const kit = startingKit("football", articleBook());
    expect(handoffFor(kit, SAVED, kitPrice(kit, emptyBook(), "GBP"))).toEqual({ ok: false, reason: PRICE_FIRST });
  });

  it("leaves a part the factory has no price for out of the lines, and names it", () => {
    const kit = startingKit("football", articleBook());
    const outcome = handoffFor(kit, SAVED, kitPrice(kit, testBook(), "GBP"));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.handoff.lines.map((line) => line.label)).toEqual(["Shirt", "Shorts"]);
    expect(outcome.handoff.omitted).toEqual(["Socks"]);
  });

  it("carries the saved version, the quantities, the currency and the total in integer minor units", () => {
    const kit = pricedKit();
    const price = kitPrice(kit, testBook(), "GBP");
    const outcome = handoffFor(kit, SAVED, price);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.handoff).toEqual({
      projectId: SAVED.projectId,
      version: 3,
      sportId: "football",
      lines: [
        { articleCode: "JSY-SS-01", quantity: 20, label: "Shirt" },
        { articleCode: "SHO-TR-01", quantity: 20, label: "Shorts" },
      ],
      currency: "GBP",
      totalMinor: price.totalMinor,
      tierQty: 40,
      omitted: [],
      ruleId: "R-GAP-000",
    });
    expect(Number.isInteger(outcome.handoff.totalMinor)).toBe(true);
  });

  it("carries the tier the price was read at, so the Store can check it against the same tier", () => {
    const kit = withPart(pricedKit(), "shirt", (choice) => ({ ...choice, quantity: 40 }));
    const outcome = handoffFor(kit, SAVED, kitPrice(kit, testBook(), "GBP"));
    expect(outcome.ok && outcome.handoff.tierQty).toBe(60);
  });

  it("gives a reference a club can read out, because there is no Store address yet", () => {
    const outcome = handoffFor(pricedKit(), SAVED, kitPrice(pricedKit(), testBook(), "GBP"));
    expect(outcome.ok && handoffReference(outcome.handoff)).toBe(`${SAVED.projectId}@v3`);
  });
});
