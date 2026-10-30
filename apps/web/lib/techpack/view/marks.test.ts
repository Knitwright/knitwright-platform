import { describe, expect, it } from "vitest";
import { GAP_RULE } from "@/lib/kpp/model";
import { SPEC_TOOLS, TOOL_HELP, TOOL_LABELS, TOOL_POINTS, extraPomsFrom, isDrawingTool, isMeasureMark, makeMark, pendingPick, polylineLengthMm } from "./marks";
import { mark } from "./fixtures/views";

/** Spec F-S4's Specs toolbar: Select, Measure point, Measure line, Measure edge, Callout. */
describe("the Specs toolbar's tools", () => {
  it("are the five the spec names, each with a label and one line of help", () => {
    expect(SPEC_TOOLS.map((tool) => TOOL_LABELS[tool])).toEqual(["Select", "Measure point", "Measure line", "Measure edge", "Callout"]);
    for (const tool of SPEC_TOOLS) expect(TOOL_HELP[tool].endsWith("."), tool).toBe(true);
  });

  it("say how many places each needs, and Select needs none because it picks what is drawn", () => {
    expect(TOOL_POINTS).toEqual({ select: 0, "measure-point": 1, "measure-line": 2, "measure-edge": 1, callout: 1 });
    expect(isDrawingTool("select")).toBe(false);
    expect(isDrawingTool("measure-line")).toBe(true);
  });
});

describe("the length of a measured line", () => {
  it("is the length of the picked polyline, in whole millimetres", () => {
    expect(polylineLengthMm([{ panelId: "front", xMm: 0, yMm: 0 }, { panelId: "front", xMm: 30, yMm: 40 }])).toBe(50);
  });

  it("adds every leg of a line picked through three places", () => {
    expect(
      polylineLengthMm([
        { panelId: "front", xMm: 0, yMm: 0 },
        { panelId: "front", xMm: 0, yMm: 100 },
        { panelId: "front", xMm: 50, yMm: 100 },
      ]),
    ).toBe(150);
  });

  it("is nothing at all for fewer than two places, and never a zero", () => {
    expect(polylineLengthMm([])).toBeNull();
    expect(polylineLengthMm([{ panelId: "front", xMm: 10, yMm: 10 }])).toBeNull();
  });
});

describe("what the toolbar asks for while a mark is being drawn", () => {
  it("asks for one place, then says the mark can be kept", () => {
    expect(pendingPick("measure-point", 0).prompt).toBe("Pick one place on a panel.");
    expect(pendingPick("measure-point", 1).ready).toBe(true);
  });

  it("asks for two places for a line, and offers to carry it on once it has them", () => {
    expect(pendingPick("measure-line", 0).prompt).toBe("Pick 2 places on a panel.");
    expect(pendingPick("measure-line", 1).prompt).toBe("Pick one place on a panel.");
    expect(pendingPick("measure-line", 2).prompt).toContain("carry the line on");
  });

  it("asks nothing of Select, which picks what is already drawn", () => {
    const pending = pendingPick("select", 0);
    expect(pending.ready).toBe(false);
    expect(pending.prompt).toBe(TOOL_HELP.select);
  });

  it("says a point can be kept or picked again", () => {
    expect(pendingPick("callout", 1).prompt).toContain("Keep the mark");
  });
});

describe("making a mark", () => {
  it("works a line's length out from its places", () => {
    const made = makeMark({ id: "m", tool: "measure-line", label: "Hem", points: mark().points, drawnOn: "2d" });
    expect(made?.lengthMm).toBe(120);
  });

  it("takes an edge's length from the drawing, because the two places do not hold it", () => {
    const made = makeMark({ id: "m", tool: "measure-edge", label: "Side seam", points: [{ panelId: "front", xMm: 1, yMm: 1 }], drawnOn: "2d", edgeLengthMm: 437.4 });
    expect(made?.lengthMm).toBe(437);
  });

  it("gives an edge no length when the drawing gave none", () => {
    const made = makeMark({ id: "m", tool: "measure-edge", label: "Side seam", points: [{ panelId: "front", xMm: 1, yMm: 1 }], drawnOn: "3d" });
    expect(made?.lengthMm).toBeNull();
    expect(made?.drawnOn).toBe("3d");
  });

  it("gives a point and a callout no length, because neither has one", () => {
    for (const tool of ["measure-point", "callout"] as const) {
      expect(makeMark({ id: "m", tool, label: "x", points: [{ panelId: "front", xMm: 0, yMm: 0 }], drawnOn: "2d" })?.lengthMm).toBeNull();
    }
  });

  it("makes nothing from a half-drawn line, so it cannot reach the tech pack", () => {
    expect(makeMark({ id: "m", tool: "measure-line", label: "Hem", points: [{ panelId: "front", xMm: 0, yMm: 0 }], drawnOn: "2d" })).toBeNull();
    expect(makeMark({ id: "m", tool: "select", label: "Hem", points: [], drawnOn: "2d" })).toBeNull();
  });

  it("names a mark after its panel when the person named it nothing, and drops an empty note", () => {
    const made = makeMark({ id: "m", tool: "callout", label: "  ", note: "  ", points: [{ panelId: "sleeve", xMm: 0, yMm: 0 }], drawnOn: "2d" });
    expect(made?.label).toBe("sleeve");
    expect(made?.note).toBeNull();
  });

  it("keeps a note the person wrote, trimmed", () => {
    const made = makeMark({ id: "m", tool: "callout", label: "Hem", note: "  Twin needle  ", points: [{ panelId: "front", xMm: 0, yMm: 0 }], drawnOn: "2d" });
    expect(made?.note).toBe("Twin needle");
  });
});

describe("the marks that become points of measure", () => {
  it("are the measuring ones; a callout is a note, not a measurement", () => {
    expect(isMeasureMark(mark())).toBe(true);
    expect(isMeasureMark(mark({ tool: "callout" }))).toBe(false);
  });

  it("become extra points with a value at the sample size, no grade and no tolerance", () => {
    const poms = extraPomsFrom([mark(), mark({ id: "m2", tool: "callout" })], () => "Q");
    expect(poms).toEqual([{ letter: "Q", description: "Pocket opening", sampleMm: 120, ruleId: GAP_RULE }]);
  });

  it("carry the note with the label, so the factory reads what the founder meant", () => {
    const poms = extraPomsFrom([mark({ note: "inside the pocket bag" })], () => "Q");
    expect(poms[0]?.description).toBe("Pocket opening — inside the pocket bag");
  });

  it("ask for a measurement when the mark has no length", () => {
    expect(extraPomsFrom([mark({ tool: "measure-point", lengthMm: null })], () => "Q")[0]?.sampleMm).toBeNull();
  });
});
