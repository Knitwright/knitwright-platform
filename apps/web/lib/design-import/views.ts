import type { LandmarkId } from "@/lib/production/contract";
import type { ViewId } from "@/lib/artwork-stack";
import { findBodyLandmarks } from "./landmarks";
import { findOutline, type OutlineResult, type Rect } from "./outline";
import type { Reading } from "./read";
import type { Raster } from "./raster";
import { emptyViewSentence } from "./report";
import type { LandmarkTemplate } from "./template";
import type { LandmarkSet, Pt, ViewLandmarks } from "./types";

/** Step 3 and the first half of step 4 for every view in the picture: outline, then landmarks seeded by the model's guesses and moved by the user. */

type Source = "found" | "guess" | "moved";

export interface ViewAnalysis {
  readonly view: ViewId;
  readonly outline: Extract<OutlineResult, { ok: true }>;
  readonly points: LandmarkSet;
  readonly confidence: Readonly<Partial<Record<LandmarkId, number>>>;
  readonly sources: Readonly<Partial<Record<LandmarkId, Source>>>;
  readonly notes: readonly string[];
}

export interface ViewFailure {
  readonly view: ViewId;
  readonly sentence: string;
}

const MIN_SIDE = 24;

function regionOf(raster: Raster, box: { x: number; y: number; w: number; h: number }): Rect {
  const x0 = Math.min(raster.width - MIN_SIDE, Math.floor(box.x * raster.width));
  const y0 = Math.min(raster.height - MIN_SIDE, Math.floor(box.y * raster.height));
  return {
    x0: Math.max(0, x0),
    y0: Math.max(0, y0),
    x1: Math.min(raster.width, Math.max(x0 + MIN_SIDE, Math.ceil((box.x + box.w) * raster.width))),
    y1: Math.min(raster.height, Math.max(y0 + MIN_SIDE, Math.ceil((box.y + box.h) * raster.height))),
  };
}

const BODY: readonly ViewId[] = ["front", "back"];

/** Landmarks the picture did not give take the model's guess (low certainty); a landmark the user moved wins. */
function merge(found: ReturnType<typeof findBodyLandmarks>, guess: Reading["landmarks"], view: ViewId, raster: Raster, template: LandmarkTemplate, moved: LandmarkSet) {
  const points: Partial<Record<LandmarkId, Pt>> = { ...found.points };
  const confidence: Partial<Record<LandmarkId, number>> = { ...found.confidence };
  const sources: Partial<Record<LandmarkId, Source>> = Object.fromEntries(Object.keys(found.points).map((id) => [id, "found" as const]));
  const guessed = guess?.find((entry) => entry.view === view)?.points ?? {};
  for (const id of Object.keys(template.landmarks(view)) as LandmarkId[]) {
    const g = guessed[id];
    if (points[id] === undefined && g) {
      points[id] = { x: g.x * raster.width, y: g.y * raster.height };
      confidence[id] = 0.3;
      sources[id] = "guess";
    }
    const m = moved[id];
    if (m) {
      points[id] = m;
      confidence[id] = 0.95;
      sources[id] = "moved";
    }
  }
  return { points, confidence, sources };
}

export function analyseViews(
  raster: Raster,
  reading: Reading,
  template: LandmarkTemplate,
  edits: ViewLandmarks = {},
): { readonly analyses: readonly ViewAnalysis[]; readonly failures: readonly ViewFailure[] } {
  const analyses: ViewAnalysis[] = [];
  const failures: ViewFailure[] = [];
  for (const { view, box } of reading.views) {
    if (!BODY.includes(view)) {
      failures.push({ view, sentence: emptyViewSentence(view, "not-fitted") });
      continue;
    }
    const outline = findOutline(raster, regionOf(raster, box));
    if (!outline.ok) {
      failures.push({ view, sentence: `${outline.reason} (${view})` });
      continue;
    }
    const found = findBodyLandmarks({ data: outline.mask, width: raster.width, bbox: outline.bbox }, view);
    const moved: LandmarkSet = Object.fromEntries(
      Object.entries(edits[view] ?? {}).map(([id, p]) => [id, { x: (p as Pt).x * raster.width, y: (p as Pt).y * raster.height }]),
    );
    const merged = merge(found, reading.landmarks, view, raster, template, moved);
    analyses.push({ view, outline, ...merged, notes: found.notes });
  }
  return { analyses, failures };
}
