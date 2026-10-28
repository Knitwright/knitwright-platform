import { alignment } from "./alignment";
import { medianDeltaE } from "./colour";
import { analysisSize, decodeFrame, readSize, type Frame, type Size } from "./frame";
import { checkProtected } from "./protected-check";
import { erode } from "./planes";
import { pixelsIn, SAMPLE_STEP, toAnalysis, without } from "./regions";
import { resolveThresholds, THRESHOLDS_NOTE, type Thresholds } from "./settings";
import { edgeCorrelation, edgeMap } from "./structure";
import type { CheckInput, CheckName, CheckReport, Finding, Measurement, PanelRegion, Rect } from "./types";

/** The garment mask is shrunk by this many analysis pixels so silhouette edges and soft fringes do not count. */
const EDGE_MARGIN = 4;
/** Marks are cut out of the colour and structure checks with this margin; they have their own check. */
const MARK_MARGIN = 3;

const ORDER: readonly CheckName[] = ["input", "alignment", "colour", "structure", "protected"];

const WHOLE = "garment";
const plain = (n: number): string => n.toFixed(1);

function reportOf(findings: readonly Finding[], measurements: readonly Measurement[]): CheckReport {
  return {
    verdict: findings.length === 0 ? "passed" : "rejected",
    findings,
    failedChecks: ORDER.filter((name) => findings.some((f) => f.check === name)),
    measurements,
    thresholdsNote: THRESHOLDS_NOTE,
  };
}

/** Everything the per-panel checks need, worked out once. */
interface Context {
  readonly reference: Frame;
  readonly generated: Frame;
  readonly size: Size;
  readonly original: Size;
  readonly thresholds: Thresholds;
  readonly marks: readonly Rect[];
  /** Garment pixels away from the silhouette and from the marks. */
  readonly inside: Uint8Array;
}

const panelRects = (input: CheckInput, ctx: { original: Size; size: Size }): { id: string; rect: Rect }[] => {
  const panels: readonly PanelRegion[] = input.panels?.length ? input.panels : [{ id: WHOLE, x: 0, y: 0, width: ctx.original.width, height: ctx.original.height }];
  return panels.flatMap((p) => {
    const rect = toAnalysis(p, ctx.original, ctx.size);
    return rect ? [{ id: p.id, rect }] : [];
  });
};

function colourFindings(ctx: Context, panels: { id: string; rect: Rect }[]): { findings: Finding[]; measurements: Measurement[] } {
  const findings: Finding[] = [];
  const measurements: Measurement[] = [];
  const limit = ctx.thresholds.maxColourDeltaE;
  for (const { id, rect } of panels) {
    const pixels = pixelsIn(rect, ctx.inside, ctx.size.width, SAMPLE_STEP);
    if (pixels.length === 0) {
      measurements.push({ check: "colour", regionId: id, measured: null, threshold: limit, status: "skipped" });
      continue;
    }
    const measured = medianDeltaE(ctx.reference, ctx.generated, pixels);
    const failed = measured > limit;
    measurements.push({ check: "colour", regionId: id, measured, threshold: limit, status: failed ? "failed" : "ok" });
    if (failed) findings.push({ code: "colour_changed", check: "colour", regionId: id, measured, threshold: limit, message: `The colour of ${id} is too far from the design (median difference ${plain(measured)}, limit ${plain(limit)}).` });
  }
  return { findings, measurements };
}

function structureFindings(ctx: Context, panels: { id: string; rect: Rect }[]): { findings: Finding[]; measurements: Measurement[] } {
  const findings: Finding[] = [];
  const measurements: Measurement[] = [];
  const limit = ctx.thresholds.minStructureCorrelation;
  const [refEdges, genEdges] = [edgeMap(ctx.reference), edgeMap(ctx.generated)];
  for (const { id, rect } of panels) {
    const measured = edgeCorrelation(refEdges, genEdges, pixelsIn(rect, ctx.inside, ctx.size.width));
    if (measured === null) {
      measurements.push({ check: "structure", regionId: id, measured: null, threshold: limit, status: "skipped" });
      continue;
    }
    const failed = measured < limit;
    measurements.push({ check: "structure", regionId: id, measured, threshold: limit, status: failed ? "failed" : "ok" });
    if (failed) findings.push({ code: "structure_moved", check: "structure", regionId: id, measured, threshold: limit, message: `Seams, stripes or panel lines in ${id} have moved or gone (match ${measured.toFixed(2)}, needs ${limit.toFixed(2)}).` });
  }
  return { findings, measurements };
}

/** Decodes both pictures to a common analysis size, or answers with the finding that stops the check. */
async function decodePair(input: CheckInput, t: Thresholds): Promise<{ reference: Frame; generated: Frame; original: Size } | Finding> {
  const original = await readSize(input.reference);
  if (!original) throw new RangeError("The reference render could not be opened.");
  const found = await readSize(input.generated);
  if (!found) return { code: "unreadable_generated", check: "input", measured: 0, threshold: 0, message: "The generated picture could not be opened." };
  const difference = Math.abs(found.width / found.height - original.width / original.height);
  if (difference > t.maxAspectDifference) {
    return { code: "canvas_mismatch", check: "input", measured: difference, threshold: t.maxAspectDifference, message: `The generated picture is not on the same canvas as the design (shape differs by ${difference.toFixed(2)}).` };
  }
  const size = analysisSize(original);
  const [reference, generated] = await Promise.all([decodeFrame(input.reference, size), decodeFrame(input.generated, size)]);
  return { reference, generated, original };
}

/**
 * Compares a generated picture with the deterministic render it was made from. Pure and deterministic: the same
 * bytes and settings give the same report. It checks what the reference defines (colour, seams, marks, position)
 * and nothing else. A reference with no garment in it throws; an unusable generated picture is a finding.
 */
export async function checkGeneration(input: CheckInput): Promise<CheckReport> {
  const thresholds = resolveThresholds(input.thresholds);
  const pair = await decodePair(input, thresholds);
  if ("code" in pair) return reportOf([pair], [{ check: "input", measured: pair.measured, threshold: pair.threshold, status: "failed" }]);
  const { reference, generated, original } = pair;
  const size = { width: reference.width, height: reference.height };
  if (!reference.mask.includes(1)) throw new RangeError("The reference render has no garment in it (its alpha channel is empty).");

  const overlap = alignment(reference, generated);
  const aligned = overlap === null || overlap >= thresholds.minMaskOverlap;
  const alignMeasure: Measurement = { check: "alignment", measured: overlap, threshold: thresholds.minMaskOverlap, status: overlap === null ? "skipped" : aligned ? "ok" : "failed" };
  if (!aligned && overlap !== null) {
    const message = `The garment in the generated picture does not sit where the design puts it (overlap ${overlap.toFixed(2)}, needs ${thresholds.minMaskOverlap.toFixed(2)}).`;
    return reportOf([{ code: "not_aligned", check: "alignment", measured: overlap, threshold: thresholds.minMaskOverlap, message }], [alignMeasure]);
  }

  const marks = input.protectedRegions.flatMap((m) => {
    const rect = toAnalysis(m, original, size);
    return rect ? [rect] : [];
  });
  const inside = without(erode(reference.mask, size.width, size.height, EDGE_MARGIN), marks, size, MARK_MARGIN);
  const ctx: Context = { reference, generated, size, original, thresholds, marks, inside };
  const panels = panelRects(input, ctx);
  const colour = colourFindings(ctx, panels);
  const structure = structureFindings(ctx, panels);
  const marked = checkProtected({ reference, generated, original, size, thresholds }, input.protectedRegions);
  return reportOf(
    [...colour.findings, ...structure.findings, ...marked.findings],
    [alignMeasure, ...colour.measurements, ...structure.measurements, ...marked.measurements],
  );
}
