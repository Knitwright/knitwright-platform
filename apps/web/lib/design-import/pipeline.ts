import { VIEW_IDS, type ArtworkStack, type Layer, type PieceMapper, type StackColour, type ViewId } from "@/lib/artwork-stack";
import type { ModelImageType, TextModelProvider } from "@/lib/providers/text-model";
import { buildReport, buildStack } from "./assemble";
import type { Budget } from "./budget";
import type { CleanUp } from "./cleanup";
import { clusterColours, colourConfidence, toStackColours } from "./colours";
import { fitView, onPieceFraction, toDesign, warpToDesign, type ViewFit } from "./fit";
import { markRect, readMarks, repairGround, type Crop } from "./marks";
import { NO_OUTLINE } from "./outline";
import type { PatternProposal, PatternStage } from "./pattern";
import { readPicture, type Reading } from "./read";
import { decodeRaster, type Raster } from "./raster";
import type { ImportReport, ReportItem } from "./report";
import type { LandmarkTemplate } from "./template";
import { round2, type Pt, type ViewLandmarks } from "./types";
import { analyseViews, type ViewAnalysis, type ViewFailure } from "./views";
import { STAND_IN_SENTENCE } from "./template";

/**
 * The staged pipeline (plan W7d). Every stage gives a confidence and a plain note; every value is read from the
 * picture; nothing is saved here. The pieces it needs from outside come in as `deps`, so a test can use recorded
 * replies and fakes and the route can use the providers.
 */

export interface PipelineDeps {
  /** Null when no vision model is configured. */
  readonly provider: TextModelProvider | null;
  readonly template: LandmarkTemplate;
  readonly mapper: PieceMapper;
  readonly pattern: PatternStage;
  readonly cleanup: CleanUp | null;
  readonly budget: Budget;
  /** True when the template is the stand-in until the real pattern pieces are connected. */
  readonly standIn: boolean;
}

export interface PipelineInput {
  readonly bytes: Uint8Array;
  readonly mediaType: ModelImageType;
  /** A reading kept from an earlier run: redoing a fit after the user moves a landmark costs no vision call. */
  readonly reading?: Reading;
  /** Landmarks the user moved, as fractions of the picture. */
  readonly edits?: ViewLandmarks;
  readonly signal?: AbortSignal;
}

export interface OverlayMark {
  readonly layerId: string;
  readonly view: ViewId;
  readonly kind: string;
  readonly text: string | null;
  readonly box: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  /** The screen colour of the mark's ink, when it has one. */
  readonly ink: string | null;
}

export interface Overlay {
  readonly marks: readonly OverlayMark[];
  readonly views: readonly {
    readonly view: ViewId;
    readonly outline: readonly Pt[];
    readonly landmarks: readonly { readonly id: string; readonly x: number; readonly y: number; readonly confidence: number; readonly source: string }[];
    readonly model: string;
  }[];
}

export type ImportOutcome =
  | {
      readonly ok: true;
      readonly stack: ArtworkStack;
      readonly report: ImportReport;
      readonly reading: Reading;
      readonly overlay: Overlay;
      readonly crops: readonly Crop[];
    }
  | { readonly ok: false; readonly reason: string; readonly spend: ImportReport["spend"] };

export const NO_PROVIDER = "Reading pictures is not switched on yet. Nothing was changed.";
export const NOTHING_FITTED = "No garment could be fitted to the pattern in this picture. Nothing was changed.";

const frac = (p: Pt, raster: Raster): Pt => ({ x: round2(p.x / raster.width), y: round2(p.y / raster.height) });

function marksOverlay(reading: Reading, stack: ArtworkStack): OverlayMark[] {
  return reading.marks.flatMap((mark, at): OverlayMark[] => {
    const layer = stack.layers.find((entry) => entry.id === `mark-${at + 1}`);
    if (!layer) return [];
    const colourId = layer.kind === "text" || layer.kind === "player-mark" ? layer.colourId : undefined;
    const ink = stack.colours.find((c) => c.id === colourId)?.screen ?? null;
    return [{ layerId: layer.id, view: mark.view, kind: mark.kind, text: mark.text ?? null, box: mark.box, ink }];
  });
}

function overlayOf(analyses: readonly ViewAnalysis[], fits: ReadonlyMap<ViewId, ViewFit>, raster: Raster, marks: readonly OverlayMark[]): Overlay {
  return {
    marks,
    views: analyses
      .filter((a) => fits.has(a.view))
      .map((a) => ({
        view: a.view,
        outline: a.outline.polygon.map((p) => frac(p, raster)),
        landmarks: (Object.keys(a.points) as (keyof typeof a.points)[]).map((id) => ({ id, ...frac(a.points[id] as Pt, raster), confidence: a.confidence[id] ?? 0, source: a.sources[id] ?? "found" })),
        model: fits.get(a.view)?.model ?? "affine",
      })),
  };
}

function fitAll(analyses: readonly ViewAnalysis[], deps: PipelineDeps, kind: Reading["kind"]): { fits: Map<ViewId, ViewFit>; failed: ViewFailure[] } {
  const fits = new Map<ViewId, ViewFit>();
  const failed: ViewFailure[] = [];
  for (const a of analyses) {
    const result = fitView(a.view, a, deps.template, kind);
    if (result.ok) fits.set(a.view, result.fit);
    else failed.push({ view: a.view, sentence: result.reason });
  }
  return { fits, failed };
}

function fitItems(analyses: readonly ViewAnalysis[], fits: ReadonlyMap<ViewId, ViewFit>, deps: PipelineDeps): ReportItem[] {
  return analyses.flatMap((a): ReportItem[] => {
    const fit = fits.get(a.view);
    if (!fit) return [];
    const onPiece = onPieceFraction(fit, a.outline.polygon, deps.mapper, deps.template.size);
    const notes = [...a.notes, ...fit.notes, ...(onPiece < 0.8 ? [`Only ${Math.round(onPiece * 100)}% of the outline lands on the pattern piece, so the fit is rough.`] : [])];
    return [{ id: `fit-${a.view}`, label: `${a.view === "front" ? "Front" : "Back"} fitted to the pattern`, confidence: round2(fit.confidence * a.outline.confidence), note: [`Landmarks used: ${fit.used.join(", ")}.`, ...notes].join(" ") }];
  });
}

const guessedWords = (analyses: readonly ViewAnalysis[]): string[] =>
  analyses.flatMap((a) =>
    (Object.keys(a.sources) as (keyof typeof a.sources)[]).filter((id) => a.sources[id] === "guess").map((id) => `The ${id} on the ${a.view} is the model's guess, not found in the picture.`),
  );

async function patternsFor(raster: Raster, fits: ReadonlyMap<ViewId, ViewFit>, analyses: readonly ViewAnalysis[], colours: readonly StackColour[], deps: PipelineDeps): Promise<PatternProposal[]> {
  if (!deps.pattern.reads) return [];
  const out: PatternProposal[] = [];
  for (const a of analyses) {
    const fit = fits.get(a.view);
    if (!fit) continue;
    const design = a.outline.polygon.map((p) => toDesign(fit, p));
    const area = { minX: Math.min(...design.map((p) => p.x)), minY: Math.min(...design.map((p) => p.y)), maxX: Math.max(...design.map((p) => p.x)), maxY: Math.max(...design.map((p) => p.y)) };
    const stepMm = Math.max(1, (area.maxX - area.minX) / 200);
    const proposal = await deps.pattern.find({ view: a.view, flat: warpToDesign(raster, fit, area, stepMm), stepMm, colours });
    if (proposal) out.push(proposal);
  }
  return out;
}

/** The raster to work on: the original, or the image model's clean-up when the outline cannot be found and the budget allows. */
async function workingRaster(input: PipelineInput, raster: Raster, reading: Reading, deps: PipelineDeps) {
  const first = analyseViews(raster, reading, deps.template, input.edits);
  const missing = first.failures.some((f) => f.sentence.includes(NO_OUTLINE));
  if (!missing || !deps.cleanup) return { raster, generated: false, ...first };
  const cleaned = await deps.cleanup.run(input.bytes, input.signal);
  if (!cleaned.ok) return { raster, generated: false, ...first, note: cleaned.reason };
  const second = analyseViews(cleaned.raster, reading, deps.template, input.edits);
  return second.analyses.length > first.analyses.length ? { raster: cleaned.raster, generated: true, ...second } : { raster, generated: false, ...first };
}

export async function runImport(input: PipelineInput, deps: PipelineDeps): Promise<ImportOutcome> {
  const spend = (): ImportReport["spend"] => deps.budget.spent();
  let reading = input.reading;
  const notes: string[] = [];
  if (!reading) {
    if (!deps.provider) return { ok: false, reason: NO_PROVIDER, spend: spend() };
    const read = await readPicture({ image: { mediaType: input.mediaType, base64: Buffer.from(input.bytes).toString("base64") }, provider: deps.provider, budget: deps.budget, signal: input.signal });
    if (!read.ok) return { ok: false, reason: read.reason, spend: spend() };
    reading = read.reading;
    notes.push(...read.notes);
  }
  const base = await decodeRaster(input.bytes);
  const work = await workingRaster(input, base, reading, deps);
  const { fits, failed } = fitAll(work.analyses, deps, reading.kind);
  const fitted = work.analyses.filter((a) => fits.has(a.view));
  if (fitted.length === 0) return { ok: false, reason: `${NOTHING_FITTED} ${[...work.failures, ...failed].map((f) => f.sentence).join(" ")}`.trim(), spend: spend() };

  const markRects = reading.marks.filter((m) => fits.has(m.view)).map((m) => markRect(m, work.raster));
  const repaired = repairGround(work.raster, markRects);
  const union = new Uint8Array(work.raster.width * work.raster.height);
  for (const a of fitted) a.outline.mask.forEach((v, at) => (union[at] |= v));
  const clusters = clusterColours(repaired, union);
  if (clusters.length === 0) return { ok: false, reason: NOTHING_FITTED, spend: spend() };
  const photo = reading.kind === "worn-photo";
  const marks = readMarks({ marks: reading.marks, readingConfidence: reading.confidence, raster: work.raster, fits, template: deps.template, colours: toStackColours(clusters) });
  const proposals = await patternsFor(repaired, fits, fitted, marks.colours, deps);
  const layers: Layer[] = [...proposals.flatMap((p) => [p.layer]), ...marks.layers];
  const views = fitted.map((a) => a.view);
  const built = buildStack(views, marks.colours, layers);
  if (!built.ok) return { ok: false, reason: built.reason, spend: spend() };

  const absent = VIEW_IDS.filter((v) => !reading.views.some((entry) => entry.view === v));
  const failures = [...work.failures, ...failed];
  const report = buildReport({
    kind: reading.kind,
    readingConfidence: reading.confidence,
    fits: [...fits.values()],
    fitItems: fitItems(work.analyses, fits, deps),
    groundItem: { id: "ground", layerId: "ground", label: "Ground and colours", confidence: colourConfidence(clusters, photo), note: `${clusters.length} ${clusters.length === 1 ? "colour" : "colours"} read as screen colours. No colour codes are guessed: type your own.` },
    markItems: marks.items,
    proposals,
    patternReads: deps.pattern.reads,
    absent,
    failed: failures.filter((f) => !absent.includes(f.view)),
    notes: [...notes, ...("note" in work && work.note ? [work.note] : []), ...(work.generated ? ["The outline was found after an image model cleaned the picture up, so the colours are from generated pixels. Generated pixels are used as print artwork only if you accept them."] : [])],
    guessed: [...guessedWords(fitted), ...(deps.standIn ? [STAND_IN_SENTENCE] : [])],
    fittedTo: deps.template.description,
    generatedPixels: work.generated,
    spend: spend(),
    layerCount: built.stack.layers.length,
  });
  return { ok: true, stack: built.stack, report, reading, overlay: overlayOf(fitted, fits, work.raster, marksOverlay(reading, built.stack)), crops: marks.crops };
}
