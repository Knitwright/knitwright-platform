import type { ViewId } from "@/lib/artwork-stack";
import type { Spend } from "./budget";
import { confidenceWords } from "./types";

/**
 * What the reading found, with how sure it is, and what it left empty or guessed. These sentences are the ones the
 * user always sees (decision 0038): "close reading of your picture", never a claim of an exact copy.
 */

export const CLOSE_READING = "close reading of your picture";

/** The limits, always on screen beside the picture and the drawing. */
export const ACCURACY_LIMITS: readonly string[] = [
  "Shading, folds and light in a photo are baked into the colours.",
  "A worn or angled kit is flattened approximately, and curved fabric is not undone.",
  "Small or stylised lettering may be read wrongly.",
  "Logos are redrawn, not extracted. Replace them with your own file.",
  "A view that is not in the picture, usually the back and sleeves, is left empty and named. It is never invented.",
  "The repeat size of an all-over pattern is estimated, so check it.",
];

export const REPEAT_NOTE = "The size of the repeat is estimated from the picture, so check it.";
export const CROP_FLAG = "Redrawn from a picture, replace with your own file";
export const ALTERNATIVE_NOTE = "Not drawn until you choose it. Choose it instead of the pattern from our list, not as well.";

export interface ReportItem {
  readonly id: string;
  /** The stack layer this item is about, when it is about one. */
  readonly layerId?: string;
  readonly label: string;
  /** 0 to 1. Shown in words, with the number beside it, never as a promise. */
  readonly confidence: number;
  readonly note: string;
}

export interface EmptyView {
  readonly view: ViewId;
  readonly sentence: string;
}

export interface ImportReport {
  readonly summary: string;
  /** What the picture is taken to be and how it was flattened, such as "Photo, approximate". */
  readonly pictureNote: string;
  readonly confidence: number;
  readonly items: readonly ReportItem[];
  readonly emptyViews: readonly EmptyView[];
  readonly notes: readonly string[];
  readonly dpiWarnings: readonly string[];
  /** What was guessed rather than read. */
  readonly guessed: readonly string[];
  readonly fittedTo: string;
  readonly generatedPixels: boolean;
  readonly spend: Spend;
}

const VIEW_WORDS: Readonly<Record<ViewId, string>> = {
  front: "front",
  back: "back",
  "sleeve-left": "left sleeve",
  "sleeve-right": "right sleeve",
  collar: "collar",
};

export const viewWords = (view: ViewId): string => VIEW_WORDS[view];

export function emptyViewSentence(view: ViewId, why: "absent" | "not-fitted"): string {
  return why === "absent"
    ? `The ${viewWords(view)} is not in your picture, so its layers are left empty. Nothing was invented for it.`
    : `The ${viewWords(view)} could not be fitted to the pattern, so its layers are left empty.`;
}

/** Plain words for a confidence, with the number. */
export const confidenceLabel = (value: number): string => `${confidenceWords(value)} (${Math.round(value * 100)}%)`;

/** Every sentence the report can hold, for the wording test. */
export const reportSentences = (report: ImportReport): string[] => [
  report.summary,
  report.pictureNote,
  report.fittedTo,
  ...report.items.flatMap((item) => [item.label, item.note]),
  ...report.emptyViews.map((view) => view.sentence),
  ...report.notes,
  ...report.dpiWarnings,
  ...report.guessed,
];

export const FORBIDDEN_WORDS = /\b(exact|exactly|matches your picture|identical)\b/i;
