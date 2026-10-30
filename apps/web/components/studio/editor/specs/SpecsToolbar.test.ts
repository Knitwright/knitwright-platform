import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { slotProps } from "../techpack-view/fixtures";
import { marksKey, readMarks, resetMarks, writeMarks } from "./marks-store";
import { PICKING_VIEWS, listenForPicks, pickingNote, reportPick, resetPicks } from "./pick-bus";
import SpecsToolbar from "./SpecsToolbar";

/**
 * The Specs toolbar panel (spec F-S4). Its thinking is in `lib/techpack/view/marks.ts`, which has
 * its own tests; what is tested here is that the panel offers the five tools, asks for a place in a
 * way a keyboard can reach, and says plainly that a mark is not saved with the design.
 */

const html = (patch: Parameters<typeof slotProps>[0] = {}): string => renderToStaticMarkup(createElement(SpecsToolbar, slotProps(patch)));

describe("the Specs toolbar panel", () => {
  beforeEach(() => {
    resetMarks();
    resetPicks();
  });

  it("offers the five tools of the spec, as one radio group with help on each", () => {
    const markup = html();
    expect(markup).toContain('data-testid="specs-tools"');
    expect(markup).toContain('role="radiogroup"');
    for (const label of ["Select", "Measure point", "Measure line", "Measure edge", "Callout"]) expect(markup, label).toContain(label);
    expect((markup.match(/type="radio"/g) ?? []).length).toBe(5);
  });

  it("starts on Select, which draws nothing, so it shows no picker", () => {
    const markup = html();
    expect(markup).toContain("Pick a mark that is already on the drawing.");
    expect(markup).not.toContain('data-testid="specs-picker"');
  });

  it("says plainly that a mark is not saved with the design", () => {
    expect(html()).toContain('data-testid="specs-not-saved"');
    expect(html()).toContain("a reload loses it");
  });

  it("says nothing is drawn yet, and lists what is", () => {
    expect(html()).toContain('data-testid="specs-marks-none"');
    const props = slotProps();
    writeMarks(marksKey(props.design.projectId, props.design.version), [
      { id: "m1", tool: "measure-line", label: "Pocket opening", note: null, points: [], lengthMm: 120, drawnOn: "2d" },
    ]);
    const markup = renderToStaticMarkup(createElement(SpecsToolbar, props));
    expect(markup).toContain('data-testid="specs-marks"');
    expect(markup).toContain("Pocket opening");
    expect(markup).toContain("120 mm");
    expect(markup).toContain("Take off");
  });

  it("gives every control a label and a tappable height", () => {
    const markup = html();
    expect((markup.match(/min-h-10/g) ?? []).length).toBeGreaterThan(5);
    expect(markup).not.toContain("<button></button>");
  });
});

describe("the marks two panels share", () => {
  beforeEach(resetMarks);

  it("start empty for a design, and are kept per design and version", () => {
    expect(readMarks(marksKey("p", 1))).toEqual([]);
    writeMarks(marksKey("p", 1), [{ id: "m", tool: "callout", label: "A", note: null, points: [], lengthMm: null, drawnOn: "2d" }]);
    expect(readMarks(marksKey("p", 1))).toHaveLength(1);
    expect(readMarks(marksKey("p", 2))).toEqual([]);
    expect(readMarks(marksKey("q", 1))).toEqual([]);
  });

  it("are emptied by writing none, and the same empty list is given every time", () => {
    writeMarks(marksKey("p", 1), [{ id: "m", tool: "callout", label: "A", note: null, points: [], lengthMm: null, drawnOn: "2d" }]);
    writeMarks(marksKey("p", 1), []);
    expect(readMarks(marksKey("p", 1))).toBe(readMarks(marksKey("p", 2)));
  });

  it("name a design version in a way that tells two versions apart", () => {
    expect(marksKey("p", 1)).not.toBe(marksKey("p", 2));
  });
});

describe("where a place picked on a view arrives", () => {
  beforeEach(resetPicks);

  it("tells every listener where the person picked", () => {
    const heard: unknown[] = [];
    const stop = listenForPicks((point) => heard.push(point));
    reportPick({ panelId: "front", xMm: 10, yMm: 20 });
    expect(heard).toEqual([{ panelId: "front", xMm: 10, yMm: 20 }]);
    stop();
    reportPick({ panelId: "front", xMm: 30, yMm: 40 });
    expect(heard).toHaveLength(1);
  });

  it("says which views report a click, read from the list rather than written out", () => {
    expect(PICKING_VIEWS.map((entry) => entry.view)).toEqual(["2d", "3d"]);
    expect(PICKING_VIEWS.every((entry) => entry.reports)).toBe(false);
    expect(pickingNote()).toContain("No view reports where you click yet");
  });
});
