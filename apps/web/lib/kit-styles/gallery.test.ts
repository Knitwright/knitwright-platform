import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { applyKitStyleSchema, galleryAddress, kitStyleTiles } from "./gallery";
import { DEFAULT_CLUB_COLOURS } from "./presets";

const PROJECT = "7c3e4c38-5f6a-4c55-9a4d-5b1f0b0f2a11";

describe("the kit style gallery", () => {
  it("has one tile for each style the garment offers, each a small drawing in the club's colours", () => {
    const tiles = kitStyleTiles(start("team-jersey"), DEFAULT_CLUB_COLOURS);
    expect(tiles.map((tile) => tile.id)).toEqual(["plain", "hoops", "stripes", "pinstripes", "sash", "side-panels", "chest-band", "fade"]);
    for (const tile of tiles) {
      expect(tile.src.startsWith("data:image/svg+xml")).toBe(true);
      expect(decodeURIComponent(tile.src)).toContain(DEFAULT_CLUB_COLOURS.main);
      expect(tile.alt.length).toBeGreaterThan(0);
    }
    expect(decodeURIComponent(tiles[1]?.src ?? "")).toContain("Kit pattern: Hoops");
    expect(decodeURIComponent(tiles[0]?.src ?? "")).not.toContain("Kit pattern");
  });

  it("marks the style the design has now", () => {
    const tiles = kitStyleTiles({ ...start("polo"), kitPattern: { style: "hoops", colours: [{ colour: "Gold" }], provenance: "user-edited" } }, DEFAULT_CLUB_COLOURS);
    expect(tiles.filter((tile) => tile.current).map((tile) => tile.id)).toEqual(["hoops"]);
    expect(kitStyleTiles(start("polo"), DEFAULT_CLUB_COLOURS).find((tile) => tile.current)?.id).toBe("plain");
  });

  it("has no tiles for a garment with no kit styles", () => {
    expect(kitStyleTiles(start("joggers"), DEFAULT_CLUB_COLOURS)).toEqual([]);
  });

  it("goes back to the guide or the editor", () => {
    expect(galleryAddress(PROJECT, "guide")).toBe(`/studio/${PROJECT}/kit-styles?from=guide`);
    expect(galleryAddress(PROJECT, "editor")).toBe(`/studio/${PROJECT}/kit-styles?from=editor`);
  });
});

describe("the request to apply a kit style", () => {
  const good = { projectId: PROJECT, expectedVersion: "3", styleId: "hoops", main: "#1b2a49", second: "#d4af37", third: "", from: "guide" };

  it("reads a form, with an empty third colour as none", () => {
    expect(applyKitStyleSchema.parse(good)).toEqual({ ...good, expectedVersion: 3, third: null });
    expect(applyKitStyleSchema.parse({ ...good, third: "#ffffff" }).third).toBe("#ffffff");
  });

  it("refuses colours that are not colours, an unknown style and an unknown return place", () => {
    expect(applyKitStyleSchema.safeParse({ ...good, main: "red" }).success).toBe(false);
    expect(applyKitStyleSchema.safeParse({ ...good, styleId: "tartan" }).success).toBe(false);
    expect(applyKitStyleSchema.safeParse({ ...good, from: "elsewhere" }).success).toBe(false);
    expect(applyKitStyleSchema.safeParse({ ...good, projectId: "x" }).success).toBe(false);
  });
});
