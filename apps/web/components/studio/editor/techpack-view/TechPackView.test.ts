import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { designWith, drawnCallout, drawnPom, slotProps } from "./fixtures";
import TechPackView from "./TechPackView";

/**
 * The tech pack view panel, drawn from the slot contract alone. Since v3.9 (plan v6 G2, decision
 * 0151) it is the tech pack editor: seven tabs, the unit toggle, the points and callouts on the
 * garment, and the eleven v2.2 tabs folded in. The numbers and words are the view model's, which
 * has its own tests (`lib/techpack/view/**`, `lib/techpack/editor/**`).
 */

const html = (patch: Parameters<typeof slotProps>[0] = {}): string => renderToStaticMarkup(createElement(TechPackView, slotProps(patch)));

const count = (markup: string, id: string): number => Number(new RegExp(`data-testid="legend-${id}" data-count="(\\d+)"`).exec(markup)?.[1] ?? "-1");

describe("the tech pack panel", () => {
  it("draws the seven tabs of spec screen 30 as one tab list", () => {
    const markup = html();
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('aria-label="Tech pack tabs"');
    for (const label of ["Overview", "Body", "Measurements", "Materials", "Callouts", "Artworks", "Labels"]) expect(markup, label).toContain(`>${label}</button>`);
    const tabs = /aria-label="Tech pack tabs"[^]*?<\/div>/.exec(markup)?.[0] ?? "";
    expect((tabs.match(/role="tab"/g) ?? []).length).toBe(7);
  });

  it("opens on the Overview tab, with exactly one tab chosen and one panel for it", () => {
    const markup = html();
    expect(markup).toContain('id="techpack-tab-overview"');
    expect(markup).toContain('id="techpack-panel-overview"');
    expect(markup).toContain('role="tabpanel"');
  });

  it("keeps the Review tab's content on Overview, under Still to fill", () => {
    const markup = html();
    expect(markup).toContain("Still to fill");
    expect(markup).toContain('data-testid="tp-review"');
  });

  it("offers the mm, cm and inch toggle, with the whole word for a screen reader", () => {
    const markup = html();
    expect(markup).toContain('data-testid="techpack-units"');
    for (const word of ["millimetres", "centimetres", "inches"]) expect(markup, word).toContain(word);
    expect((markup.match(/role="radio"/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("draws the red points and the blue callouts on the garment", () => {
    const markup = html();
    expect(markup).toContain('data-testid="tp-point-A"');
    expect(markup).toContain('data-testid="tp-callout-1"');
    expect(markup).toContain("Check fit");
    expect(markup).toContain("Preview sheets");
  });

  it("shows the four sources with a count each", () => {
    const markup = html();
    expect(markup).toContain('data-testid="techpack-legend"');
    for (const id of ["from_base", "from_design", "needs_input", "confirmed"]) expect(count(markup, id), id).toBeGreaterThanOrEqual(0);
  });

  it("draws the panel for a design the catalogue does not cover, without inventing anything", () => {
    const markup = html({ article: null, sizes: [] });
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain("Needs your input");
    expect(markup).not.toContain('data-testid="tp-point-A"');
  });

  it("reads the marks the Specs toolbar drew from the design, so a reload shows them again", () => {
    const before = count(html(), "needs_input");
    const spec = designWith(slotProps().design.spec, [drawnPom({ id: "m1", tool: "measure-point", lengthMm: null })]);
    expect(before).toBeGreaterThan(0);
    expect(count(html({ spec }), "needs_input")).toBeGreaterThan(before);
  });

  it("counts a callout the design holds as the person's own, and numbers it on the garment", () => {
    const spec = designWith(slotProps().design.spec, [drawnCallout()]);
    const markup = html({ spec });
    expect(count(markup, "from_design")).toBeGreaterThan(count(html(), "from_design"));
  });

  it("holds none of the words that would make a tab read as settled", () => {
    expect(html()).not.toMatch(/\b(verified|approved|production[- ]ready|certified)\b/i);
  });
});
