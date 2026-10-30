import { describe, expect, it } from "vitest";
import { priceFor } from "@/lib/factory/pricing";
import { articleBook, emptyBook, JERSEY_LADDER, testBook } from "./fixtures/kit";
import { startingKit, withPart } from "./kit";
import {
  baseUnitMinor,
  clampQuantity,
  discountBadge,
  kitPrice,
  NO_PRICE,
  QUANTITY_MAX,
  quantityFloor,
} from "./pricing";

const kitOf = (shirt: number, shorts: number, socks: number) => {
  let kit = startingKit("football", articleBook());
  kit = withPart(kit, "shirt", (choice) => ({ ...choice, quantity: shirt }));
  kit = withPart(kit, "shorts", (choice) => ({ ...choice, quantity: shorts }));
  return withPart(kit, "socks", (choice) => ({ ...choice, quantity: socks }));
};

describe("the quantity stepper", () => {
  it("starts no lower than the factory's own smallest order", () => {
    expect(quantityFloor({ ladder: JERSEY_LADDER, moq: 10 })).toBe(10);
  });

  it("starts at one where the factory has set no minimum, and for a part with no ladder at all", () => {
    expect(quantityFloor({ ladder: JERSEY_LADDER, moq: null })).toBe(1);
    expect(quantityFloor(null)).toBe(1);
  });

  it("cannot be taken below the floor or above the screen's limit, so an out-of-range quantity is unreachable", () => {
    expect(clampQuantity(3, 10)).toBe(10);
    expect(clampQuantity(QUANTITY_MAX + 1, 10)).toBe(QUANTITY_MAX);
    expect(clampQuantity(25, 10)).toBe(25);
  });

  it("rounds a part of a piece and falls back to the floor for text that is not a number", () => {
    expect(clampQuantity(20.4, 10)).toBe(20);
    expect(clampQuantity(Number.NaN, 10)).toBe(10);
  });
});

describe("the discount badge", () => {
  it("measures against the smallest tier that carries a price", () => {
    expect(baseUnitMinor(JERSEY_LADDER, "GBP")).toBe(2900);
  });

  it("has no base price where no tier carries one in the currency asked for", () => {
    expect(baseUnitMinor(JERSEY_LADDER, "AUD")).toBeNull();
    expect(discountBadge(JERSEY_LADDER, "AUD", 2500)).toBeNull();
  });

  it("reads −24% at the 50-piece tier, as the spec's own example does", () => {
    expect(discountBadge(JERSEY_LADDER, "GBP", 2200)).toBe("−24%");
  });

  it("shows nothing at the smallest tier, because there is no discount there", () => {
    expect(discountBadge(JERSEY_LADDER, "GBP", 2900)).toBeNull();
  });

  it("shows nothing for an empty ladder or a price dearer than the smallest tier", () => {
    expect(discountBadge([], "GBP", 2200)).toBeNull();
    expect(discountBadge(JERSEY_LADDER, "GBP", 3500)).toBeNull();
  });
});

describe("the price of a kit", () => {
  it("reads the tier across the basket, not at one part's quantity", () => {
    const price = kitPrice(kitOf(20, 20, 20), testBook(), "GBP");
    // Forty pieces are priced: the socks have no base article, so nothing is being ordered for them.
    expect(price.tierQty).toBe(40);
    expect(price.pieces).toBe(60);
    expect(price.parts.find((part) => part.partId === "shirt")?.unit).toBe("£25.00");
    expect(price.parts.find((part) => part.partId === "shirt")?.discount).toBe("−14%");
  });

  it("reaches the deepest tier once the basket is big enough, at the spec's own −24%", () => {
    const price = kitPrice(kitOf(30, 30, 30), testBook(), "GBP");
    expect(price.tierQty).toBe(60);
    expect(price.parts.find((part) => part.partId === "shirt")?.unit).toBe("£22.00");
    expect(price.parts.find((part) => part.partId === "shirt")?.discount).toBe("−24%");
  });

  it("agrees to the penny with priceFor on the same basket", () => {
    const price = kitPrice(kitOf(20, 20, 20), testBook(), "GBP");
    const shirt = priceFor(JERSEY_LADDER, 20, "GBP", 40);
    expect(shirt).toMatchObject({ status: "priced", unitMinor: 2500, lineMinor: 50_000 });
    expect(price.parts.find((part) => part.partId === "shirt")?.line).toBe("£500.00");
    expect(price.totalMinor).toBe(50_000 + 24_000);
    expect(price.total).toBe("£740.00");
  });

  it("leaves a part with no base article out of the total and says which part that is", () => {
    const price = kitPrice(kitOf(20, 20, 20), testBook(), "GBP");
    const socks = price.parts.find((part) => part.partId === "socks");
    expect(socks?.priced).toBe(false);
    expect(socks?.unit).toBe(NO_PRICE);
    expect(socks?.reason).toMatch(/no base article/);
    expect(price.everyPartPriced).toBe(false);
    expect(price.totalNote).toBe("The total leaves out Socks, which has no price yet.");
  });

  it("names both parts where two of them have no price", () => {
    const price = kitPrice(kitOf(20, 20, 20), emptyBook(), "GBP");
    expect(price.totalNote).toBe("The total leaves out Shirt and Shorts and Socks, which have no price yet.");
    expect(price.totalMinor).toBeNull();
    expect(price.total).toBe(NO_PRICE);
    expect(price.priced).toBe(false);
  });

  it("says why a quantity below every tier has no price, rather than making one up", () => {
    const price = kitPrice(kitOf(1, 1, 1), testBook(1), "GBP");
    expect(price.parts.find((part) => part.partId === "shirt")?.reason).toMatch(/No tier covers 2 pieces/);
    expect(price.totalMinor).toBeNull();
  });

  it("says why there is no price in a currency nobody set, rather than showing the other one", () => {
    const price = kitPrice(kitOf(20, 20, 20), testBook(), "AUD");
    expect(price.parts.find((part) => part.partId === "shirt")?.reason).toMatch(/No AUD price is set/);
  });

  it("carries the stored label of the tier, so no screen can show it as a factory quote", () => {
    const price = kitPrice(kitOf(20, 20, 20), testBook(), "GBP");
    expect(price.parts.find((part) => part.partId === "shirt")?.tierLabel).toBe("Test row, not a factory quote");
  });

  it("carries the factory the prices came from", () => {
    expect(kitPrice(kitOf(20, 20, 20), testBook(), "GBP", "Sialkot partner").factoryName).toBe("Sialkot partner");
    expect(kitPrice(kitOf(20, 20, 20), testBook(), "GBP").factoryName).toBeNull();
  });

  it("keeps the line in integer minor units, so money never comes back out of the words", () => {
    const price = kitPrice(kitOf(20, 20, 20), testBook(), "GBP");
    expect(price.parts.find((part) => part.partId === "shirt")?.lineMinor).toBe(50_000);
    expect(price.parts.find((part) => part.partId === "socks")?.lineMinor).toBeNull();
  });

  it("gives every part the floor its own factory minimum sets", () => {
    const price = kitPrice(kitOf(20, 20, 20), testBook(25), "GBP");
    expect(price.parts.map((part) => part.floor)).toEqual([25, 25, 1]);
  });

  it("has no total for a sport with one part and no ladder", () => {
    const price = kitPrice(startingKit("winter-code", articleBook()), emptyBook(), "GBP");
    expect(price.parts).toHaveLength(1);
    expect(price.totalMinor).toBeNull();
  });
});
