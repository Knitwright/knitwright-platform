import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { withKitStyle } from "@/lib/kit-styles/presets";
import { variantsFor } from "./apply";
import { variantTiles } from "./tiles";

describe("variant tiles", () => {
  it("draws one tile for each variant with a safe image address and the variant's warnings", () => {
    const out = withKitStyle(start("team-jersey", "men"), "stripes", { main: "#1b2a49", second: "#d4af37", third: null });
    if (!out.ok) throw new Error(out.reason);
    const variants = variantsFor(out.spec, "p", 1);
    const tiles = variantTiles(variants);
    expect(tiles).toHaveLength(variants.length);
    tiles.forEach((tile, i) => {
      expect(tile.id).toBe(variants[i].id);
      expect(tile.src).toMatch(/^data:image\/svg\+xml/);
      expect(tile.alt.startsWith(variants[i].label)).toBe(true);
      expect(tile.warnings).toEqual(variants[i].warnings);
    });
  });
});
