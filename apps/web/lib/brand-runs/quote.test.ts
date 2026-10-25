import { describe, expect, it } from "vitest";
import { quoteFor, WILL_QUOTE } from "./quote";

const LADDER = { status: "set", value: [{ fromPieces: 100, unitPrice: 20 }, { fromPieces: 10, unitPrice: 30 }, { fromPieces: 200, unitPrice: 15 }] } as const;

describe("quoteFor", () => {
  it("says Knitwright will quote when no ladder is set", () => {
    expect(quoteFor(120, { status: "not-set" })).toEqual({ status: "not-set", text: WILL_QUOTE });
    expect(WILL_QUOTE).toBe("Knitwright will quote");
  });
  it("takes the last step at or below the quantity, whatever the order of the steps", () => {
    expect(quoteFor(100, LADDER)).toMatchObject({ status: "quoted", fromPieces: 100, unitPrice: 20 });
    expect(quoteFor(150, LADDER)).toMatchObject({ unitPrice: 20 });
    expect(quoteFor(250, LADDER)).toMatchObject({ unitPrice: 15 });
    expect(quoteFor(10, LADDER)).toMatchObject({ unitPrice: 30 });
  });
  it("does not price a quantity under the first step", () => {
    expect(quoteFor(9, LADDER).status).toBe("not-set");
  });
  it("names no currency", () => {
    expect(quoteFor(100, LADDER).text).not.toMatch(/[$£€]|USD|GBP|EUR/);
  });
});
