import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { designWith, drawnCallout, drawnPom, slotProps } from "../techpack-view/fixtures";
import { PICKING_VIEWS, listenForPicks, pickingNote, reportPick, resetPicks } from "./pick-bus";
import SpecsToolbar from "./SpecsToolbar";

/**
 * The Specs toolbar panel (spec F-S4). Its thinking is in `lib/techpack/view/marks.ts`, which has
 * its own tests; what is tested here is that the panel offers the five tools, asks for a place in a
 * way a keyboard can reach, and lists the marks the design itself holds.
 */

const html = (patch: Parameters<typeof slotProps>[0] = {}): string => renderToStaticMarkup(createElement(SpecsToolbar, slotProps(patch)));

describe("the Specs toolbar panel", () => {
  beforeEach(() => {
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

  it("says a mark is the person's own measurement, and never says it is lost on a reload", () => {
    const markup = html();
    expect(markup).toContain('data-testid="specs-not-graded"');
    expect(markup).toContain("It is saved with the design");
    expect(markup).not.toContain("a reload loses it");
  });

  it("says nothing is drawn yet, and lists the marks the design itself holds", () => {
    expect(html()).toContain('data-testid="specs-marks-none"');
    const spec = designWith(slotProps().design.spec, [drawnPom(), drawnCallout()]);
    const markup = html({ spec });
    expect(markup).toContain('data-testid="specs-marks"');
    expect(markup).toContain("Pocket opening");
    expect(markup).toContain("120 mm");
    expect(markup).toContain("Hem finish");
    expect(markup).toContain("Take off");
    expect(markup).not.toContain('data-testid="specs-marks-none"');
  });

  it("gives every control a label and a tappable height", () => {
    const markup = html();
    expect((markup.match(/min-h-10/g) ?? []).length).toBeGreaterThan(5);
    expect(markup).not.toContain("<button></button>");
  });
});

describe("the marks the panel lists", () => {
  it("gives every Take off button a name of its own, so a screen reader says which mark it takes off", () => {
    const spec = designWith(slotProps().design.spec, [drawnPom(), drawnPom({ id: "m2", label: "Vent length" })]);
    const markup = html({ spec });
    expect(markup).toContain('aria-label="Take off Pocket opening"');
    expect(markup).toContain('aria-label="Take off Vent length"');
  });

  it("disables Take off while a save is in flight, as every other control in the panel is", () => {
    const spec = designWith(slotProps().design.spec, [drawnPom()]);
    expect(html({ spec, busy: true })).toContain("disabled");
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
