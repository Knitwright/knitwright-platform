import { describe, expect, it } from "vitest";
import { fakeFactoryStore } from "@/lib/factory/fixtures/fake-store";
import { EMPTY_BOOK, priceBookOf } from "./book";
import { fromPrice } from "./price";

/**
 * Decision 0074: the catalogue's price book over X6's in-memory store (decision 0071). It reads the
 * ladder and the smallest order of the articles the factory makes, and comes back empty rather than
 * failing when the tables cannot be read — a catalogue that cannot read a price still opens, and
 * says no price is set.
 */

describe("the price book", () => {
  it("reads the ladder, the minimum order and the lead time of an article the factory makes", async () => {
    const book = await priceBookOf(fakeFactoryStore());
    expect(book.factoryName).toBe("Sialkot partner (placeholder)");
    expect(book.source("JSY-SS-01").moq).toBe(1);
    expect(book.source("JSY-SS-01").ladder.map((tier) => tier.qtyMin).sort((a, b) => a - b)).toEqual([10, 20, 50]);
    expect(book.capability("JSY-SS-01")?.leadTimeDays).toBe(8);
    expect(fromPrice(book.source("JSY-SS-01"), "GBP").amount).toBe("From £22.00");
  });

  it("has no ladder and no capability for an article the factory does not make", async () => {
    const book = await priceBookOf(fakeFactoryStore());
    expect(book.source("HOD-ST-01")).toEqual({ ladder: [], moq: null });
    expect(book.capability("HOD-ST-01")).toBeUndefined();
  });

  it("carries the fabric programme and its stock colours for the spec cards", async () => {
    const book = await priceBookOf(fakeFactoryStore());
    expect(book.fabrics.map((fabric) => fabric.code)).toContain("F-POLY-INT");
    expect(book.colours.every((colour) => colour.fabricCode.startsWith("F-"))).toBe(true);
  });

  it("comes back empty when there is no factory on file", async () => {
    const book = await priceBookOf(fakeFactoryStore({ factories: [] }));
    expect(book).toBe(EMPTY_BOOK);
    expect(fromPrice(book.source("JSY-SS-01"), "GBP").line).toBe("No GBP price is set yet");
  });

  it("comes back empty, not broken, when the tables cannot be read", async () => {
    const store = fakeFactoryStore();
    const book = await priceBookOf({ ...store, listFactories: async () => { throw new Error("database down"); } });
    expect(book).toBe(EMPTY_BOOK);
    expect(book.factoryName).toBeNull();
  });
});
