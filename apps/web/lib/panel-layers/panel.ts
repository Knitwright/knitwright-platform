import type { Panel } from "@/lib/guardrails";
import { JERSEY_EU48 } from "@/lib/production/fixtures";

export const BENCHMARK_PANEL_NOTE =
  "Outline: the front of Knitwright's benchmark jersey, size 48. It is a Knitwright fixture, not your pattern and not from your factory.";

/**
 * The panel the spike edits. A design's own pieces are not yet joined to its views (that needs the piece mapper of
 * decision 0035), so the spike uses a fixed benchmark piece and says so on the screen.
 */
export function benchmarkPanel(): Panel {
  const piece = JERSEY_EU48.piecesBySize["48"]?.find((entry) => entry.id === "front");
  if (piece === undefined) throw new Error("The benchmark jersey has no front piece.");
  return { id: piece.id, cutOutline: piece.cutOutline, sewLine: piece.sewLine, mirrorLines: [] };
}
