import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { marksKey, resetMarks, writeMarks } from "../specs/marks-store";
import { slotProps } from "./fixtures";
import TechPackView from "./TechPackView";

/**
 * The tech pack view panel (spec F-S6), drawn from the slot contract alone. The numbers and the
 * words are the view model's, which has its own tests (`lib/techpack/view/**`); what is tested here
 * is that the panel draws them: the eleven tabs, the unit toggle, the chips, the locked grades and
 * the Review tab that holds the export.
 */

const html = (patch: Parameters<typeof slotProps>[0] = {}): string => renderToStaticMarkup(createElement(TechPackView, slotProps(patch)));

describe("the tech pack panel", () => {
  beforeEach(resetMarks);

  it("draws a tab for each of the eleven tabs the spec names, as one tab list", () => {
    const markup = html();
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('aria-label="Tech pack tabs"');
    for (const label of [
      "Overview",
      "Body",
      "Measurements",
      "Materials (BOM)",
      "Callouts",
      "Artworks",
      "Colourways",
      "Personalisation",
      "Labels &amp; packaging",
      "QC",
      "Review",
    ]) {
      expect(markup, label).toContain(label);
    }
    expect((markup.match(/role="tab"/g) ?? []).length).toBe(11);
  });

  it("opens on the Overview tab, with exactly one tab chosen and one panel for it", () => {
    const markup = html();
    expect((markup.match(/aria-selected="true"/g) ?? []).length).toBe(1);
    expect(markup).toContain('id="techpack-panel-overview"');
    expect(markup).toContain('role="tabpanel"');
  });

  it("offers the mm, cm and inch toggle, with the whole word for a screen reader", () => {
    const markup = html();
    expect(markup).toContain('data-testid="techpack-units"');
    for (const word of ["millimetres", "centimetres", "inches"]) expect(markup, word).toContain(word);
    expect((markup.match(/name="techpack-unit"/g) ?? []).length).toBe(3);
  });

  it("shows the four provenance chips with a count each", () => {
    const markup = html();
    expect(markup).toContain('data-testid="techpack-legend"');
    for (const chip of ["From base", "From design", "Needs your input", "Confirmed"]) expect(markup, chip).toContain(chip);
  });

  it("says plainly where a value is missing, and never draws it as a zero", () => {
    expect(html()).toContain("Nobody has given this yet.");
  });

  it("marks the Review tab while something stops the export", () => {
    expect(html()).toContain("something stops the export");
  });

  it("gives every control a label and a tappable height", () => {
    const markup = html();
    expect(markup).not.toContain("<button></button>");
    expect((markup.match(/min-h-10/g) ?? []).length).toBeGreaterThan(10);
  });

  it("draws the panel for a design the catalogue does not cover, without inventing anything", () => {
    const markup = html({ article: null, sizes: [] });
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain("Nobody has given this yet.");
  });

  it("reads the marks the Specs toolbar drew, because the two panels share them", () => {
    const props = slotProps();
    const waiting = (markup: string): number => Number(/chip-needs_input[^]*?<\/span><span>(\d+)<\/span>/.exec(markup)?.[1] ?? "0");
    const before = waiting(renderToStaticMarkup(createElement(TechPackView, props)));
    // A measure point with nothing measured becomes a point of measure that asks for a measurement.
    writeMarks(marksKey(props.design.projectId, props.design.version), [
      { id: "m1", tool: "measure-point", label: "Pocket opening", note: null, points: [{ panelId: "front", xMm: 0, yMm: 0 }], lengthMm: null, drawnOn: "2d" },
    ]);
    const after = waiting(renderToStaticMarkup(createElement(TechPackView, props)));
    expect(before).toBeGreaterThan(0);
    expect(after).toBeGreaterThan(before);
  });

  it("holds none of the words that would make a tab read as settled", () => {
    const markup = html();
    const settled = /\b(verified|approved|production[- ]ready|certified)\b/i;
    expect(markup).not.toMatch(settled);
  });
});
