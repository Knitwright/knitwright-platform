import { effectiveDpi, largestWidthMm } from "@/lib/artwork-intake/dpi";
import { round1 } from "./geometry";
import { sourceNote } from "./settings";
import type { Finding, GuardrailSettings, PlacedItem } from "./types";

/**
 * The effective dpi of each raster at its placed width against the minimum. A vector, text, or a raster whose
 * pixel size is not known is not reported (we do not guess a size). Below half the minimum is a blocker.
 */
export function minDpiCheck(items: readonly PlacedItem[], settings: GuardrailSettings): Finding[] {
  const min = settings.minDpi.value;
  const out: Finding[] = [];
  for (const it of items) {
    const width = it.box.x1 - it.box.x0;
    if (it.kind !== "raster" || it.widthPx === undefined || !(width > 0)) continue;
    const dpi = effectiveDpi({ widthPx: it.widthPx }, width);
    if (dpi >= min) continue;
    const largest = Math.round(largestWidthMm({ widthPx: it.widthPx }, min));
    out.push({
      code: "min-dpi",
      check: "dpi",
      severity: dpi < min / 2 ? "blocker" : "warning",
      panel: it.panelId,
      itemId: it.id,
      locationMm: { x: round1((it.box.x0 + it.box.x1) / 2), y: round1((it.box.y0 + it.box.y1) / 2) },
      message: `${it.label} would print at about ${Math.round(dpi)} dpi at this size, under the ${min} dpi minimum (${sourceNote(settings.minDpi.source)}), so it may look soft.`,
      fix: `Use a larger file, or make it no wider than about ${largest} mm.`,
    });
  }
  return out;
}
