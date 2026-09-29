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
    for (const type of ["add-fabric", "update-fabric"]) {
      expect(parse({ type, fabric: fabric(claim) })).toMatchObject({ fabric: { provenance: "user-edited" } });
    }
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
