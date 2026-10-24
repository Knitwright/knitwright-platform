import { boxCorners, boxEdges, boundsOf, edgesOf, pointInPolygon, round1, segmentCross } from "./geometry";
import type { Finding, PlacedItem, Panel, Point } from "./types";

const ARTWORK = new Set(["raster", "vector", "text"]);

function firstSeamHit(box: PlacedItem["box"], poly: readonly Point[]): Point | null {
  for (const edge of boxEdges(box)) {
    for (const seam of edgesOf(poly)) {
      const hit = segmentCross(edge, seam);
      if (hit !== null) return hit;
    }
  }
  return null;
}

function mirrorHit(box: PlacedItem["box"], line: readonly [Point, Point]): Point | null {
  for (const edge of boxEdges(box)) {
    const hit = segmentCross(edge, line);
    if (hit !== null) return hit;
  }
  const inside = line.find(([x, y]) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1);
  return inside ?? null;
}

const finding = (panel: Panel, it: PlacedItem, at: Point, message: string, fix: string): Finding => ({
  code: "seam-cross",
  check: "seam_cross",
  severity: "warning",
  panel: panel.id,
  itemId: it.id,
  locationMm: { x: round1(at[0]), y: round1(at[1]) },
  message,
  fix,
});

/**
 * Artwork whose box crosses a sewn edge, or a line where the panel is mirrored onto its partner, will be cut by
 * the seam and may not meet its other half. A fill is meant to cross seams and is not reported. The check uses the box
 * the artwork occupies, not its drawn pixels, so a picture with empty corners can be flagged when it would not show.
 */
export function seamCrossCheck(panel: Panel, items: readonly PlacedItem[]): Finding[] {
  const poly = panel.sewLine ?? panel.cutOutline;
  const edgeName = panel.sewLine === null ? "cut edge (this pattern has no sewn edge)" : "seam";
  const out: Finding[] = [];
  for (const it of items) {
    if (it.panelId !== panel.id || !ARTWORK.has(it.kind)) continue;
    const corners = boxCorners(it.box);
    const edgeHit = firstSeamHit(it.box, poly);
    const coversPanel = boundsOf(poly).x0 >= it.box.x0 && corners.every((c) => !pointInPolygon(c, poly));
    if (edgeHit !== null && !coversPanel) {
      out.push(finding(panel, it, edgeHit, `${it.label} runs across the ${edgeName} on ${panel.id}, so the seam will cut it.`, "Move it fully inside the seam, or make it smaller. Artwork meant to run across a seam belongs in the pattern fill."));
    }
    for (const line of panel.mirrorLines) {
      const hit = mirrorHit(it.box, line);
      if (hit !== null) out.push(finding(panel, it, hit, `${it.label} crosses the centre seam of ${panel.id}, where the panel is mirrored, so the two halves may not line up.`, "Move it to one side of the centre seam, or place it as a pair, one on each side."));
    }
  }
  return out;
}
