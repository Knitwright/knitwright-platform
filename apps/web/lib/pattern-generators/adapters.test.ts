import { describe, expect, it } from "vitest";
import { KIT_PATTERN_STYLES } from "@/lib/garment";
import { kitPatternElements } from "@/lib/flat/kit-pattern";
import type { FlatPath } from "@/lib/flat/model";
import { ADAPTER_GENERATORS } from "./adapters";
import { GENERATORS, getGenerator } from "./registry";
import { PRESETS } from "./presets";

const body: FlatPath = {
  kind: "path",
  name: "Body",
  panelId: "body-front",
  fill: "#112233",
  stroke: null,
  commands: [{ op: "M", to: { x: 0, y: 0 } }, { op: "L", to: { x: 4000, y: 0 } }, { op: "L", to: { x: 4000, y: 6000 } }, { op: "L", to: { x: 0, y: 6000 } }, { op: "Z" }],
};

describe("adapters for the styles that existed", () => {
  it("cover all eight styles under the registry", () => {
    expect(ADAPTER_GENERATORS.map((entry) => entry.id).sort()).toEqual(KIT_PATTERN_STYLES.map((style) => `kit-${style}`).sort());
    expect(ADAPTER_GENERATORS).toHaveLength(8);
    for (const adapter of ADAPTER_GENERATORS) expect(getGenerator(adapter.id)).toBe(adapter);
    expect(new Set(GENERATORS.map((entry) => entry.id)).size).toBe(GENERATORS.length);
  });

  it.each(KIT_PATTERN_STYLES)("%s draws what the older drawing draws", (style) => {
    const generator = getGenerator(`kit-${style}`)!;
    const colours = ["#d4af37", "#ffffff"];
    const size = style === "dots" ? undefined : 700;
    const old = kitPatternElements({ style, colours: colours.map((swatch) => ({ colour: "", swatch })), ...(size === undefined ? {} : { size }), provenance: "derived" }, body, { view: "front", underarm: { x: 4000, y: 2000 } });
    const list = generator.render({
      view: "front",
      bounds: { minX: 0, minY: 0, maxX: 400, maxY: 600 },
      landmarks: { underarm: { x: 400, y: 200 } },
      datum: { x: 0, y: 200 },
      colours,
      ground: "#112233",
      params: size === undefined ? {} : { bandWidthMm: 70 },
      seed: 0,
    });
    expect(list.shapes.length).toBe(old.length);
    list.shapes.forEach((shape, at) => {
      expect(shape.fill).toBe(old[at].fill);
      const points = shape.kind === "polygon" ? shape.points : [];
      const drawn = old[at].commands.flatMap((command) => (command.op === "Z" ? [] : [{ x: command.to.x / 10, y: command.to.y / 10 }]));
      points.forEach((point, index) => {
        expect(Math.abs(point.x - drawn[index].x)).toBeLessThanOrEqual(0.01);
        expect(Math.abs(point.y - drawn[index].y)).toBeLessThanOrEqual(0.01);
      });
    });
  });
});

describe("presets", () => {
  it("has three for every style, each with settings its style accepts", () => {
    for (const generator of GENERATORS) {
      const own = PRESETS.filter((entry) => entry.generatorId === generator.id);
      expect(own, generator.id).toHaveLength(3);
      for (const preset of own) {
        const known = new Set(generator.params.map((spec) => spec.id));
        expect(Object.keys(preset.params).every((id) => known.has(id)), preset.id).toBe(true);
      }
    }
    expect(new Set(PRESETS.map((entry) => entry.id)).size).toBe(PRESETS.length);
  });
});
