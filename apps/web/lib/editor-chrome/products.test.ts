import { describe, expect, it } from "vitest";
import { EMPTY_SHELF, loadShelf, shelfMatches, sportChips, type ProductsShelf } from "./products";

const shelf: ProductsShelf = {
  designs: [
    { id: "d1", name: "Home kit v7" },
    { id: "d2", name: "Away kit v2" },
  ],
  bases: [
    { code: "JSY-SS-01", name: "Short-sleeve jersey", sportTags: ["football", "rugby"] },
    { code: "CRK-SS-01", name: "Cricket shirt", sportTags: ["cricket"] },
    { code: "SHT-01", name: "Shorts", sportTags: ["football"] },
  ],
};

describe("the Products flyout's shelves", () => {
  it("offers each sport once, in order, up to a limit", () => {
    expect(sportChips(shelf.bases ?? [])).toEqual(["football", "rugby", "cricket"]);
    expect(sportChips(shelf.bases ?? [], 2)).toEqual(["football", "rugby"]);
  });

  it("narrows by name or code, and the bases by sport", () => {
    expect(shelfMatches(shelf, "home", null).designs?.map((d) => d.id)).toEqual(["d1"]);
    expect(shelfMatches(shelf, " jsy ", null).bases?.map((b) => b.code)).toEqual(["JSY-SS-01"]);
    expect(shelfMatches(shelf, "", "football").bases?.map((b) => b.code)).toEqual(["JSY-SS-01", "SHT-01"]);
    expect(shelfMatches(shelf, "", "football").designs?.length).toBe(2);
  });

  it("reads each shelf on its own, keeping only what the flyout shows", async () => {
    const fail = async (): Promise<never> => {
      throw new Error("down");
    };
    expect(await loadShelf(async () => [{ id: "d1", name: "Home", extra: 1 } as never], fail)).toEqual({ designs: [{ id: "d1", name: "Home" }], bases: null });
    expect(await loadShelf(fail, async () => [{ code: "JSY-SS-01", name: "Jersey", sportTags: ["football"], status: "live" } as never])).toEqual({
      designs: null,
      bases: [{ code: "JSY-SS-01", name: "Jersey", sportTags: ["football"] }],
    });
  });

  it("keeps a list that could not be read as unread", () => {
    expect(shelfMatches({ designs: null, bases: null }, "x", "rugby")).toEqual({ designs: null, bases: null });
    expect(shelfMatches(EMPTY_SHELF, "", null)).toEqual(EMPTY_SHELF);
  });
});
