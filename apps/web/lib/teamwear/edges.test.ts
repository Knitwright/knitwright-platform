import { describe, expect, it } from "vitest";
import { articleBook, shorts } from "./fixtures/kit";
import { parsePart, parseSaved, parseSport } from "./address";
import { articleOf, partOf, startingKit } from "./kit";
import { partPreview } from "./preview";
import { kitPrice, quantityFloor } from "./pricing";
import { MODEL_ROW, panelRows } from "./rows";
import { sportById } from "./vocabulary";

/**
 * The states the happy path does not reach: a catalogue read that came back short, a factory
 * minimum of nought, an article the build pack states no fit for, a garment the drawing code has no
 * template for, and an address that repeats a parameter. Each one has to say what it cannot do.
 */

const football = sportById("football");

describe("a catalogue read that came back short", () => {
  it("leaves a part with no article when the book does not hold the code the type names", () => {
    const shirt = partOf(football, "shirt")!;
    expect(shirt.articleCode).toBe("JSY-SS-01");
    expect(articleOf(shirt, new Map())).toBeNull();
  });

  it("starts the kit anyway, with an empty form, so the screen opens", () => {
    const kit = startingKit("football", new Map());
    expect(kit.parts.shirt?.form).toEqual({ options: {}, parameters: {} });
    const rows = panelRows(kit, partOf(football, "shirt")!, null, kit.parts.shirt!);
    expect(rows.map((row) => row.id)).toEqual([MODEL_ROW, "colours"]);
  });
});

describe("an article the build pack states no fit for", () => {
  it("says the fit is not stated rather than guessing one", () => {
    expect(shorts().fit).toBeNull();
    const kit = startingKit("football", articleBook());
    const row = panelRows(kit, partOf(football, "shorts")!, shorts(), kit.parts.shorts!).find((entry) => entry.id === MODEL_ROW)!;
    expect(row.value).toBe("SHO-TR-01 · fit not stated · Men");
  });
});

describe("a factory minimum of nought", () => {
  it("still starts the stepper at one piece, because nought pieces is not an order", () => {
    expect(quantityFloor({ ladder: [], moq: 0 })).toBe(1);
  });
});

describe("a part with no ladder at all", () => {
  it("has no discount badge, because there is nothing to measure a discount against", () => {
    const kit = startingKit("football", articleBook());
    const price = kitPrice(kit, () => ({ ladder: [], moq: null }), "GBP");
    expect(price.parts.every((part) => part.discount === null)).toBe(true);
  });
});

describe("a garment the drawing code has no template for", () => {
  it("says so, rather than putting a blank canvas on the stage", () => {
    const kit = startingKit("winter-code", articleBook());
    const preview = partPreview(kit, partOf(sportById("winter-code"), "shirt")!, kit.parts.shirt!, "men");
    if (preview.status === "drawn") {
      // The winter code top draws as a top; nothing to say.
      expect(preview.flat.views).toHaveLength(2);
      return;
    }
    expect(preview.reason.length).toBeGreaterThan(0);
  });
});

describe("an address with a repeated or a listed value", () => {
  it("takes the first of a list for the sport, the part and the saved design", () => {
    expect(parseSport({ sport: ["cricket", "football"] })).toBe("cricket");
    expect(parsePart({ part: ["socks", "shirt"] }, "football")).toBe("socks");
    expect(parseSaved({ project: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"], v: ["2", "3"] })).toEqual({
      projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      version: 2,
    });
  });

  it("has no saved design for an empty list", () => {
    expect(parseSaved({ project: [], v: [] })).toBeNull();
  });
});
