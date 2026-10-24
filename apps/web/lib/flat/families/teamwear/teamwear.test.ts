import { describe, expect, it } from "vitest";
import { buildFlat } from "../../build";
import { designWith, typedIn } from "../../fixtures/designs";
import { madeUpFamilyValues } from "../../fixtures/family-designs";
import type { FlatModel, FlatPath, View } from "../../model";
import { renderSvg } from "../../render-svg";
import { FAMILY_DRAWERS, FAMILY_PROPORTIONS } from "../index";

const draw = (typeId: string, choices: Record<string, string>, view: View, sized = true, values?: Record<string, number>): FlatModel => {
  const spec = designWith(typeId, choices, sized ? (values ?? madeUpFamilyValues(typeId, choices)) : undefined);
  const model = buildFlat({ spec, measurements: typedIn(spec), view, colourwayId: "main" });
  if (!model) throw new Error(`No drawing for ${typeId}.`);
  return model;
};

const layer = (model: FlatModel, id: string) => model.layers.find((entry) => entry.id === id)?.elements ?? [];
const panelIds = (model: FlatModel): string[] =>
  layer(model, "panels").flatMap((element) => (element.kind === "path" && element.panelId ? [element.panelId] : []));
const widthOf = (model: FlatModel): number => model.bounds.maxX - model.bounds.minX;
const heightOf = (model: FlatModel): number => model.bounds.maxY - model.bounds.minY;

describe("registration", () => {
  it("gives every sport family a drawer and proportions", () => {
    for (const family of ["football", "cricket", "winter-code"] as const) {
      expect(FAMILY_DRAWERS[family], family).toBeDefined();
      expect(FAMILY_PROPORTIONS[family], family).toBeDefined();
    }
  });
});

describe("shirts and shorts reuse the tops and bottoms drawings", () => {
  it("draws a football shirt exactly as the team jersey with the same choices", () => {
    for (const view of ["front", "back"] as const) {
      const shirt = draw("football-shirt", {}, view);
      const jersey = draw("team-jersey", {}, view, true, madeUpFamilyValues("football-shirt", {}));
      expect(layer(shirt, "panels")).toEqual(layer(jersey, "panels"));
      expect(shirt.outline).toEqual(jersey.outline);
    }
  });

  it("draws football shorts exactly as shorts with the same choices", () => {
    const own = draw("football-shorts", {}, "front");
    const shorts = draw("shorts", { pockets: "none" }, "front");
    expect(layer(own, "panels")).toEqual(layer(shorts, "panels"));
    expect(own.outline).toEqual(shorts.outline);
  });

  it("draws the goalkeeper shirt with long sleeves and the winter code top like a jersey", () => {
    const keeper = draw("goalkeeper-shirt", {}, "front");
    const jerseyLong = draw("team-jersey", { "sleeve-length": "long" }, "front", true, madeUpFamilyValues("goalkeeper-shirt", {}));
    expect(keeper.outline).toEqual(jerseyLong.outline);
    expect(draw("winter-code-top", {}, "back").outline).toEqual(draw("team-jersey", {}, "back", true, madeUpFamilyValues("winter-code-top", {})).outline);
  });

  it("draws the cricket trousers with full legs, and the training top and tee as tops", () => {
    expect(panelIds(draw("cricket-trousers", {}, "front"))).toEqual(expect.arrayContaining(["legs-front", "waistband"]));
    expect(panelIds(draw("football-training-top", {}, "front"))).toContain("body-front");
    expect(panelIds(draw("cricket-training-tee", {}, "back"))).toContain("body-back");
  });
});

describe("socks", () => {
  it("are drawn not to scale, and say so, when there are no measurements", () => {
    const model = draw("football-socks", {}, "front", false);
    expect(model.toScale).toBe(false);
    expect(model.notice).toMatch(/not to scale/i);
    expect(panelIds(model).sort()).toEqual(["sock-foot", "sock-leg"]);
  });

  it("add a band panel only with a contrast band", () => {
    expect(panelIds(draw("football-socks", { "sock-top": "contrast-band" }, "front"))).toContain("sock-top-band");
    expect(panelIds(draw("football-socks", { "sock-top": "plain" }, "front"))).not.toContain("sock-top-band");
  });

  it("are taller as knee highs than as crew, with the same foot", () => {
    expect(heightOf(draw("football-socks", { "sock-height": "knee-high" }, "front"))).toBeGreaterThan(
      heightOf(draw("football-socks", { "sock-height": "crew" }, "front")),
    );
  });

  it("are longer when the foot length is longer", () => {
    const base = madeUpFamilyValues("football-socks", {});
    const longer = { ...base, "foot-length": Math.round((base["foot-length"] ?? 0) * 1.2) };
    expect(heightOf(draw("football-socks", {}, "front", true, longer))).toBeGreaterThan(heightOf(draw("football-socks", {}, "front")));
  });

  it("put the shin artwork on the front and the calf artwork on the back, once each", () => {
    const art = (anchor: string) => ({
      ...designWith("football-socks", {}, madeUpFamilyValues("football-socks", {})),
      artwork: [
        {
          id: "art", name: "Badge", source: { kind: "text" as const, text: "KW" }, panelId: "sock-leg", anchor,
          offsetX: 0, offsetY: 0, width: 400, height: 200, rotationDegrees: 0, technique: "screen-print" as const, provenance: "user-edited" as const,
        },
      ],
    });
    const count = (anchor: string, view: View): number => {
      const spec = art(anchor);
      return layer(buildFlat({ spec, measurements: typedIn(spec), view, colourwayId: "main" }) as FlatModel, "artwork").length;
    };
    expect([count("shin", "front"), count("shin", "back")]).toEqual([1, 0]);
    expect([count("calf", "front"), count("calf", "back")]).toEqual([0, 1]);
  });
});

describe("the cricket cap", () => {
  it("has a crown, a peak and a head band in both views", () => {
    for (const view of ["front", "back"] as const) {
      expect(panelIds(draw("cricket-cap", {}, view)).sort()).toEqual(["cap-band", "cap-crown", "cap-peak"]);
    }
  });

  it("has a wider crown as a baggy cap than as a peaked cap", () => {
    const widest = (model: FlatModel): number => {
      const crown = layer(model, "panels").find((element): element is FlatPath => element.kind === "path" && element.panelId === "cap-crown");
      return Math.max(...(crown?.commands ?? []).flatMap((command) => (command.op === "Z" ? [] : [Math.abs(command.to.x)])));
    };
    expect(widest(draw("cricket-cap", { "cap-shape": "baggy-cap" }, "front"))).toBeGreaterThan(widest(draw("cricket-cap", { "cap-shape": "peaked-cap" }, "front")));
  });

  it("is longer from the peak out when the peak is longer", () => {
    const base = madeUpFamilyValues("cricket-cap", {});
    const longer = { ...base, "peak-length": Math.round((base["peak-length"] ?? 0) * 1.3) };
    expect(heightOf(draw("cricket-cap", {}, "front", true, longer))).toBeGreaterThan(heightOf(draw("cricket-cap", {}, "front")));
    expect(widthOf(draw("cricket-cap", {}, "front"))).toBeGreaterThan(0);
  });

  it("puts front artwork on the front of the crown and back artwork on the back", () => {
    const withArt = (anchor: string) => {
      const spec = {
        ...designWith("cricket-cap", {}, madeUpFamilyValues("cricket-cap", {})),
        artwork: [
          {
            id: "art", name: "Badge", source: { kind: "text" as const, text: "KW" }, panelId: "cap-crown", anchor,
            offsetX: 0, offsetY: 0, width: 300, height: 150, rotationDegrees: 0, technique: "embroidery" as const, provenance: "user-edited" as const,
          },
        ],
      };
      return (view: View): number => layer(buildFlat({ spec, measurements: typedIn(spec), view, colourwayId: "main" }) as FlatModel, "artwork").length;
    };
    expect([withArt("crown-front")("front"), withArt("crown-front")("back")]).toEqual([1, 0]);
    expect([withArt("crown-back")("front"), withArt("crown-back")("back")]).toEqual([0, 1]);
  });
});

describe("every teamwear drawing", () => {
  it("is the same twice, so a generated file never changes between runs", () => {
    for (const typeId of ["football-socks", "cricket-cap", "football-shirt", "cricket-trousers"]) {
      expect(renderSvg(draw(typeId, {}, "front"))).toBe(renderSvg(draw(typeId, {}, "front")));
    }
  });
});
