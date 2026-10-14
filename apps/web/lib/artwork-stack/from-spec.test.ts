import { describe, expect, it } from "vitest";
import { buildFlat } from "@/lib/flat/build";
import { typedIn } from "@/lib/flat/fixtures/designs";
import { renderSvg } from "@/lib/flat/render-svg";
import type { FlatModel, View } from "@/lib/flat/model";
import { validateSpec, type GarmentSpec } from "@/lib/garment";
import { allDesigns, jersey, kitPatternOf, LOGO_AND_TEXT, MARKS, withStack } from "./fixtures/designs";
import { currentStack, deriveStack, inStep, writeStack } from "./from-spec";
import { toLegacy } from "./legacy/to-legacy";
import { artworkStackSchema, parseArtworkStack } from "./schema";

const flat = (spec: GarmentSpec, view: View): FlatModel => buildFlat({ spec, measurements: typedIn(spec), view, colourwayId: "main" }) as FlatModel;

describe("deriving a stack from a design saved before stacks", () => {
  for (const { name, spec } of allDesigns()) {
    it(`gives a valid stack for ${name}`, () => {
      expect(artworkStackSchema.safeParse(deriveStack(spec)).success).toBe(true);
    });

    it(`gives the same older fields back for ${name}`, () => {
      const legacy = toLegacy(deriveStack(spec));
      expect(legacy.kitPattern).toEqual(spec.kitPattern);
      expect(legacy.artwork).toEqual(spec.artwork);
      expect(legacy.namesAndNumbers).toEqual(spec.namesAndNumbers);
      expect(legacy.colourways).toEqual(spec.colourways);
    });

    it(`draws ${name} exactly as it is drawn today, on both views`, () => {
      const stacked = withStack(spec, deriveStack(spec));
      for (const view of ["front", "back"] as const) {
        expect(renderSvg(flat(stacked, view))).toBe(renderSvg(flat(spec, view)));
      }
    });

    it(`keeps ${name} valid, and equal, after saving with a stack and reading it again`, () => {
      const saved = writeStack(spec, deriveStack(spec), 3);
      const reread = validateSpec(JSON.parse(JSON.stringify(saved)));
      expect(reread.ok).toBe(true);
      if (reread.ok) {
        expect(reread.spec).toEqual(saved);
        expect(reread.spec.kitPattern).toEqual(spec.kitPattern);
        expect(reread.spec.artwork).toEqual(spec.artwork);
        expect(reread.spec.artworkStack?.derivedFrom).toEqual({ specVersion: 3 });
      }
    });
  }

  it("gives a ground-only stack for a design with no pattern, no artwork and no marks", () => {
    const stack = deriveStack(jersey());
    expect(stack.layers.map((layer) => layer.kind)).toEqual(["ground", "ground"]);
    expect(stack.views).toEqual(["front", "back"]);
  });

  it("gives a ground of no particular colour when the colourway names no body panel", () => {
    const spec = jersey();
    const bare: GarmentSpec = { ...spec, colourways: [{ id: "main", name: "Main", colours: [] }] };
    const stack = deriveStack(bare);
    expect(stack.colours.map((entry) => entry.id)).toEqual(["ground"]);
    expect(stack.layers[0]).toMatchObject({ kind: "ground", colourId: "ground" });
    expect(artworkStackSchema.safeParse(stack).success).toBe(true);
  });

  it("puts each piece of artwork on the view of its panel, and draws the sleeve view only when something is on it", () => {
    const stack = deriveStack(jersey({ artwork: LOGO_AND_TEXT }));
    expect(stack.views).toEqual(["front", "back", "sleeve-left"]);
    expect(stack.layers.find((layer) => layer.id === "sleeve-badge")?.views).toEqual(["sleeve-left"]);
  });

  it("is the same every time", () => {
    const spec = jersey({ kitPattern: kitPatternOf("hoops"), artwork: LOGO_AND_TEXT, namesAndNumbers: MARKS });
    expect(JSON.stringify(deriveStack(spec))).toBe(JSON.stringify(deriveStack(spec)));
  });
});

describe("the stack stored in a design", () => {
  const spec = jersey({ kitPattern: kitPatternOf("hoops") });

  it("is used while it agrees with the older fields", () => {
    const saved = writeStack(spec, deriveStack(spec), 1);
    expect(inStep(saved, saved.artworkStack!)).toBe(true);
    expect(currentStack(saved)).toBe(saved.artworkStack);
  });

  it("is set aside for one worked out from the older fields when an older editor has changed them", () => {
    const saved = writeStack(spec, deriveStack(spec), 1);
    const edited: GarmentSpec = { ...saved, kitPattern: kitPatternOf("sash") };
    expect(inStep(edited, edited.artworkStack!)).toBe(false);
    expect(currentStack(edited)).toEqual(deriveStack(edited));
  });

  it("is derived when the design has none", () => {
    expect(currentStack(spec)).toEqual(deriveStack(spec));
  });

  it("keeps layers the older fields cannot hold, and leaves them out of the older fields", () => {
    const stack = deriveStack(spec);
    const extra = parseArtworkStack({
      ...stack,
      layers: [
        ...stack.layers,
        {
          kind: "image-fill",
          id: "camo-photo",
          views: ["front"],
          opacity: 1,
          blend: "multiply",
          provenance: "user-edited",
          assetId: "asset_1",
          mode: "tile",
          scale: 1,
          rotationDeg: 0,
          offsetMm: { x: 0, y: 0 },
          halfDrop: false,
          fit: "cover",
        },
      ],
    });
    expect(extra.ok).toBe(true);
    if (!extra.ok) return;
    const saved = writeStack(spec, extra.stack, 2);
    expect(saved.artworkStack?.layers).toHaveLength(stack.layers.length + 1);
    expect(saved.kitPattern).toEqual(spec.kitPattern);
    expect(currentStack(saved)).toBe(saved.artworkStack);
  });

  it("removes the older pattern and marks when the stack has none", () => {
    const withAll = jersey({ kitPattern: kitPatternOf("hoops"), namesAndNumbers: MARKS });
    const plain = jersey();
    const saved = writeStack(withAll, deriveStack(plain), 4);
    expect(saved.kitPattern).toBeUndefined();
    expect(saved.namesAndNumbers).toBeUndefined();
    expect("kitPattern" in saved).toBe(false);
  });

  it("keeps the design's own colourways if a stack carries none that the older fields can hold", () => {
    const stack = deriveStack(spec);
    const saved = writeStack(spec, { ...stack, colourways: [{ id: "main", name: "", colours: {} }] }, 1);
    expect(saved.colourways).toEqual(spec.colourways);
  });

  it("leaves out stack-only graphics and text the older artwork cannot hold", () => {
    const stack = deriveStack(jersey({ artwork: LOGO_AND_TEXT }));
    const strange = stack.layers.map((layer) =>
      layer.kind === "graphic" && layer.id === "crest"
        ? { ...layer, source: { kind: "asset" as const, assetId: "asset_9" } }
        : layer.kind === "text"
          ? { ...layer, placement: { kind: "zone" as const, zoneId: "sponsor" } }
          : layer.kind === "graphic" && layer.id === "sleeve-badge"
            ? { ...layer, heightMm: undefined }
            : layer,
    );
    const legacy = toLegacy({ ...stack, layers: strange });
    expect(legacy.artwork).toEqual([]);
  });
});
