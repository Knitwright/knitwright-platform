import { describe, expect, it } from "vitest";
import { panelsFor, type GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { buildFlat, visiblePanels } from "./build";
import { designWith, madeUpForType, madeUpValues, typedIn } from "./fixtures/designs";
import { LAYERS, NOT_TO_SCALE_MISFIT, NOT_TO_SCALE_MISSING, type FlatModel, type FlatPath } from "./model";

const build = (
  spec: ReturnType<typeof designWith>,
  view: "front" | "back" = "front",
  extra: { callouts?: boolean; colourwayId?: string } = {},
): FlatModel => {
  const model = buildFlat({ spec, measurements: typedIn(spec), view, colourwayId: extra.colourwayId ?? "main", callouts: extra.callouts });
  if (!model) throw new Error("No drawing.");
  return model;
};

const layer = (model: FlatModel, id: string) => model.layers.find((entry) => entry.id === id);
const panelPaths = (model: FlatModel): FlatPath[] =>
  (layer(model, "panels")?.elements ?? []).filter((element): element is FlatPath => element.kind === "path");

describe("a new design with no measurements", () => {
  const model = build(start("crew-tee"));

  it("is drawn from proportions, marked not to scale, and says so in plain words", () => {
    expect(model.toScale).toBe(false);
    expect(model.notice).toBe(NOT_TO_SCALE_MISSING);
    expect(model.missing.map((point) => point.pointId)).toContain("chest-width");
    expect(model.missing.map((point) => point.label)).toContain("Chest width");
    expect(panelPaths(model).length).toBeGreaterThan(3);
  });

  it("carries no measurement callouts, even when they are asked for", () => {
    const withCallouts = build(start("crew-tee"), "front", { callouts: true });
    expect(layer(withCallouts, LAYERS.measurements.id)).toBeUndefined();
    const texts = withCallouts.layers.flatMap((entry) => entry.elements).filter((element) => element.kind === "text");
    expect(texts).toEqual([]);
  });
});

describe("a design with every measurement", () => {
  const spec = designWith("crew-tee", {}, madeUpValues({}));

  it("is drawn to scale, with no notice and nothing missing", () => {
    const model = build(spec);
    expect(model.toScale).toBe(true);
    expect(model.notice).toBeNull();
    expect(model.missing).toEqual([]);
    expect(model.problems).toEqual([]);
  });

  it("has the named layers in drawing order, and adds callouts only on request", () => {
    expect(build(spec).layers.map((entry) => entry.id)).toEqual(["panels", "seams", "stitching", "details", "artwork"]);
    expect(build(spec, "front", { callouts: true }).layers.map((entry) => entry.id)).toEqual([
      "panels",
      "seams",
      "stitching",
      "details",
      "artwork",
      "measurements",
    ]);
    expect(Object.values(LAYERS).map((entry) => entry.label)).toEqual([
      "Panels",
      "Seams",
      "Stitching",
      "Details",
      "Artwork",
      "Measurements",
    ]);
  });

  it("gives each callout a line and a label showing the value in centimetres", () => {
    const model = build(spec, "front", { callouts: true });
    const callouts = layer(model, "measurements")?.elements ?? [];
    const labels = callouts.flatMap((element) => (element.kind === "text" ? [element.text] : []));
    expect(labels).toContain("Chest width 52.0 cm");
    expect(labels).toContain("Body length 70.0 cm");
    expect(callouts.filter((element) => element.kind === "path").length).toBe(labels.length);
  });

  it("names every panel in plain words from the registry", () => {
    const names = panelPaths(build(spec)).map((path) => path.name);
    expect(names).toContain("Body front");
    expect(names).toContain("Neckband");
  });

  it("names the artwork in the description: what it is, on which part and where", () => {
    const base = designWith("crew-tee", {}, madeUpValues({}));
    const spec: GarmentSpec = {
      ...base,
      artwork: [{ id: "a", name: "Club badge", source: { kind: "text", text: "HI" }, panelId: "body-front", anchor: "left-chest", offsetX: 0, offsetY: 0, width: 500, height: 200, rotationDegrees: 0, technique: "screen-print", provenance: "user-edited" }],
    };
    expect(build(spec).description).toContain("Artwork: Club badge on Body front, Left chest, the wearer's left.");
    expect(build(spec, "back").description).not.toContain("Club badge");
  });

  it("describes the drawing in words from the registry", () => {
    const model = build(spec);
    expect(model.description).toMatch(/^Front view\. Crew neck tee for women\./);
    expect(model.description).toContain("Neckline: Round neck.");
    expect(model.description).toContain("Sleeve length: Short sleeve.");
    expect(build(spec, "back").description).toMatch(/^Back view/);
  });
});

describe("measurements that cannot be drawn together", () => {
  it("falls back to proportions and says the measurements do not fit", () => {
    const values = { ...madeUpValues({}), "neck-width": 6000 };
    const spec = designWith("crew-tee", {}, values);
    const model = build(spec);
    expect(model.toScale).toBe(false);
    expect(model.notice).toBe(NOT_TO_SCALE_MISFIT);
    expect(model.problems.length).toBeGreaterThan(0);
    expect(model.missing).toEqual([]);
  });
});

describe("which panels a view draws", () => {
  it("draws the body of the view, and never the placket on the back", () => {
    const ids = ["body-front", "body-back", "sleeve-left", "placket", "collar"];
    expect(visiblePanels("front", ids)).toEqual(["body-front", "sleeve-left", "placket", "collar"]);
    expect(visiblePanels("back", ids)).toEqual(["body-back", "sleeve-left", "collar"]);
  });

  it("draws exactly the panels the registry says the design has", () => {
    const spec = designWith("team-jersey", { placket: "zip", "side-panels": "contrast-insert", cuffs: "rib-cuff" }, madeUpValues({}));
    for (const view of ["front", "back"] as const) {
      const wanted = visiblePanels(view, panelsFor(spec).map((panel) => panel.id));
      const drawn = panelPaths(build(spec, view)).filter((path) => path.panelId !== null);
      expect(drawn.map((path) => path.panelId)).toEqual(expect.arrayContaining(wanted));
      expect(drawn).toHaveLength(wanted.length);
    }
  });
});

describe("colour", () => {
  it("fills a panel with its swatch and the rest with neutral grey", () => {
    const base = designWith("crew-tee", {}, madeUpValues({}));
    const spec = {
      ...base,
      colourways: [
        {
          ...base.colourways[0],
          colours: [{ panelId: "body-front", colour: "Navy", swatch: "#1b2a49", provenance: "user-edited" as const }],
        },
      ] as typeof base.colourways,
    };
    const fills = Object.fromEntries(panelPaths(build(spec)).map((path) => [path.panelId, path.fill]));
    expect(fills["body-front"]).toBe("#1b2a49");
    expect(fills["neckband"]).toBe("#e5e7eb");
  });
});

describe("a type the drawing does not know", () => {
  it("gives no drawing", () => {
    const spec = { ...start("crew-tee"), typeId: "kilt" };
    expect(buildFlat({ spec, measurements: typedIn(spec), view: "front", colourwayId: "main" })).toBeNull();
  });
});

describe("the description and a colour that has no code", () => {
  it("names a colour by its code, or by its screen colour when there is no code", () => {
    const base = designWith("crew-tee", {}, madeUpValues({}));
    const spec = {
      ...base,
      colourways: [
        {
          ...base.colourways[0],
          colours: [
            { panelId: "body-front", colour: "", swatch: "#1b2a49", provenance: "user-edited" as const },
            { panelId: "body-back", colour: "Navy 19-4052", swatch: "#1b2a49", provenance: "user-edited" as const },
          ],
        },
      ],
    } as GarmentSpec;
    expect(build(spec).description).toContain("Colours: Body front #1b2a49, Body back Navy 19-4052.");
  });
});

describe("callouts on the back", () => {
  it("show the measurements the back shows, with the back neck drop and without the front's or the placket's", () => {
    const choices = { collar: "polo-collar", placket: "buttons" };
    const spec = designWith("polo", choices, madeUpForType("polo", choices));
    const model = build(spec, "back", { callouts: true });
    const labels = (model.layers.find((layer) => layer.id === "measurements")?.elements ?? []).flatMap((e) => (e.kind === "text" ? [e.text] : []));
    expect(labels).toContain("Back neck drop 2.0 cm");
    expect(labels).toContain("Chest width 52.0 cm");
    expect(labels.some((text) => text.startsWith("Front neck drop"))).toBe(false);
    expect(labels.some((text) => text.startsWith("Placket"))).toBe(false);
    const paths = model.layers.find((layer) => layer.id === "measurements")?.elements.filter((e) => e.kind === "path") ?? [];
    expect(paths).toHaveLength(labels.length);
  });
});
