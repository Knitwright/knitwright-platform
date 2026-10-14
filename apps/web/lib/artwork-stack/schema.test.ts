import { describe, expect, it } from "vitest";
import { jersey, kitPatternOf } from "./fixtures/designs";
import { deriveStack } from "./from-spec";
import { ARTWORK_STACK_VERSION, NEWER_STACK_SENTENCE, artworkStackSchema, parseArtworkStack, type ArtworkStack } from "./schema";

const common = { opacity: 1, blend: "normal", provenance: "user-edited" } as const;
const colour = (id: string, screen?: string) => ({ id, role: "test", ...(screen ? { screen } : {}), codes: [], provenance: "user-edited" as const });

const everyKind = {
  schemaVersion: ARTWORK_STACK_VERSION,
  views: ["front", "back", "sleeve-left"],
  colours: [colour("white", "#ffffff"), colour("red", "#cc0000"), colour("blue", "#0044cc")],
  layers: [
    { ...common, kind: "ground", id: "ground", views: ["front", "back"], colourId: "white" },
    {
      ...common,
      kind: "pattern",
      id: "dots",
      views: ["front", "back"],
      generatorId: "dots",
      params: { diameterMm: 30, pitchMm: 70, rowStepMm: 35, halfDrop: true },
      seed: 7,
      datum: { anchor: "chest-line", offsetMm: { x: 0, y: 0 } },
      colourIds: ["red", "blue"],
    },
    {
      ...common,
      kind: "image-fill",
      id: "panel-art",
      views: ["front"],
      assetId: "asset-1",
      mode: "panel",
      scale: 1,
      rotationDeg: 0,
      offsetMm: { x: 0, y: 0 },
      halfDrop: false,
      fit: "cover",
    },
    {
      ...common,
      kind: "graphic",
      id: "crest",
      name: "Club crest",
      views: ["front"],
      source: { kind: "asset", assetId: "asset-2" },
      placement: { kind: "zone", zoneId: "crest" },
      offsetMm: { x: 0, y: 0 },
      widthMm: 90,
      rotationDeg: 0,
      clearSpaceMm: 10,
      knockOut: true,
    },
    {
      ...common,
      kind: "text",
      id: "sponsor",
      views: ["front"],
      text: "ACME",
      lettering: "block",
      placement: { kind: "anchor", anchorId: "cf-neck" },
      offsetMm: { x: 0, y: 40 },
      heightMm: 30,
      rotationDeg: 0,
      colourId: "blue",
    },
    { ...common, kind: "player-mark", id: "back-name", views: ["back"], place: "back-name", colourId: "blue" },
  ],
  colourways: [{ id: "home", name: "Home", colours: { red: { screen: "#ff0000", codes: [{ system: "ral", value: "3020", source: "user-edited" }], provenance: "user-edited" } } }],
};

const parse = (value: unknown) => artworkStackSchema.safeParse(value);
const problem = (value: unknown): string => {
  const result = parse(value);
  return result.success ? "" : (result.error.issues[0]?.message ?? "");
};

describe("the artwork stack schema", () => {
  it("accepts one of every layer kind", () => {
    expect(parse(everyKind).success).toBe(true);
  });

  it("accepts the benchmark jersey: white ground, dots in two colours, half-drop", () => {
    const stack = { ...everyKind, layers: everyKind.layers.slice(0, 2) };
    expect(parse(stack).success).toBe(true);
  });

  it("accepts a placed logo with a full-panel image", () => {
    const stack = { ...everyKind, layers: [everyKind.layers[0], everyKind.layers[2], everyKind.layers[3]] };
    expect(parse(stack).success).toBe(true);
  });

  it("gives an equal stack when saved as JSON and read again", () => {
    const first = parseArtworkStack(everyKind);
    expect(first.ok && parseArtworkStack(JSON.parse(JSON.stringify(first.stack)))).toEqual(first);
    const derived = deriveStack(jersey({ kitPattern: kitPatternOf("sash") }));
    expect(parseArtworkStack(JSON.parse(JSON.stringify(derived)))).toEqual({ ok: true, stack: derived });
  });

  it("refuses a stack from a newer version with a plain sentence", () => {
    const result = parseArtworkStack({ ...everyKind, schemaVersion: ARTWORK_STACK_VERSION + 1 });
    expect(result).toEqual({ ok: false, reason: NEWER_STACK_SENTENCE });
    expect(problem({ ...everyKind, schemaVersion: 2 })).toBe(NEWER_STACK_SENTENCE);
  });

  it("refuses something that is not a stack, and says so in one sentence", () => {
    expect(parseArtworkStack(null).ok).toBe(false);
    expect(parseArtworkStack({ schemaVersion: "x" }).ok).toBe(false);
    expect(parseArtworkStack({ ...everyKind, views: [] })).toMatchObject({ ok: false });
  });

  it("refuses a layer that names a colour, a view or a layer id that does not fit", () => {
    const [ground, ...rest] = everyKind.layers;
    expect(problem({ ...everyKind, layers: [{ ...ground, colourId: "green" }, ...rest] })).toMatch(/not in the colour list/);
    expect(problem({ ...everyKind, layers: [{ ...ground, views: ["collar"] }, ...rest] })).toMatch(/does not have/);
    expect(problem({ ...everyKind, layers: [ground, ground] })).toMatch(/own id/);
    expect(problem({ ...everyKind, layers: [{ ...ground, views: ["front", "front"] }] })).toMatch(/only once/);
    expect(problem({ ...everyKind, colourways: [{ id: "home", name: "Home", colours: { green: { codes: [], provenance: "derived" } } }] })).toMatch(/not in the colour list/);
    expect(problem({ ...everyKind, colourways: [{ id: "a", name: "A", colours: {} }, { id: "a", name: "B", colours: {} }] })).toMatch(/own id/);
    expect(problem({ ...everyKind, colours: [colour("white"), colour("white")] })).toMatch(/only once/);
    expect(problem({ ...everyKind, views: ["front", "front"] })).toMatch(/only once/);
    expect(problem({ ...everyKind, colourways: [] })).toMatch(/at least one colourway/);
  });

  it("refuses a blend with nothing under it, a blended ground and a ground that covers other layers", () => {
    const [ground, pattern, ...rest] = everyKind.layers;
    expect(problem({ ...everyKind, layers: [{ ...pattern, blend: "multiply" }] })).toMatch(/nothing is/);
    expect(problem({ ...everyKind, layers: [{ ...ground, blend: "screen" }] })).toMatch(/nothing lies under it/);
    expect(problem({ ...everyKind, layers: [pattern, ground, ...rest] })).toMatch(/would cover/);
  });

  it("refuses sizes and settings that make no sense", () => {
    const [ground, pattern] = everyKind.layers;
    const many = Object.fromEntries(Array.from({ length: 17 }, (_, at) => [`p${at}`, at]));
    expect(parse({ ...everyKind, layers: [ground, { ...pattern, params: many }] }).success).toBe(false);
    expect(parse({ ...everyKind, layers: [ground, { ...pattern, seed: -1 }] }).success).toBe(false);
    expect(parse({ ...everyKind, layers: [ground, { ...everyKind.layers[3], widthMm: 0 }] }).success).toBe(false);
  });

  it("types a code as a person gave it and ships no colour library", () => {
    const stack = parseArtworkStack(everyKind) as { ok: true; stack: ArtworkStack };
    expect(stack.stack.colourways[0]?.colours.red?.codes[0]).toEqual({ system: "ral", value: "3020", source: "user-edited" });
    expect(parse({ ...everyKind, colours: [{ ...colour("white"), codes: [{ system: "munsell", value: "5R", source: "user-edited" }] }] }).success).toBe(false);
  });
});
