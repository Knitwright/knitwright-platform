import { medianDeltaE } from "./colour";
import type { Frame, Size } from "./frame";
import { matchMark } from "./protected";
import { pixelsIn, SAMPLE_STEP, toAnalysis } from "./regions";
import type { Thresholds } from "./settings";
import type { Finding, Measurement, ProtectedRegion } from "./types";

interface Setup {
  readonly reference: Frame;
  readonly generated: Frame;
  readonly original: Size;
  readonly size: Size;
  readonly thresholds: Thresholds;
}

const KIND_WORD = { crest: "crest", sponsor: "sponsor mark", name: "name", number: "number" } as const;

/** Checks every protected mark: still there, same shape, same colour. A mark off the canvas is a finding too. */
export function checkProtected(setup: Setup, regions: readonly ProtectedRegion[]): { findings: Finding[]; measurements: Measurement[] } {
  const { thresholds: t } = setup;
  const findings: Finding[] = [];
  const measurements: Measurement[] = [];
  const everywhere = new Uint8Array(setup.size.width * setup.size.height).fill(1);
  for (const region of regions) {
    const word = `${KIND_WORD[region.kind]} (${region.id})`;
    const rect = toAnalysis(region, setup.original, setup.size);
    if (!rect) {
      findings.push({ code: "protected_missing", check: "protected", regionId: region.id, measured: 0, threshold: t.minProtectedCorrelation, message: `The ${word} lies outside the canvas, so it could not be compared.` });
      measurements.push({ check: "protected", regionId: region.id, measured: null, threshold: t.minProtectedCorrelation, status: "failed" });
      continue;
    }
    const match = matchMark(setup.reference, setup.generated, rect);
    if (match.correlation === null) {
      measurements.push({ check: "protected", regionId: region.id, measured: null, threshold: t.minProtectedCorrelation, status: "skipped" });
      continue;
    }
    const shapeFailed = match.correlation < t.minProtectedCorrelation;
    measurements.push({ check: "protected", regionId: region.id, measured: match.correlation, threshold: t.minProtectedCorrelation, status: shapeFailed ? "failed" : "ok" });
    if (shapeFailed) {
      const code = match.blank ? "protected_missing" : "protected_warped";
      const what = match.blank ? "is missing" : "has been warped or redrawn";
      findings.push({ code, check: "protected", regionId: region.id, measured: match.correlation, threshold: t.minProtectedCorrelation, message: `The ${word} ${what} (match ${match.correlation.toFixed(2)}, needs ${t.minProtectedCorrelation.toFixed(2)}).` });
      continue;
    }
    const shift = medianDeltaE(setup.reference, setup.generated, pixelsIn(rect, everywhere, setup.size.width, SAMPLE_STEP), match.offset);
    if (shift > t.maxProtectedDeltaE) {
      findings.push({ code: "protected_colour_changed", check: "protected", regionId: region.id, measured: shift, threshold: t.maxProtectedDeltaE, message: `The colours of the ${word} have changed (median difference ${shift.toFixed(1)}, limit ${t.maxProtectedDeltaE.toFixed(1)}).` });
    }
  }
  return { findings, measurements };
}
