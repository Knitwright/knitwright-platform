import type { ArtworkStack, ViewId } from "@/lib/artwork-stack";
import type { ModelImage, TextModelProvider } from "@/lib/providers/text-model";
import { canSpend, FRESH_BUDGET, spend, type Budget } from "./budget";
import type { ImageCleanup } from "./cleanup";
import { dominantColours, type ColourSource, type FoundColour } from "./colours";
import { fitView, type PictureKind, type ViewFit } from "./fit";
import type { Box, Pt } from "./geometry";
import { applyHandleEdits, findLandmarks, type FoundLandmark, type LandmarkHint, type LandmarkSet } from "./landmarks";
import { findOutline, separateViews, type Outline } from "./outline";
import { readPicture, type PictureReading } from "./read";
import { cropMask, cropRaster, type Raster } from "./raster";
import { emptyReport, item, type ImportReport, type ReportItem } from "./report";
import { buildStack } from "./stack";
import type { TemplateSource } from "./template";
import { nameViews, type NamedView } from "./views";

/**
 * The staged reading of one picture (plan W7d). Stage by stage: read the picture, find and name the views,
 * trace each outline, find the landmarks and fit them to the template, read the colours, and build a stack
 * and a report. Every stage gives a confidence and a plain note; every value is read from the picture; and
 * nothing here saves anything: the result is a proposal.
 */

export interface PipelineInput {
  readonly raster: Raster;
  readonly image: ModelImage;
  readonly provider: TextModelProvider;
  readonly templates: TemplateSource;
  /** The pattern size the landmarks are placed in. */
  readonly size: string;
  readonly budget?: Budget;
  readonly cleanup?: ImageCleanup;
  readonly signal?: AbortSignal;
}

/** What is kept of a view so a moved landmark can redo the fit without the picture. Pixels of the analysed picture. */
export interface StoredView {
  readonly view: ViewId;
  readonly box: Box;
  readonly polygon: readonly Pt[];
  readonly landmarks: LandmarkSet;
  readonly kind: PictureKind;
}

export interface StoredLandmarks {
  readonly picture: { readonly width: number; readonly height: number };
  readonly size: string;
  readonly views: readonly StoredView[];
}

export interface ImportOutcome {
  readonly stack: ArtworkStack | null;
  readonly report: ImportReport;
  readonly stored: StoredLandmarks;
  readonly budget: Budget;
}

const shift = (set: LandmarkSet, dx: number, dy: number): FoundLandmark[] => set.map((l) => ({ ...l, at: { x: l.at.x + dx, y: l.at.y + dy } }));

const pictureKind = (reading: PictureReading): PictureKind => (reading.kind === "worn-photo" ? "photo" : "flat");

function hintsFor(reading: PictureReading, view: ViewId, picture: Raster): LandmarkHint[] {
  return reading.guesses
    .filter((guess) => guess.view === view)
    .map((guess) => ({ id: guess.id, side: guess.side, at: { x: guess.x * picture.width, y: guess.y * picture.height } }));
}

interface Analysed {
  readonly stored: StoredView;
  readonly fit: ViewFit | null;
  readonly items: readonly ReportItem[];
  readonly source: ColourSource;
}

function analyseView(named: NamedView, input: PipelineInput, reading: PictureReading): Analysed | null {
  const cropped = cropRaster(input.raster, named.box);
  const outline = findOutline(cropped.raster);
  if (outline.value === null) return null;
  const found = outline.value;
  const hints = hintsFor(reading, named.view, input.raster).map((hint) => ({ ...hint, at: { x: hint.at.x - cropped.x, y: hint.at.y - cropped.y } }));
  const landmarks = findLandmarks(found as Outline, hints);
  const global = shift(landmarks.value, cropped.x, cropped.y);
  const kind = pictureKind(reading);
  const fit = fitView({ view: named.view, landmarks: global, template: input.templates.templateFor(named.view, input.size), kind });
  const marks = reading.marks.filter((mark) => mark.view === named.view).map((mark): Box => ({ x: mark.box.x * input.raster.width - cropped.x, y: mark.box.y * input.raster.height - cropped.y, w: mark.box.w * input.raster.width, h: mark.box.h * input.raster.height }));
  const label = named.view;
  return {
    stored: { view: named.view, box: named.box, polygon: found.polygon.map((p) => ({ x: p.x + cropped.x, y: p.y + cropped.y })), landmarks: global, kind },
    fit: fit.value,
    items: [
      item(`outline-${label}`, "outline", `Outline of the ${label}`, Math.min(outline.confidence, named.confidence + 0.2), outline.note),
      item(`landmarks-${label}`, "landmarks", `Landmarks on the ${label}`, landmarks.confidence, landmarks.note),
      item(`fit-${label}`, "landmarks", `Fit of the ${label} to the template`, fit.confidence, fit.note),
    ],
    source: { raster: cropped.raster, mask: cropMask(found.mask, { x: 0, y: 0, w: cropped.raster.width, h: cropped.raster.height }), exclude: marks },
  };
}

const markLabel = (mark: PictureReading["marks"][number]): string => {
  const names = { number: "Number", name: "Name", crest: "Crest", sponsor: "Sponsor", "sleeve-badge": "Sleeve badge" } as const;
  return `${names[mark.kind]} on the ${mark.view}${mark.text ? `: ${mark.text}` : ""}`;
};

const MARK_NOTE = "Seen in the picture, not placed on the design yet. A crest or sponsor is redrawn from a picture, so replace it with your own file.";

const missingViews = (found: readonly ViewId[]): ImportReport["missing"] => {
  const missing: { view: ViewId; note: string }[] = [];
  if (!found.includes("front")) missing.push({ view: "front", note: "The front is not in your picture, so it is left empty." });
  if (!found.includes("back")) missing.push({ view: "back", note: "The back is not in your picture, so it is left empty." });
  if (!found.some((view) => view.startsWith("sleeve") || view === "collar")) {
    missing.push({ view: "sleeve-left", note: "The sleeves and the collar are not shown as separate views, so they are left empty." });
  }
  return missing;
};

function failed(reading: ImportReport["pictureKind"], note: string, budget: Budget, size: StoredLandmarks["picture"], pieceSize: string, extra: readonly ReportItem[] = []): ImportOutcome {
  const report = emptyReport({
    pictureKind: reading,
    items: [item("reading", "reading", "Reading the picture", 0, note), ...extra],
    warnings: [note],
    used: budget,
  });
  return { stack: null, report, stored: { picture: size, size: pieceSize, views: [] }, budget };
}

/** Finds the views, with one image-model clean-up if there are none and a clean-up is allowed. */
async function viewsOf(input: PipelineInput, reading: PictureReading, budget: Budget): Promise<{ raster: Raster; views: readonly NamedView[]; note: string; budget: Budget; cleaned: boolean }> {
  const first = nameViews(input.raster, separateViews(input.raster).boxes, reading);
  if (first.views.length > 0 || !input.cleanup || !canSpend(budget, "edit")) return { raster: input.raster, ...first, budget, cleaned: false };
  const task = reading.kind === "worn-photo" ? "flatten-photo" : "remove-person-or-hanger";
  const raster = await input.cleanup.run(input.raster, task, input.signal);
  const again = nameViews(raster, separateViews(raster).boxes, reading);
  return { raster, ...again, budget: spend(budget, "edit"), cleaned: true };
}

/** Runs every stage on a picture. A failed model call is thrown so the route can refund it. */
export async function importFromPicture(input: PipelineInput): Promise<ImportOutcome> {
  const picture = { width: input.raster.width, height: input.raster.height };
  const read = await readPicture({ provider: input.provider, image: input.image, budget: input.budget ?? FRESH_BUDGET, signal: input.signal });
  const reading = read.reading.value;
  if (reading === null) return failed("unknown", read.reading.note, read.budget, picture, input.size);
  const found = await viewsOf(input, reading, read.budget);
  const readingItem = item("reading", "reading", `Reading the picture: ${reading.kind}`, read.reading.confidence, read.reading.note);
  if (found.views.length === 0) return failed(reading.kind, "The garment could not be told apart from the background. Use a picture where the garment stands out from a plain background.", found.budget, picture, input.size, [readingItem]);
  const work = { ...input, raster: found.raster };
  const analysed = found.views.map((view) => analyseView(view, work, reading)).filter((entry): entry is Analysed => entry !== null);
  const names = analysed.map((entry) => entry.stored.view);
  const colours = dominantColours(analysed.map((entry) => entry.source));
  const stack = buildStack({ views: names, colours: colours.value as readonly FoundColour[] });
  const items = [
    readingItem,
    item("views", "views", `Views found: ${names.join(", ") || "none"}`, found.views.length === 0 ? 0 : Math.min(...found.views.map((v) => v.confidence)), found.note || "Each view was found as a separate region of the picture."),
    ...analysed.flatMap((entry) => entry.items),
    item("colours", "colours", `Colours read: ${colours.value.length}`, colours.confidence, colours.note, { layerId: stack ? "ground" : undefined }),
    ...reading.marks.map((mark, at) => item(`mark-${at}`, "marks", markLabel(mark), 0.4, MARK_NOTE)),
    ...(found.cleaned ? [item("cleanup", "outline", "Picture cleaned up by an image model", 0.5, "An image model removed things around the garment. Those pixels are generated, not yours.", { generated: true })] : []),
  ];
  const warnings = [
    ...(reading.kind === "worn-photo" ? ["This is a photo, so the result is approximate."] : []),
    ...(reading.flaggedText > 0 ? ["Some words in the picture looked like instructions. They were read as words only and left out."] : []),
    ...(names.length < found.views.length ? ["One region of the picture could not be traced and was left out."] : []),
  ];
  const report = emptyReport({
    pictureKind: reading.kind,
    items,
    missing: missingViews(names),
    warnings,
    used: found.budget,
    fittedTo: input.templates.description,
  });
  return { stack, report, stored: { picture, size: input.size, views: analysed.map((entry) => entry.stored) }, budget: found.budget };
}

/** Redoes the fit of one view after a person moved landmarks. Nothing but the stored landmarks is needed. */
export function refitView(
  stored: StoredLandmarks,
  view: ViewId,
  edits: readonly LandmarkHint[],
  templates: TemplateSource,
): { readonly stored: StoredLandmarks; readonly fit: ViewFit | null; readonly item: ReportItem } | null {
  const current = stored.views.find((entry) => entry.view === view);
  if (!current) return null;
  const landmarks = applyHandleEdits(current.landmarks, edits);
  const fit = fitView({ view, landmarks, template: templates.templateFor(view, stored.size), kind: current.kind });
  const next: StoredLandmarks = { ...stored, views: stored.views.map((entry) => (entry.view === view ? { ...entry, landmarks } : entry)) };
  return { stored: next, fit: fit.value, item: item(`fit-${view}`, "landmarks", `Fit of the ${view} to the template`, fit.confidence, fit.note) };
}
