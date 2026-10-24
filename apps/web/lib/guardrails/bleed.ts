import { offsetOutline, round1 } from "./geometry";
import { sourceNote } from "./settings";
import type { Box, Finding, GuardrailSettings, Panel, PlacedItem, Point } from "./types";

/** The region a panel's artwork must reach: the cut outline pushed outward by the bleed. Added automatically to every panel. */
export const bleedOutline = (cutOutline: readonly Point[], bleedMm: number): Point[] => offsetOutline(cutOutline, bleedMm);

const beyond = (box: Box, [x, y]: Point): number => Math.max(box.x0 - x, x - box.x1, box.y0 - y, y - box.y1, 0);

/**
 * For each fill on the panel (ground or pattern), how far it stops short of the bleed region. The fill's box is
 * compared with the bleed outline's points, so a fill with a non-rectangular edge is judged by its box.
 */
export function bleedCheck(panel: Panel, items: readonly PlacedItem[], settings: GuardrailSettings): Finding[] {
  const bleed = settings.bleedMm.value;
  const region = bleedOutline(panel.cutOutline, bleed);
  const out: Finding[] = [];
  for (const it of items) {
    if (it.panelId !== panel.id || it.kind !== "fill") continue;
    const worst = region.reduce<{ gap: number; at: Point }>((best, p) => {
      const gap = beyond(it.box, p);
      return gap > best.gap ? { gap, at: p } : best;
    }, { gap: 0, at: region[0] as Point });
    if (worst.gap < 0.05) continue;
    out.push({
      code: "bleed-short",
      check: "bleed",
      severity: "warning",
      panel: panel.id,
      itemId: it.id,
      locationMm: { x: round1(worst.at[0]), y: round1(worst.at[1]) },
      message: `${it.label} on ${panel.id} stops up to ${round1(worst.gap)} mm short of the ${bleed} mm bleed (${sourceNote(settings.bleedMm.source)}), so a thin line of fabric may show at the cut.`,
      fix: "Extend the colour or pattern out to the bleed line. The print files add the bleed to the panel, but they cannot invent artwork that is not there.",
    });
  }
  return out;
}
