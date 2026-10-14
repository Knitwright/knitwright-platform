import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PieceSummary } from "@/lib/print/server/summary";
import { ZoneOverlay } from "./ZoneOverlay";

const piece: PieceSummary = {
  view: "front",
  pieceId: "front",
  name: "torso front",
  outline: [[0, -100], [200, -100], [200, 100], [0, 100]],
  zones: [{ id: "crest", purpose: "crest", polygon: [[20, 10], [60, 10], [60, 50], [20, 50]] }],
};

describe("zone overlay", () => {
  it("draws the piece with each zone and names them in words", () => {
    const html = renderToStaticMarkup(createElement(ZoneOverlay, { piece }));
    expect(html).toContain('aria-label="torso front, with crest"');
    expect((html.match(/<polygon/g) ?? []).length).toBe(2);
    expect(html).toContain("stroke-dasharray");
  });
  it("says when a piece has no zones", () => {
    expect(renderToStaticMarkup(createElement(ZoneOverlay, { piece: { ...piece, zones: [] } }))).toContain("with no zones");
  });
});
