import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import type { GarmentSpec } from "@/lib/garment";
import { NEUTRAL_FILL, colourwayFor, panelFill, safeColour } from "./colour";

const withColours = (colours: GarmentSpec["colourways"][number]["colours"]): GarmentSpec => {
  const spec = start("crew-tee");
  return { ...spec, colourways: [{ ...spec.colourways[0], colours }, { id: "away", name: "Away", colours: [{ panelId: "body-front", colour: "Red", swatch: "#aa0000", provenance: "user-edited" }] }] };
};

describe("safeColour", () => {
  it("passes a colour written #rrggbb and refuses everything else", () => {
    expect(safeColour("#1b2a49")).toBe("#1b2a49");
    for (const bad of ["red", "#FFF", "url(#a)", "#1b2a49; x", '#1b2a49"', undefined, null]) {
      expect(safeColour(bad)).toBeNull();
    }
  });
});

describe("colourwayFor", () => {
  it("finds a colourway by id and falls back to the first", () => {
    const spec = withColours([]);
    expect(colourwayFor(spec, "away").id).toBe("away");
    expect(colourwayFor(spec, "nope").id).toBe("main");
  });
});

describe("panelFill", () => {
  it("uses the swatch of the panel in the chosen colourway", () => {
    const spec = withColours([{ panelId: "body-front", colour: "Navy", swatch: "#1b2a49", provenance: "user-edited" }]);
    expect(panelFill(spec, "main", "body-front")).toBe("#1b2a49");
    expect(panelFill(spec, "away", "body-front")).toBe("#aa0000");
  });

  it("draws a panel with no swatch, or no entry, in neutral light grey", () => {
    const spec = withColours([{ panelId: "body-back", colour: "PANTONE 19-4052", provenance: "user-edited" }]);
    expect(panelFill(spec, "main", "body-back")).toBe(NEUTRAL_FILL);
    expect(panelFill(spec, "main", "body-front")).toBe(NEUTRAL_FILL);
    expect(NEUTRAL_FILL).toMatch(/^#[0-9a-f]{6}$/);
  });
});
