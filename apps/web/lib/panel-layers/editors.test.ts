import { describe, expect, it } from "vitest";
import { applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import type { Applied } from "./apply";
import { NOT_AVAILABLE, standInBackgroundRemoval } from "./background";
import { design } from "./fixtures/design";
import { centreOnAnchor, graphicActionsNotWired, graphicView, removeGraphic, setGraphicAnchor, setGraphicNumber, setGraphicTechnique } from "./graphic-edit";
import { fillView, removeFill, setFillColour, setFillValue, storedIdsOf, withRatio } from "./pattern-fill";
import { techniqueChoices, unknownDecorationProfile } from "./techniques";

const steps = (result: Applied): readonly SpecAction[] => {
  if (!result.ok) throw new Error(result.reason);
  return result.steps.flatMap((step) => (step.kind === "save" ? [step.action] : []));
};

const refusal = (result: Applied): string => {
  if (result.ok) throw new Error("Expected a refusal.");
  return result.reason;
};

const run = (spec: GarmentSpec, actions: readonly SpecAction[]): GarmentSpec =>
  actions.reduce((current, action) => {
    const result = applyAction(current, action);
    if (!result.ok) throw new Error(`${action.type}: ${result.reason}`);
    return result.spec;
  }, spec);

const hooped = (over = {}) =>
  design(over, [
    { type: "set-kit-pattern", kitPattern: { style: "hoops", colours: [{ colour: "", swatch: "#101c3d" }], size: 900, provenance: "user-edited" } } as SpecAction,
  ]);

const dotted = () =>
  design({}, [
    {
      type: "set-kit-pattern",
      kitPattern: { style: "dots", colours: [{ colour: "", swatch: "#101c3d" }], size: 300, dots: { pitch: 900, rowStep: 800 }, provenance: "user-edited" },
    } as SpecAction,
  ]);

describe("the pattern-fill popover", () => {
  it("is nothing at all for a design with no pattern fill", () => {
    expect(fillView(design())).toBeNull();
    expect(refusal(setFillValue(design(), "bandWidthMm", 50))).toMatch(/no pattern fill/);
    expect(refusal(removeFill(design()))).toMatch(/no pattern fill/);
  });

  it("offers the band width of a band style, from the style's own declared range", () => {
    const view = fillView(hooped());
    expect(view?.fields.map((field) => ({ id: field.id, value: field.value, unit: field.unit }))).toEqual([{ id: "bandWidthMm", value: 90, unit: "mm" }]);
    expect(view?.fields[0]?.max).toBeGreaterThan(90);
  });

  it("offers the dots' own spacing, because a design can store it", () => {
    expect(fillView(dotted())?.fields.map((field) => field.id)).toEqual(["dotWidthMm", "pitchMm", "rowStepMm", "halfDrop", "clearSpaceMm"]);
    expect(storedIdsOf("hoops")).toEqual(["bandWidthMm"]);
  });

  it("lists the controls the spec asks for that a design cannot store, with a reason and a rule", () => {
    const view = fillView(hooped());
    expect(view?.unstored.map((entry) => entry.label)).toEqual(["Height", "Padding", "Rotation"]);
    expect(view?.unstored.every((entry) => entry.ruleId === "R-GAP-000" && entry.reason.length > 20)).toBe(true);
  });

  it("says that a kit pattern cannot go on one panel on its own", () => {
    expect(fillView(hooped())?.targets).toEqual([
      { kind: "all", label: "Apply to all", reason: null },
      { kind: "panel", label: "Apply to the selected panel", reason: expect.stringMatching(/whole garment/) },
    ]);
  });

  it("stores a new width in the units a design keeps", () => {
    const start = hooped();
    const after = run(start.spec, steps(setFillValue(start, "bandWidthMm", 45)));
    expect(after.kitPattern).toMatchObject({ size: 450, provenance: "user-edited" });
  });

  it("keeps the other millimetre settings in ratio when the lock is on, and leaves them alone when it is off", () => {
    const start = dotted();
    const view = fillView(start);
    if (!view) throw new Error("no view");
    expect(withRatio(view, "dotWidthMm", 60, true)).toEqual({ dotWidthMm: 60, pitchMm: 180, rowStepMm: 160 });
    expect(withRatio(view, "dotWidthMm", 60, false)).toEqual({ dotWidthMm: 60 });
  });

  it("holds a value to the style's own range rather than refusing it", () => {
    const start = hooped();
    const field = fillView(start)?.fields[0];
    const after = run(start.spec, steps(setFillValue(start, "bandWidthMm", -5)));
    expect(after.kitPattern?.size).toBe(Math.round((field?.min ?? 0) * 10));
  });

  it("sets a yes-or-no setting without a ratio", () => {
    const start = dotted();
    const after = run(start.spec, steps(setFillValue(start, "halfDrop", true)));
    expect(after.kitPattern?.dots?.halfDrop).toBe(true);
  });

  it("refuses a setting the style does not have", () => {
    expect(refusal(setFillValue(hooped(), "pitchMm", 20))).toMatch(/no setting called pitchMm/);
  });

  it("recolours the fill with a screen colour, and refuses anything else", () => {
    const start = hooped();
    const after = run(start.spec, steps(setFillColour(start, 0, "#c89b23")));
    expect(after.kitPattern?.colours[0]).toEqual({ colour: "", swatch: "#c89b23" });
    expect(refusal(setFillColour(start, 0, "gold"))).toMatch(/not a screen colour/);
    expect(refusal(setFillColour(start, 5, "#c89b23"))).toMatch(/at most/);
  });

  it("takes the fill off the design", () => {
    const start = hooped();
    expect(run(start.spec, steps(removeFill(start))).kitPattern).toBeUndefined();
  });
});

const withGraphic = () =>
  design({}, [
    {
      type: "add-artwork",
      artwork: {
        id: "crest",
        name: "Club crest",
        source: { kind: "text", text: "KW" },
        panelId: "body-front",
        anchor: "left-chest",
        offsetX: 950,
        offsetY: 1500,
        width: 700,
        height: 800,
        rotationDegrees: 0,
        technique: "sublimation",
        provenance: "user-edited",
      },
    } as SpecAction,
  ]);

describe("the Edit Graphic panel", () => {
  it("is nothing at all for a graphic the design does not have", () => {
    expect(graphicView(design(), "crest")).toBeNull();
    expect(refusal(removeGraphic(design(), "crest"))).toMatch(/no such graphic/);
  });

  it("reads the stored tenths of a millimetre as millimetres from the anchor", () => {
    const view = graphicView(withGraphic(), "crest");
    expect(view?.numbers).toEqual([
      { id: "width", label: "Width", unit: "mm", value: 70 },
      { id: "height", label: "Height", unit: "mm", value: 80 },
      { id: "offsetX", label: "X from the anchor", unit: "mm", value: 95 },
      { id: "offsetY", label: "Y from the anchor", unit: "mm", value: 150 },
      { id: "rotationDegrees", label: "Rotation", unit: "degrees", value: 0 },
    ]);
  });

  it("offers only its own panel's anchors, and names the chosen one", () => {
    const view = graphicView(withGraphic(), "crest");
    expect(view?.anchors.map((anchor) => anchor.id)).toEqual(["centre-chest", "left-chest", "right-chest", "lower-front"]);
    expect(view?.anchors.filter((anchor) => anchor.chosen).map((anchor) => anchor.id)).toEqual(["left-chest"]);
    expect(refusal(setGraphicAnchor(withGraphic(), "crest", "upper-back"))).toMatch(/no place called/);
  });

  it("lists the controls the spec asks for that a design cannot store", () => {
    expect(graphicView(withGraphic(), "crest")?.unstored.map((entry) => entry.label)).toEqual(["Colours", "Flip", "Apply to sizes"]);
  });

  it("says why only centring on the anchor can be aligned today", () => {
    expect(graphicView(withGraphic(), "crest")?.alignNote).toMatch(/piece mapper/);
    const start = withGraphic();
    const after = run(start.spec, steps(centreOnAnchor(start, "crest")));
    expect(after.artwork[0]).toMatchObject({ offsetX: 0, offsetY: 0 });
  });

  it("sizes and moves the graphic in millimetres", () => {
    const start = withGraphic();
    expect(run(start.spec, steps(setGraphicNumber(start, "crest", "width", 90))).artwork[0]?.width).toBe(900);
    expect(run(start.spec, steps(setGraphicNumber(start, "crest", "offsetY", -12.5))).artwork[0]?.offsetY).toBe(-125);
  });

  it("keeps the shape when the size lock is on", () => {
    const start = withGraphic();
    const after = run(start.spec, steps(setGraphicNumber(start, "crest", "width", 140, true)));
    expect(after.artwork[0]).toMatchObject({ width: 1400, height: 1600 });
  });

  it("refuses a size of nothing, a rotation off the dial and a value that is not a number", () => {
    const start = withGraphic();
    expect(refusal(setGraphicNumber(start, "crest", "width", 0))).toMatch(/greater than zero/);
    expect(refusal(setGraphicNumber(start, "crest", "rotationDegrees", 400))).toMatch(/0 to 359/);
    expect(refusal(setGraphicNumber(start, "crest", "width", Number.NaN))).toMatch(/not a number/);
  });

  it("turns the graphic to a whole number of degrees", () => {
    const start = withGraphic();
    expect(run(start.spec, steps(setGraphicNumber(start, "crest", "rotationDegrees", 14.6))).artwork[0]?.rotationDegrees).toBe(15);
  });

  it("takes the graphic off the design", () => {
    const start = withGraphic();
    expect(run(start.spec, steps(removeGraphic(start, "crest"))).artwork).toEqual([]);
  });
});

describe("the decoration methods", () => {
  it("offers sublimation for a sublimated article, and locks the rest while no profile lists them", () => {
    const choices = techniqueChoices(unknownDecorationProfile(), "sublimation");
    expect(choices.find((choice) => choice.technique === "sublimation")).toMatchObject({ lockNote: null, ruleId: "R-SUB-001" });
    expect(choices.filter((choice) => choice.lockNote !== null).map((choice) => choice.technique)).toEqual(["transfer", "screen-print", "embroidery"]);
  });

  it("unlocks a method the profile lists", () => {
    const profile = { methods: ["embroidery"] as const, label: "Mahmood Textiles, agreed 2026-10-01." };
    expect(techniqueChoices(profile, "sublimation").find((choice) => choice.technique === "embroidery")?.lockNote).toBeNull();
    const start = withGraphic();
    expect(run(start.spec, steps(setGraphicTechnique(start, "crest", "embroidery", profile))).artwork[0]?.technique).toBe("embroidery");
  });

  it("refuses a method no profile says it can do", () => {
    expect(refusal(setGraphicTechnique(withGraphic(), "crest", "embroidery"))).toMatch(/No factory profile is on file/);
  });

  it("locks sublimation too for an article that is not sublimated", () => {
    expect(techniqueChoices(unknownDecorationProfile(), "sublimation", false).find((choice) => choice.technique === "sublimation")?.lockNote).toMatch(/does not say/);
  });
});

describe("Remove background and Convert to pattern fill", () => {
  it("never make a call, and say plainly that they are not available", async () => {
    expect(standInBackgroundRemoval.credits).toBeNull();
    expect(await standInBackgroundRemoval.remove({ assetId: "a", projectId: "p" })).toEqual({ ok: false, reason: NOT_AVAILABLE });
    expect(graphicActionsNotWired().map((entry) => entry.label)).toEqual(["Remove background", "Convert to pattern fill"]);
  });
});
