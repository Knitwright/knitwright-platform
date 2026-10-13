import { describe, expect, it } from "vitest";
import { browserActionSchema, stampUserEdited } from "./browser-action";

const CLAIMS = ["brand-supplied", "ai-suggested", "suggested-chart", "derived", "read-from-image"] as const;

const fabric = (provenance?: string) => ({
  id: "mesh",
  name: "Mesh",
  composition: "",
  construction: "",
  weightGsm: null,
  finish: "",
  stretch: "not-set",
  ...(provenance ? { provenance } : {}),
});

const artwork = (provenance?: string) => ({
  id: "logo",
  name: "Crest",
  source: { kind: "text", text: "FC" },
  panelId: "body-front",
  anchor: "centre-chest",
  offsetX: 0,
  offsetY: 0,
  width: 1000,
  height: 500,
  rotationDegrees: 0,
  technique: "screen-print",
  ...(provenance ? { provenance } : {}),
});

const parse = (value: unknown) => browserActionSchema.parse(value);

describe("browserActionSchema", () => {
  it.each(CLAIMS)("stamps user-edited on an option even when the browser claims %s", (claim) => {
    const parsed = parse({ type: "set-option", optionId: "fit", choiceId: "slim", provenance: claim });

    expect(parsed).toMatchObject({ type: "set-option", provenance: "user-edited" });
  });

  it.each(CLAIMS)("stamps user-edited on a measurement even when the browser claims %s", (claim) => {
    const parsed = parse({ type: "set-measurement", pointId: "chest-width", value: 5000, provenance: claim });

    expect(parsed).toMatchObject({ provenance: "user-edited" });
  });

  it("stamps user-edited when the browser sends no source at all", () => {
    expect(parse({ type: "set-option", optionId: "fit", choiceId: "slim" })).toMatchObject({
      provenance: "user-edited",
    });
  });

  it.each(CLAIMS)("stamps user-edited inside a fabric that claims %s", (claim) => {
    expect(parse({ type: "add-fabric", fabric: fabric(claim) })).toMatchObject({ fabric: { provenance: "user-edited" } });
  });

  it.each(CLAIMS)("stamps user-edited inside artwork that claims %s", (claim) => {
    for (const type of ["add-artwork", "update-artwork"]) {
      expect(parse({ type, artwork: artwork(claim) })).toMatchObject({ artwork: { provenance: "user-edited" } });
    }
  });

  it.each(CLAIMS)("stamps user-edited on every colour of a colourway that claims %s", (claim) => {
    const colourway = {
      id: "away",
      name: "Away",
      colours: [
        { panelId: "body-front", colour: "Navy", provenance: claim },
        { panelId: "body-back", colour: "White" },
      ],
    };

    for (const type of ["add-colourway", "update-colourway"]) {
      const parsed = parse({ type, colourway });
      expect(parsed).toMatchObject({
        colourway: { colours: [{ provenance: "user-edited" }, { provenance: "user-edited" }] },
      });
    }
  });

  it("passes a colour swatch through and still stamps the source", () => {
    const colourway = {
      id: "away",
      name: "Away",
      colours: [{ panelId: "body-front", colour: "Navy", swatch: "#1b2a49", provenance: "ai-suggested" }],
    };
    expect(parse({ type: "update-colourway", colourway })).toMatchObject({
      colourway: { colours: [{ swatch: "#1b2a49", provenance: "user-edited" }] },
    });
    const bad = { ...colourway, colours: [{ panelId: "body-front", colour: "Navy", swatch: "blue" }] };
    expect(browserActionSchema.safeParse({ type: "update-colourway", colourway: bad }).success).toBe(false);
  });

  it("strips a source from places that never carry one", () => {
    const stripped = stampUserEdited({ type: "remove-fabric", id: "mesh", provenance: "brand-supplied" });

    expect(stripped).toEqual({ type: "remove-fabric", id: "mesh" });
  });

  it("does not change what it is given", () => {
    const input = { type: "add-fabric", fabric: fabric("brand-supplied") };
    const copy = structuredClone(input);

    stampUserEdited(input);

    expect(input).toEqual(copy);
  });

  it("still refuses what the garment library refuses", () => {
    expect(browserActionSchema.safeParse({ type: "delete-everything" }).success).toBe(false);
    expect(browserActionSchema.safeParse(undefined).success).toBe(false);
    expect(browserActionSchema.safeParse("set-option").success).toBe(false);
    expect(browserActionSchema.safeParse({ type: "set-option", optionId: "fit", choiceId: "slim", extra: 1 }).success).toBe(false);
  });

  it("passes on shapes it does not understand without throwing", () => {
    expect(browserActionSchema.safeParse({ type: "add-fabric", fabric: "mesh" }).success).toBe(false);
    expect(browserActionSchema.safeParse({ type: "add-colourway", colourway: { colours: "no" } }).success).toBe(false);
  });
});

describe("text that is not well formed", () => {
  const withText = (text: string) => ({
    type: "add-artwork",
    artwork: { ...artwork(), source: { kind: "text", text } },
  });

  it("is refused before it is stored: half of a surrogate pair cannot be written into a file", () => {
    for (const bad of ["a\uD800b", "\uDC00", "ends\uD83D"]) {
      expect(browserActionSchema.safeParse(withText(bad)).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it("is refused wherever it is hidden in the change", () => {
    const named = { type: "add-artwork", artwork: { ...artwork(), name: "Crest\uD800" } };
    expect(browserActionSchema.safeParse(named).success).toBe(false);
    const colourway = { type: "add-colourway", colourway: { id: "away", name: "Away\uDFFF", colours: [] } };
    expect(browserActionSchema.safeParse(colourway).success).toBe(false);
  });

  it("lets a whole emoji and ordinary accents through", () => {
    expect(browserActionSchema.safeParse(withText("FÇ \u{1F600}")).success).toBe(true);
  });
});

describe("browserActionSchema, tech pack fields", () => {
  const component = (provenance?: string) => ({
    id: "main-thread",
    name: "Thread",
    details: "",
    quantity: "",
    ...(provenance ? { provenance } : {}),
  });
  const entry = (provenance?: string) => ({
    seamId: "body-hem",
    stitchDensity: "dense",
    ...(provenance ? { provenance } : {}),
  });

  it.each(CLAIMS)("stamps user-edited inside a component that claims %s", (claim) => {
    expect(parse({ type: "set-component", component: component(claim) })).toMatchObject({
      component: { provenance: "user-edited" },
    });
  });

  it.each(CLAIMS)("stamps user-edited inside a construction entry that claims %s", (claim) => {
    expect(parse({ type: "set-construction", entry: entry(claim) })).toMatchObject({
      entry: { provenance: "user-edited" },
    });
  });

  it.each(CLAIMS)("stamps user-edited on a labelling field that claims %s", (claim) => {
    expect(parse({ type: "set-labelling", field: "care", text: "Wash cold", provenance: claim })).toMatchObject({
      provenance: "user-edited",
    });
  });

  it("stamps user-edited when the browser sends no source at all", () => {
    expect(parse({ type: "set-component", component: component() })).toMatchObject({ component: { provenance: "user-edited" } });
    expect(parse({ type: "set-construction", entry: entry() })).toMatchObject({ entry: { provenance: "user-edited" } });
    expect(parse({ type: "set-labelling", field: "bag", text: "Poly bag" })).toMatchObject({ provenance: "user-edited" });
  });

  it.each(CLAIMS)("stamps user-edited on a value for one size and on a tolerance that claim %s", (claim) => {
    expect(
      parse({ type: "set-size-measurement", entry: { pointId: "chest-width", size: "L", value: 5500, provenance: claim } }),
    ).toMatchObject({ entry: { provenance: "user-edited" } });
    expect(parse({ type: "set-tolerance", entry: { pointId: "chest-width", value: 100, provenance: claim } })).toMatchObject({
      entry: { provenance: "user-edited" },
    });
  });

  it("leaves the removal of a component or a seam entry as it is", () => {
    expect(parse({ type: "remove-component", id: "buttons" })).toEqual({ type: "remove-component", id: "buttons" });
    expect(parse({ type: "remove-construction", seamId: "body-hem" })).toEqual({ type: "remove-construction", seamId: "body-hem" });
  });
});

describe("browserActionSchema, fabric sources", () => {
  it("stamps user-edited on the fields a change-fabric lists, whatever the browser claims", () => {
    const parsed = parse({ type: "change-fabric", id: "main", changes: { consumption: "1 m" }, provenance: "ai-suggested" });
    expect(parsed).toMatchObject({ provenance: "user-edited", changes: { consumption: "1 m" } });
  });

  it("stamps user-edited when the browser sends no source at all on a change-fabric", () => {
    expect(parse({ type: "change-fabric", id: "main", changes: { finish: "Washed" } })).toMatchObject({ provenance: "user-edited" });
  });

  it("throws away a source the browser gave to a field of a new fabric", () => {
    const parsed = parse({
      type: "add-fabric",
      fabric: { ...fabric("claimed"), composition: "Cotton", sources: { composition: "brand-supplied" } },
    }) as { fabric: { sources: Record<string, string> } };
    expect(parsed.fabric.sources.composition).toBe("user-edited");
  });

  it("refuses update-fabric from a browser, since it would give one source to every field", () => {
    expect(browserActionSchema.safeParse({ type: "update-fabric", fabric: fabric("mesh") }).success).toBe(false);
  });
});

