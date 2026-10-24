import { boxCorners, distanceBoxSegment, edgesOf, pointInPolygon, round1 } from "./geometry";
import { sourceNote } from "./settings";
import type { Finding, GuardrailSettings, Panel, PlacedItem } from "./types";

const MARKS = new Set(["name", "number"]);

/**
 * Names and numbers must sit inside the panel with clear space from its edges and seams. A mark with a corner
 * outside the panel is a blocker; a mark closer than the clear space is a warning. The clear space is a setting.
 */
export function safeZoneCheck(panel: Panel, items: readonly PlacedItem[], settings: GuardrailSettings): Finding[] {
  const poly = panel.sewLine ?? panel.cutOutline;
  const clear = settings.safeZoneMm.value;
  const edgeName = panel.sewLine === null ? "cut edge" : "seam";
  const out: Finding[] = [];
  for (const it of items) {
    if (it.panelId !== panel.id || !MARKS.has(it.kind)) continue;
    const at = { x: round1((it.box.x0 + it.box.x1) / 2), y: round1((it.box.y0 + it.box.y1) / 2) };
    const base = { code: "safe-zone", check: "safe_zone", panel: panel.id, itemId: it.id, locationMm: at } as const;
    if (!boxCorners(it.box).every((c) => pointInPolygon(c, poly))) {
      out.push({ ...base, severity: "blocker", message: `${it.label} reaches past the ${edgeName} of ${panel.id}, so part of it would be cut off or sewn in.`, fix: "Move it inside the panel, or make it smaller." });
      continue;
    }
    const gap = Math.min(...edgesOf(poly).map((edge) => distanceBoxSegment(it.box, edge)));
    if (gap < clear) {
      out.push({ ...base, severity: "warning", message: `${it.label} is ${round1(gap)} mm from the ${edgeName} of ${panel.id}; it needs ${clear} mm of clear space (${sourceNote(settings.safeZoneMm.source)}).`, fix: "Move it away from the edge, or make it smaller. A league may ask for a different clear space." });
    }
  }
  return out;
}
