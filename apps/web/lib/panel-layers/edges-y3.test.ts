import { describe, expect, it } from "vitest";
import { applyAction, type SpecAction } from "@/lib/garment";
import { withSample } from "@/lib/editor/fixtures/article";
import { jersey } from "@/lib/editor/fixtures/article";
import { applyItem, type Applied } from "./apply";
import { design } from "./fixtures/design";
import { graphicView, setGraphicNumber } from "./graphic-edit";
import { libraryGroups, type LibraryItem } from "./library";
import { paletteOf, SPORTSWEAR_PALETTES } from "./palettes";
import { fillView, setFillColour, setFillValue, valuesOf } from "./pattern-fill";
import { sheetRules } from "./sheet-rules";

/** The edges: a design in a state the usual path does not reach, and the branches that report them. */

const words = (result: Applied): string => {
  if (!result.ok) throw new Error(result.reason);
  return result.words;
};

const refusal = (result: Applied): string => {
  if (result.ok) throw new Error("Expected a refusal.");
  return result.reason;
};

const items = (over = {}): readonly LibraryItem[] =>
  libraryGroups(design(over))
    .flatMap((group) => group.sections)
    .flatMap((section) => section.items);

const find = (match: (item: LibraryItem) => boolean, over = {}): LibraryItem => {
  const found = items(over).find(match);
  if (!found) throw new Error("No such item.");
  return found;
};

describe("a colourway the design does not have", () => {
  it("falls back to the design's first colourway rather than refusing", () => {
    const start = design({ colourwayId: "gone" });
    expect(words(applyItem(start, find((item) => item.label.includes("Navy")), { kind: "all" }))).toMatch(/Main colourway/);
  });
});

describe("the colours of the design's own colourway", () => {
  it("are offered beside the palettes, labelled by their panel when they have no colour reference", () => {
    const coloured = design({}, [
      { type: "update-colourway", colourway: { id: "main", name: "Main colourway", colours: [{ panelId: "body-front", colour: "", swatch: "#123456", provenance: "user-edited" }] } } as SpecAction,
    ]);
    const own = libraryGroups(coloured)
      .flatMap((group) => group.sections)
      .find((section) => section.id === "kw-colours")
      ?.items[0];
    expect(own).toMatchObject({ label: "body-front", swatch: "#123456" });
  });
});

describe("a pattern fill the design already has", () => {
  it("keeps its colours when another style is picked from the library", () => {
    const start = design({}, [
      { type: "set-kit-pattern", kitPattern: { style: "stripes", colours: [{ colour: "Club gold", swatch: "#c89b23" }], provenance: "user-edited" } } as SpecAction,
    ]);
    const steps = applyItem(start, find((item) => item.id === "fill-kit-sash-wide"), { kind: "all" });
    if (!steps.ok) throw new Error(steps.reason);
    const action = steps.steps[0];
    expect(action?.kind === "save" && action.action.type === "set-kit-pattern" ? action.action.kitPattern.colours : []).toEqual([{ colour: "Club gold", swatch: "#c89b23" }]);
  });

  it("takes no size when the style's preset gives none", () => {
    const coloured = design({}, [
      { type: "update-colourway", colourway: { id: "main", name: "Main colourway", colours: [{ panelId: "body-front", colour: "", swatch: "#123456", provenance: "user-edited" }] } } as SpecAction,
    ]);
    const fade = applyItem(coloured, find((item) => item.id === "fill-kit-fade-plain"), { kind: "all" });
    if (!fade.ok) throw new Error(fade.reason);
    const action = fade.steps[0];
    expect(action?.kind === "save" && action.action.type === "set-kit-pattern" ? action.action.kitPattern.size : 1).toBeUndefined();
  });

  it("has no millimetre setting to change when nobody has given one", () => {
    const start = design({}, [{ type: "set-kit-pattern", kitPattern: { style: "hoops", colours: [{ colour: "", swatch: "#101c3d" }], provenance: "user-edited" } } as SpecAction]);
    expect(valuesOf(start.spec.kitPattern as never)).toEqual({});
    expect(fillView(start)?.lockable).toEqual([]);
    expect(refusal(setFillValue(start, "bandWidthMm", 50))).toMatch(/not set yet/);
  });

  it("keeps a colour reference the brand gave when only the screen colour changes", () => {
    const start = design({}, [
      { type: "set-kit-pattern", kitPattern: { style: "hoops", colours: [{ colour: "Club gold", swatch: "#c89b23" }], size: 900, provenance: "user-edited" } } as SpecAction,
    ]);
    const result = setFillColour(start, 0, "#101c3d");
    if (!result.ok) throw new Error(result.reason);
    const action = result.steps[0];
    expect(action?.kind === "save" && action.action.type === "set-kit-pattern" ? action.action.kitPattern.colours[0] : null).toEqual({ colour: "Club gold", swatch: "#101c3d" });
  });
});

describe("an approved pattern-fill option", () => {
  it("names the sample that approved it instead of saying it is not sampled", () => {
    const article = withSample(jersey(), "P01", "body_length_offset");
    const item = find((entry) => entry.code === "P01", { article });
    expect(item.card[0]?.value).not.toBe("Not yet sampled");
  });
});

describe("a graphic from an uploaded file", () => {
  const uploaded = () =>
    design({}, [
      {
        type: "add-artwork",
        artwork: {
          id: "sponsor",
          name: "Main sponsor",
          source: { kind: "file", fileId: "11111111-1111-4111-8111-111111111111" },
          panelId: "body-front",
          anchor: "centre-chest",
          offsetX: 0,
          offsetY: 2600,
          width: 2500,
          height: 800,
          rotationDegrees: 0,
          technique: "sublimation",
          provenance: "brand-supplied",
        },
      } as SpecAction,
    ]);

  it("says so instead of showing text it does not have", () => {
    expect(graphicView(uploaded(), "sponsor")?.source).toBe("An uploaded file");
    expect(graphicView(uploaded(), "sponsor")?.panelLabel).not.toBe("body-front");
  });

  it("keeps its shape when the height is the side that changes", () => {
    const start = uploaded();
    const result = setGraphicNumber(start, "sponsor", "height", 40, true);
    if (!result.ok) throw new Error(result.reason);
    const action = result.steps[0];
    const art = action?.kind === "save" && action.action.type === "update-artwork" ? action.action.artwork : null;
    expect(art).toMatchObject({ width: 1250, height: 400 });
  });

  it("refuses a height of nothing", () => {
    expect(refusal(setGraphicNumber(uploaded(), "sponsor", "height", -1))).toMatch(/greater than zero/);
  });

  it("falls back to the panel id when the garment has no such panel", () => {
    const moved = design({}, [
      {
        type: "add-artwork",
        artwork: {
          id: "odd",
          name: "Odd one",
          source: { kind: "text", text: "X" },
          panelId: "body-front",
          anchor: "centre-chest",
          offsetX: 0,
          offsetY: 0,
          width: 100,
          height: 100,
          rotationDegrees: 0,
          technique: "sublimation",
          provenance: "user-edited",
        },
      } as SpecAction,
    ]);
    const shorts = { ...moved, spec: { ...moved.spec, typeId: "shorts" } };
    expect(graphicView(shorts as never, "odd")).toMatchObject({ panelLabel: "body-front", anchors: [] });
  });
});

describe("the seeded palettes", () => {
  it("are found by their own id, and nothing is found for an id nobody seeded", () => {
    expect(paletteOf(SPORTSWEAR_PALETTES[0]?.id ?? "")?.label).toBe("Classic club colours");
    expect(paletteOf("not-a-palette")).toBeUndefined();
  });
});

describe("the sheet's distances", () => {
  it("come from the settings the caller passes, and say where each came from", () => {
    const rules = sheetRules({ minDpi: { value: 150, source: "print-house" }, bleedMm: { value: 12, source: "print-house" }, safeZoneMm: { value: 15, source: "print-house" } });
    expect(rules.bleed).toMatchObject({ mm: 12, ruleId: "R-SUB-002" });
    expect(rules.bleed.note).toMatch(/from your print house/);
    expect(rules.safeZone.note).toMatch(/15 mm/);
  });

  it("say the default is Knitwright's own when nothing is passed", () => {
    expect(sheetRules().safeZone.note).toMatch(/not reviewed by a factory|Knitwright/i);
  });
});

describe("a garment type the registry does not know", () => {
  const unknown = () => {
    const start = design();
    return { ...start, spec: { ...start.spec, typeId: "kilt" } } as never;
  };

  it("has no panels, so a fabric and a colour have nowhere to go and say so", () => {
    expect(refusal(applyItem(unknown(), find((item) => item.code === "F-POLY-INT"), { kind: "all" }))).toMatch(/no panels/);
    expect(refusal(applyItem(unknown(), find((item) => item.label.includes("Navy")), { kind: "all" }))).toMatch(/no panels/);
  });
});

describe("an article with no fabric list at all", () => {
  it("says so with the catalogue's own label", () => {
    const section = libraryGroups(design({ article: { ...jersey(), fabrics: [] } }))
      .flatMap((group) => group.sections)
      .find((entry) => entry.id === "kw-fabrics");
    expect(section?.empty).toMatch(/no fabric list on file/);
  });
});

describe("a pattern fill whose colour is a reference with no screen colour", () => {
  it("takes the body colour from the colourway instead", () => {
    const start = design({}, [
      { type: "update-colourway", colourway: { id: "main", name: "Main colourway", colours: [{ panelId: "body-front", colour: "", swatch: "#abcdef", provenance: "user-edited" }] } } as SpecAction,
      { type: "set-kit-pattern", kitPattern: { style: "hoops", colours: [{ colour: "Club gold" }], size: 900, provenance: "user-edited" } } as SpecAction,
    ]);
    expect(applyItem(start, find((item) => item.id === "fill-kit-sash-wide"), { kind: "all" }).ok).toBe(true);
  });

  it("refuses a colour slot below the first one", () => {
    const start = design({}, [{ type: "set-kit-pattern", kitPattern: { style: "hoops", colours: [{ colour: "", swatch: "#101c3d" }], size: 900, provenance: "user-edited" } } as SpecAction]);
    expect(refusal(setFillColour(start, -1, "#c89b23"))).toMatch(/at most/);
  });
});

describe("a design the shell has already changed", () => {
  it("applies a fabric onto the panel list of the design in flight, not the one on the server", () => {
    const start = design();
    const first = applyItem(start, find((item) => item.code === "F-POLY-INT"), { kind: "all" });
    if (!first.ok) throw new Error(first.reason);
    const after = first.steps
      .flatMap((step) => (step.kind === "save" ? [step.action] : []))
      .reduce((spec, action) => {
        const result = applyAction(spec, action);
        if (!result.ok) throw new Error(result.reason);
        return result.spec;
      }, start.spec);
    const second = applyItem({ ...start, spec: after }, find((item) => item.code === "F-POLY-RIB"), { kind: "panel", panelId: "body-front" });
    expect(words(second)).toBe("F-POLY-RIB on body-front.");
  });
});
