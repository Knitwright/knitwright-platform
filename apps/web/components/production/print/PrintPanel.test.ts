import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { overlayModel } from "@/lib/print/zones/overlay";
import { JERSEY_EU48 } from "@/lib/production/fixtures";
import overlayData from "@/lib/print/zones/overlay-data.json";
import { PrintPanel } from "./PrintPanel";

describe("the print files panel", () => {
  const html = renderToStaticMarkup(createElement(PrintPanel));

  it("draws the places for marks on the front, back and sleeve, and names them in plain words", () => {
    expect(html).toContain('data-testid="zone-overlay"');
    expect((html.match(/<svg/g) ?? []).length).toBe(3);
    expect(html).toContain("Number on the back");
    expect(html).toContain("<title>Crest</title>");
  });

  it("offers no download without a design, and never uses the words that read as settled", () => {
    expect(html).not.toContain("/api/projects/");
    expect(html).not.toMatch(/\b(checked|verified|approved|confirmed|final|production-ready|passed|validated|certified)\b/i);
  });

  it("draws what the pattern gives: the stored picture data is the overlay model of the sample jersey", () => {
    expect(overlayData).toEqual(JSON.parse(JSON.stringify(overlayModel(JERSEY_EU48))));
  });

  it("builds the overlay from the pattern: every zone ring is four corners", () => {
    const views = overlayModel(JERSEY_EU48);
    expect(views.map((v) => v.id)).toEqual(["front", "back", "sleeve-left"]);
    expect(views.flatMap((v) => v.zones).every((z) => z.ring.length === 4)).toBe(true);
  });
});

describe("the print files panel and the pattern library", () => {
  it("tells the person where the pieces come from", () => {
    expect(renderToStaticMarkup(createElement(PrintPanel))).toContain("add the pattern for this garment in Patterns first");
  });
});
