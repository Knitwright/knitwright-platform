import { describe, expect, it } from "vitest";
import { buildFlat } from "@/lib/flat/build";
import { typedIn } from "@/lib/flat/fixtures/designs";
import type { FlatElement, FlatPath, PathCommand } from "@/lib/flat/model";
import { describeStack } from "./describe";
import { withStackPatterns } from "./draw-flat";
import { BENCHMARK_DOTS, jersey, kitPatternOf, LOGO_AND_TEXT, MARKS } from "./fixtures/designs";
import { deriveStack } from "./from-spec";
import type { PatternGenerator } from "./generator";
import { KIT_STYLE_GENERATORS, kitGeneratorId, kitStyleOf } from "./legacy/kit-styles";
import { findGenerator } from "./registry";
import { artworkStackSchema, parseArtworkStack, type ArtworkStack } from "./schema";

const body: FlatPath = {
  kind: "path",
  name: "Body front",
  panelId: "body-front",
  fill: "#112233",
  stroke: null,
  commands: [
    { op: "M", to: { x: -2000, y: 0 } },
    { op: "L", to: { x: 2000, y: 0 } },
    { op: "L", to: { x: 2000, y: 6000 } },
    { op: "L", to: { x: -2000, y: 6000 } },
    { op: "Z" },
  ],
};
const place = { view: "front" as const, underarm: { x: 2000, y: 1500 } };

const dotty: PatternGenerator = {
  id: "dotty",
  label: "Dotty",
  params: [],
  repeat: { kind: "field" },
  maxColours: 2,
  render: (context) => ({
    shapes: [
      { kind: "circle", centre: { x: context.datum.x, y: context.datum.y }, radius: 5, fill: context.colours[0] ?? "#000000" },
      { kind: "polygon", name: "Square", fill: context.ground, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] },
    ],
  }),
};

const stackWith = (generatorId: string, extra: Partial<ArtworkStack["layers"][number]> = {}): ArtworkStack => {
  const base = deriveStack(jersey({ kitPattern: kitPatternOf("hoops") }));
  return { ...base, layers: base.layers.map((layer) => (layer.kind === "pattern" ? { ...layer, generatorId, ...extra } : layer)) as ArtworkStack["layers"] };
};

describe("drawing a stack on a flat", () => {
  it("draws a generator's circles and polygons after the body, then the outline again", () => {
    const drawn = withStackPatterns([body], stackWith("dotty", { seed: 7 }), place, "main", [dotty]);
    expect(drawn.map((element) => (element as FlatPath).name)).toEqual(["Body front", "Dotty", "Square", "Body front outline"]);
    const circle = (drawn[1] as FlatPath).commands;
    expect(circle.filter((command) => command.op === "C")).toHaveLength(4);
    expect((circle[0] as Extract<PathCommand, { op: "M" }>).to).toEqual({ x: 50, y: 1500 });
  });

  it("gives the generator the colourway's colours and the ground under the pattern", () => {
    const drawn = withStackPatterns([body], stackWith("dotty"), place, "away", [dotty]);
    expect((drawn[1] as FlatPath).fill).toBe("#d4af37");
    expect((drawn[2] as FlatPath).fill).toBe("#112233");
  });

  it("changes nothing when there is no pattern on the view, the style is not known, or the view has no body", () => {
    const panels: readonly FlatElement[] = [body];
    const back = { ...place, view: "back" as const };
    expect(withStackPatterns(panels, stackWith("dotty"), back, "main", [dotty])).toBe(panels);
    expect(withStackPatterns(panels, stackWith("not-a-style"), place, "main", [dotty])).toBe(panels);
    expect(withStackPatterns([], stackWith("dotty"), place, "main", [dotty])).toEqual([]);
    const open: FlatPath = { ...body, commands: body.commands.slice(0, 3) };
    expect(withStackPatterns([open], stackWith("dotty"), place, "main", [dotty])).toEqual([open]);
    expect(withStackPatterns([{ kind: "text", text: "x", at: { x: 0, y: 0 }, size: 1, anchor: "start", colour: "#000000", rotation: 0 }], stackWith("dotty"), place, "main")).toHaveLength(1);
  });

  it("draws in grey a pattern colour that has no screen colour", () => {
    const stack = stackWith("dotty");
    const bare = { ...stack, colours: stack.colours.map((entry) => (entry.id === "pattern-1" ? { ...entry, screen: undefined } : entry)), layers: stack.layers };
    const drawn = withStackPatterns([body], bare, place, "main", [dotty]);
    expect((drawn[1] as FlatPath).fill).toBe("#9aa3ae");
  });

  it("changes the drawing when the colourway changes, without touching a layer", () => {
    const stack = deriveStack(jersey({ kitPattern: kitPatternOf("hoops") }));
    const home = withStackPatterns([body], stack, place, "main");
    const away = withStackPatterns([body], stack, place, "away");
    expect(home.length).toBe(away.length);
    expect(home).toEqual(away);
  });

  it("is the same on every run", () => {
    const stack = deriveStack(jersey({ kitPattern: kitPatternOf("sash") }));
    expect(withStackPatterns([body], stack, place, "main")).toEqual(withStackPatterns([body], stack, place, "main"));
  });
});

describe("the styles that exist today as generators", () => {
  it("has the seven and polka dots, each found by its id", () => {
    expect(KIT_STYLE_GENERATORS).toHaveLength(8);
    expect(findGenerator("kit-dots")?.params.map((entry) => entry.id)).toEqual(["dotWidthMm", "pitchMm", "rowStepMm", "halfDrop", "clearSpaceMm"]);
    expect(kitStyleOf(kitGeneratorId("hoops"))).toBe("hoops");
    expect(kitStyleOf("camo")).toBeNull();
    expect(findGenerator("kit-fade")?.params).toEqual([]);
    expect(findGenerator("kit-hoops")?.params[0]?.id).toBe("bandWidthMm");
    expect(findGenerator("nothing")).toBeUndefined();
  });

  it("draws with no outline given (the bounds), no armhole given, and as the back view", () => {
    const sash = findGenerator("kit-side-panels")!;
    const list = sash.render({
      view: "sleeve-left",
      bounds: { minX: -200, minY: 0, maxX: 200, maxY: 600 },
      landmarks: {},
      datum: { x: 0, y: 0 },
      colours: ["#d4af37"],
      ground: "#112233",
      params: { bandWidthMm: 80 },
      seed: 0,
    });
    expect(list.shapes.length).toBeGreaterThan(0);
    expect(list.shapes.every((shape) => shape.kind === "polygon")).toBe(true);
  });

  it("draws nothing when the outline is not a closed shape", () => {
    const hoops = findGenerator("kit-hoops")!;
    const list = hoops.render({ view: "front", bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 }, clip: [{ x: 0, y: 0 }, { x: 1, y: 1 }], landmarks: {}, datum: { x: 0, y: 0 }, colours: [], ground: "#000000", params: {}, seed: 0 });
    expect(list.shapes).toEqual([]);
  });
});

describe("describing a stack in words", () => {
  const stackOf = (spec = jersey({ kitPattern: kitPatternOf("hoops", { size: 900 }), artwork: LOGO_AND_TEXT, namesAndNumbers: MARKS })) => deriveStack(spec);

  it("says the ground, the pattern, each placed piece and the names and numbers", () => {
    const words = describeStack(stackOf(), "main");
    expect(words).toContain("Ground Navy.");
    expect(words).toContain("Hoops in Gold and screen colour #ffffff, bands 90 mm.");
    expect(words).toContain("Club crest at left chest, 90 mm.");
    expect(words).toContain('Text "ACME PLUMBING" at centre chest, 30 mm tall.');
    expect(words).toContain("Name across the upper back, block lettering.");
  });

  it("says each view's ground when they differ, and names an unknown style plainly", () => {
    const stack = stackOf(jersey());
    const split = { ...stack, layers: [stack.layers[0]!, { ...stack.layers[1]!, colourId: "panel-body-back" }] } as ArtworkStack;
    const mixed = { ...split, colourways: [{ id: "main", name: "Main", colours: { "panel-body-back": { screen: "#ffffff", codes: [{ system: "custom" as const, value: "White", source: "user-edited" as const }], provenance: "user-edited" as const } } }] };
    expect(describeStack(mixed, "main")).toContain("Ground Navy on the front, White on the back.");
    expect(describeStack(stackWith("brush-strokes", { seed: 7 }), "main")).toContain("brush strokes in Gold and screen colour #ffffff, seed 7.");
    expect(describeStack({ ...stack, layers: [] })).toBe("");
  });

  it("says the dots of the benchmark jersey in the stack's own words", () => {
    const words = describeStack(deriveStack(jersey({ kitPattern: BENCHMARK_DOTS })), "main");
    expect(words).toContain("Polka dots in Gold and screen colour #ffffff, dots 30 mm wide, 70 mm between centres, every other row shifted.");
  });

  it("describes pictures, zones, free text style and a design read from a picture", () => {
    const stack = parseArtworkStack({
      schemaVersion: 1,
      views: ["front"],
      colours: [],
      layers: [
        { kind: "image-fill", id: "a", views: ["front"], opacity: 1, blend: "normal", provenance: "read-from-image", assetId: "x", mode: "tile", scale: 1, rotationDeg: 0, offsetMm: { x: 0, y: 0 }, halfDrop: true, fit: "cover" },
        { kind: "image-fill", id: "b", views: ["front"], opacity: 1, blend: "normal", provenance: "user-edited", assetId: "x", mode: "panel", scale: 1, rotationDeg: 0, offsetMm: { x: 0, y: 0 }, halfDrop: false, fit: "cover" },
        { kind: "graphic", id: "c", views: ["front"], opacity: 1, blend: "normal", provenance: "user-edited", source: { kind: "asset", assetId: "y" }, placement: { kind: "zone", zoneId: "left-chest" }, offsetMm: { x: 0, y: 0 }, widthMm: 90, rotationDeg: 0, clearSpaceMm: 0, knockOut: false },
        { kind: "player-mark", id: "d", views: ["front"], opacity: 1, blend: "normal", provenance: "user-edited", place: "front-number" },
      ],
      colourways: [{ id: "main", name: "Main", colours: {} }],
    });
    expect(stack.ok).toBe(true);
    if (!stack.ok) return;
    expect(describeStack(stack.stack)).toBe(
      "A repeating picture in half-drop. A full-panel picture. Graphic at left chest, 90 mm. Number on the front. Read from a picture: compare it with the picture.",
    );
    expect(artworkStackSchema.safeParse(stack.stack).success).toBe(true);
  });
});

describe("polka dots keep clear of marks on a flat drawn from a stack", () => {
  const dotCount = (spec: ReturnType<typeof jersey>): number => {
    const stacked = { ...spec, artworkStack: deriveStack(spec) };
    const model = buildFlat({ spec: stacked, measurements: typedIn(stacked), view: "front", colourwayId: "main" });
    const elements = model?.layers.find((layer) => layer.id === "panels")?.elements ?? [];
    return elements.filter((element) => element.kind === "path" && element.name.startsWith("Kit pattern")).length;
  };

  it("leaves out dots near the crest and the sponsor line", () => {
    expect(dotCount(jersey({ kitPattern: BENCHMARK_DOTS, artwork: LOGO_AND_TEXT }))).toBeLessThan(dotCount(jersey({ kitPattern: BENCHMARK_DOTS })));
  });
});

describe("a flat built from a design with a stored stack", () => {
  it("draws nothing extra for a stack that has no pattern", () => {
    const spec = jersey();
    const withStack = { ...spec, artworkStack: deriveStack(spec) };
    const model = buildFlat({ spec: withStack, measurements: typedIn(withStack), view: "front", colourwayId: "main" });
    expect(model?.layers.find((layer) => layer.id === "panels")?.elements.some((element) => element.kind === "path" && element.name.startsWith("Kit pattern"))).toBe(false);
  });
});
