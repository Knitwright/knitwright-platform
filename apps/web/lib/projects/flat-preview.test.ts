import { describe, expect, it } from "vitest";
import { designWith, madeUpValues } from "@/lib/flat/fixtures/designs";
import { start } from "@/lib/garment/fixtures/specs";
import type { GarmentSpec } from "@/lib/garment";
import { MADE_UP_CHART_SET } from "@/lib/sizing/fixtures/made-up-charts";
import { flatPreview, missingSentence } from "./flat-preview";

const decode = (src: string): string => decodeURIComponent(src.slice(src.indexOf(",") + 1));

describe("missingSentence", () => {
  it("says nothing when nothing is missing", () => {
    expect(missingSentence([])).toBeNull();
  });

  it("names a few measurements in plain words and counts the rest", () => {
    expect(missingSentence(["Chest width"])).toBe("To draw this to scale, add this measurement: Chest width.");
    expect(missingSentence(["Chest width", "Body length"])).toBe(
      "To draw this to scale, add these measurements: Chest width and Body length.",
    );
    expect(missingSentence(["A", "B", "C"])).toBe("To draw this to scale, add these measurements: A, B and C.");
    expect(missingSentence(["A", "B", "C", "D", "E"])).toBe(
      "To draw this to scale, add these measurements: A, B, C and 2 more.",
    );
  });
});

describe("flatPreview", () => {
  it("shows the front and the back as images a page can show safely", () => {
    const preview = flatPreview(start("crew-tee"), new Map());
    expect(preview?.views.map((view) => view.label)).toEqual(["Front", "Back"]);
    for (const view of preview?.views ?? []) {
      expect(view.src.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
      expect(decode(view.src)).toContain("<svg");
      expect(view.alt).toMatch(/^(Front|Back) view\. Crew neck tee for women\./);
    }
  });

  it("marks a new design not to scale, in plain words, and says what is missing", () => {
    const preview = flatPreview(start("crew-tee"), new Map());
    expect(preview?.toScale).toBe(false);
    expect(preview?.notice).toBe("Not to scale. Some measurements are missing.");
    expect(preview?.missingSentence).toMatch(/^To draw this to scale, add these measurements: Chest width, /);
  });

  it("drops the mark when every measurement is present", () => {
    const preview = flatPreview(designWith("crew-tee", {}, madeUpValues({})), new Map());
    expect(preview?.toScale).toBe(true);
    expect(preview?.notice).toBeNull();
    expect(preview?.missingSentence).toBeNull();
  });

  it("draws a design with sizes for the base size, as the measurement table does", () => {
    const base = designWith("crew-tee", {}, madeUpValues({}));
    const sized: GarmentSpec = { ...base, sizing: { sizes: ["S", "M"], baseSize: "M" } };
    expect(flatPreview(sized, new Map())?.toScale).toBe(true);
  });

  it("uses the size chart when one applies, and does not invent values without one", () => {
    const women = designWith("crew-tee", {});
    const withChart = flatPreview({ ...women, sizing: { sizes: ["U1", "U2", "U3", "U4"], baseSize: "U2" } }, new Map(), MADE_UP_CHART_SET);
    expect(withChart?.views).toHaveLength(2);
    expect(flatPreview(women, new Map())?.toScale).toBe(false);
  });

  it("gives nothing for a garment type it cannot draw", () => {
    expect(flatPreview({ ...start("crew-tee"), typeId: "kilt" }, new Map())).toBeNull();
  });

  it("escapes what a person typed, so the image holds only text", () => {
    const base = designWith("crew-tee", {}, madeUpValues({}));
    const spec: GarmentSpec = {
      ...base,
      artwork: [
        {
          id: "t",
          name: "Words",
          source: { kind: "text", text: "</text><script>alert(1)</script>" },
          panelId: "body-front",
          anchor: "centre-chest",
          offsetX: 0,
          offsetY: 0,
          width: 800,
          height: 300,
          rotationDegrees: 0,
          technique: "screen-print",
          provenance: "user-edited",
        },
      ],
    };
    const svg = decode(flatPreview(spec, new Map())?.views[0]?.src ?? "");
    expect(svg).not.toContain("<script");
    expect(svg).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

describe("flatPreview and the colourway chosen", () => {
  it("draws the colourway asked for", () => {
    const base = designWith("crew-tee", {}, madeUpValues({}));
    const spec = {
      ...base,
      colourways: [
        base.colourways[0],
        { id: "away", name: "Away", colours: [{ panelId: "body-front", colour: "Red", swatch: "#aa0000", provenance: "user-edited" as const }] },
      ],
    } as GarmentSpec;
    const svg = (id?: string) => decode(flatPreview(spec, new Map(), undefined, null, id)?.views[0]?.src ?? "");
    expect(svg("away")).toContain('fill="#aa0000"');
    expect(svg()).not.toContain('fill="#aa0000"');
    expect(svg("nope")).not.toContain('fill="#aa0000"');
  });
});
