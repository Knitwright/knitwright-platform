import { describe, expect, it } from "vitest";
import { applyAction, panelsFor, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { applyItem, runSteps, type ApplyStep, type Applied, type ApplyTarget } from "./apply";
import { design, recorder } from "./fixtures/design";
import { libraryGroups, type LibraryItem } from "./library";

const all = (over = {}): readonly LibraryItem[] =>
  libraryGroups(design(over))
    .flatMap((group) => group.sections)
    .flatMap((section) => section.items);

const pick = (match: (item: LibraryItem) => boolean, over = {}): LibraryItem => {
  const found = all(over).find(match);
  if (!found) throw new Error("No such library item.");
  return found;
};

const ok = (result: Applied): readonly ApplyStep[] => {
  if (!result.ok) throw new Error(result.reason);
  return result.steps;
};

const refusal = (result: Applied): string => {
  if (result.ok) throw new Error("Expected a refusal.");
  return result.reason;
};

const actionsOf = (steps: readonly ApplyStep[]): readonly SpecAction[] => steps.flatMap((step) => (step.kind === "save" ? [step.action] : []));

/** Every action a step asks for, run through the design's own rules: a patch the design refuses is a bug here. */
const run = (spec: GarmentSpec, steps: readonly ApplyStep[]): GarmentSpec =>
  actionsOf(steps).reduce((current, action) => {
    const result = applyAction(current, action);
    if (!result.ok) throw new Error(`${action.type}: ${result.reason}`);
    return result.spec;
  }, spec);

const fabricItem = () => pick((item) => item.code === "F-POLY-INT");
const colourItem = () => pick((item) => item.label.startsWith("Classic club colours · Navy"));
const hoops = () => pick((item) => item.id === "fill-kit-hoops-classic");

describe("applying a fabric", () => {
  it("adds it once and puts it on every panel of the garment", () => {
    const start = design();
    const steps = ok(applyItem(start, fabricItem(), { kind: "all" }));
    expect(actionsOf(steps)[0]?.type).toBe("add-fabric");
    const assigned = actionsOf(steps).filter((action) => action.type === "assign-fabric");
    expect(assigned).toHaveLength(panelsFor(start.spec).length);
    const after = run(start.spec, steps);
    expect(after.fabrics.map((fabric) => fabric.name)).toContain("F-POLY-INT");
    expect(after.panelFabrics.every((entry) => entry.fabricId === after.fabrics.at(-1)?.id)).toBe(true);
  });

  it("puts it on one panel only when it is dragged there", () => {
    const steps = ok(applyItem(design(), fabricItem(), { kind: "panel", panelId: "body-front" }));
    expect(actionsOf(steps).filter((action) => action.type === "assign-fabric")).toEqual([{ type: "assign-fabric", panelId: "body-front", fabricId: "fabric-1" }]);
  });

  it("does not add the same fabric twice", () => {
    const start = design();
    const once = run(start.spec, ok(applyItem(start, fabricItem(), { kind: "all" })));
    const again = ok(applyItem({ ...start, spec: once }, fabricItem(), { kind: "panel", panelId: "body-back" }));
    expect(actionsOf(again).map((action) => action.type)).toEqual(["assign-fabric"]);
  });

  it("stores the article's composition and leaves the weight unset, because the article states a range", () => {
    const [added] = actionsOf(ok(applyItem(design(), fabricItem(), { kind: "all" })));
    expect(added).toMatchObject({ type: "add-fabric", fabric: { name: "F-POLY-INT", weightGsm: null } });
    expect(added?.type === "add-fabric" ? added.fabric.composition : "").toMatch(/100% polyester interlock/);
  });

  it("is refused on a design with no base article", () => {
    expect(refusal(applyItem(design({ article: null }), fabricItem(), { kind: "all" }))).toMatch(/not on a base article/);
  });
});

describe("applying a colour", () => {
  it("sets the screen colour on every panel of the shown colourway, and no colour reference", () => {
    const start = design();
    const steps = ok(applyItem(start, colourItem(), { kind: "all" }));
    const after = run(start.spec, steps);
    const way = after.colourways.find((entry) => entry.id === start.colourwayId);
    expect(way?.colours).toHaveLength(panelsFor(start.spec).length);
    expect(way?.colours.every((entry) => entry.swatch === "#101c3d" && entry.colour === "")).toBe(true);
  });

  it("replaces only the dragged panel's colour and keeps the others", () => {
    const start = design();
    const first = run(start.spec, ok(applyItem(start, colourItem(), { kind: "all" })));
    const sleeveColour = pick((item) => item.label.startsWith("Classic club colours · Gold"));
    const after = run(first, ok(applyItem({ ...start, spec: first }, sleeveColour, { kind: "panel", panelId: "body-front" })));
    const way = after.colourways.find((entry) => entry.id === start.colourwayId);
    expect(way?.colours.find((entry) => entry.panelId === "body-front")?.swatch).toBe("#c89b23");
    expect(way?.colours.filter((entry) => entry.swatch === "#101c3d").length).toBeGreaterThan(0);
  });

  it("refuses anything that is not a screen colour", () => {
    const bad: LibraryItem = { ...colourItem(), apply: { kind: "colour", colour: "Navy", swatch: "navy" } };
    expect(refusal(applyItem(design(), bad, { kind: "all" }))).toMatch(/not a screen colour/);
  });
});

describe("applying a pattern fill", () => {
  it("sets the article's own approved option through the shell, not through a save", () => {
    const option = pick((item) => item.code === "P01");
    expect(ok(applyItem(design(), option, { kind: "all" }))).toEqual([{ kind: "option", group: "pattern_fill", code: "P01" }]);
  });

  it("sets a kit style over the body colour, at the preset's band width", () => {
    const start = design();
    const coloured = run(start.spec, ok(applyItem(start, colourItem(), { kind: "all" })));
    const after = run(coloured, ok(applyItem({ ...start, spec: coloured }, hoops(), { kind: "all" })));
    expect(after.kitPattern).toMatchObject({ style: "hoops", size: 900 });
    expect(after.kitPattern?.colours[0]?.swatch).toBe("#101c3d");
  });

  it("will not put a whole-garment pattern on one panel", () => {
    expect(refusal(applyItem(design(), hoops(), { kind: "panel", panelId: "body-front" }))).toMatch(/whole garment/);
  });

  it("asks for a colour first when the design has none", () => {
    expect(refusal(applyItem(design(), hoops(), { kind: "all" }))).toMatch(/colour first/);
  });

  it("refuses a style the stored design cannot hold, in the library's own words", () => {
    const camo = pick((item) => item.id.startsWith("fill-camo"));
    expect(refusal(applyItem(design(), camo, { kind: "all" }))).toMatch(/repeat maker/);
  });

  it("refuses a kit pattern on a garment that is not a top", () => {
    const shorts = design({ spec: { ...design().spec, typeId: "shorts" } as never });
    expect(refusal(applyItem(shorts, hoops(), { kind: "all" }))).toMatch(/tops/);
  });
});

describe("an item of the wrong kind", () => {
  const target: ApplyTarget = { kind: "all" };

  it("is refused rather than applied as something else", () => {
    expect(refusal(applyItem(design(), { ...fabricItem(), kind: "colour" }, target))).toMatch(/not a colour/);
    expect(refusal(applyItem(design(), { ...colourItem(), kind: "fabric" }, target))).toMatch(/not a fabric/);
    expect(refusal(applyItem(design(), { ...colourItem(), kind: "pattern-fill" }, target))).toMatch(/not a pattern fill/);
  });
});

describe("handing the steps to the shell", () => {
  it("asks for one step per panel of a real change, and gives back its sentence", () => {
    const fabric = pick((item) => item.kind === "fabric");
    const result = applyItem(design(), fabric, { kind: "all" });
    const { commands, calls } = recorder();

    expect(runSteps(result, commands)).toMatch(/every panel/);
    expect(calls).toHaveLength(ok(result).length);
    expect(calls.filter((call) => call.startsWith("save "))).not.toEqual([]);
  });

  it("sends a save through save and an option through setOption, in the order it was given them", () => {
    const { commands, calls } = recorder();
    const steps: readonly ApplyStep[] = [
      { kind: "option", group: "collar", code: "C02" },
      { kind: "save", key: "library-fabric-F-POLY-INT-front", action: { type: "assign-fabric", panelId: "front", fabricId: "fabric-1" } },
    ];

    expect(runSteps({ ok: true, steps, words: "Done." }, commands)).toBe("Done.");
    expect(calls).toEqual(["setOption collar C02", "save library-fabric-F-POLY-INT-front assign-fabric"]);
  });

  it("shows a refusal and asks the shell for nothing at all", () => {
    const { commands, calls } = recorder();

    expect(runSteps({ ok: false, reason: "No." }, commands)).toBe("No.");
    expect(calls).toEqual([]);
  });
});
