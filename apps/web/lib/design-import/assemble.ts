import { ARTWORK_STACK_VERSION, inDefaultOrder, parseArtworkStack, type ArtworkStack, type Layer, type StackColour, type ViewId } from "@/lib/artwork-stack";
import type { Spend } from "./budget";
import type { ViewFit } from "./fit";
import type { PatternProposal } from "./pattern";
import { PATTERN_NOT_READ_YET } from "./pattern";
import type { PictureKind } from "./types";
import { ALTERNATIVE_NOTE, CLOSE_READING, REPEAT_NOTE, emptyViewSentence, type EmptyView, type ImportReport, type ReportItem, viewWords } from "./report";
import { round2 } from "./types";
import { MATCH_BUDGET_SENTENCE } from "./match/stage";

/** Step 8: the W7a stack and the report, from the stages' results. */

export const AS_READ = "as-read";

const PICTURE_NOTES: Readonly<Record<PictureKind, string>> = {
  flat: "A flat drawing: the shapes are fitted to the pattern by their landmarks.",
  mockup: "A mockup: the shapes are fitted to the pattern by their landmarks.",
  "worn-photo": "Photo, approximate: the kit is flattened from its landmarks, and shading, folds and light are baked into the colours.",
  sketch: "A sketch: colours and shapes are approximate.",
  sheet: "A sheet of views: each view was read on its own.",
};

export type StackResult = { readonly ok: true; readonly stack: ArtworkStack } | { readonly ok: false; readonly reason: string };

export function buildStack(views: readonly ViewId[], colours: readonly StackColour[], layers: readonly Layer[]): StackResult {
  const ground: Layer = { id: "ground", kind: "ground", name: "Ground", views: [...views], opacity: 1, blend: "normal", provenance: "read-from-image", colourId: colours[0].id };
  const parsed = parseArtworkStack({
    schemaVersion: ARTWORK_STACK_VERSION,
    views,
    colours,
    layers: inDefaultOrder([ground, ...layers]),
    colourways: [
      {
        id: AS_READ,
        name: "As read from your picture",
        colours: Object.fromEntries(colours.map((c) => [c.id, { screen: c.screen, codes: c.codes, provenance: c.provenance }])),
      },
    ],
  });
  return parsed.ok ? parsed : { ok: false, reason: parsed.reason };
}

export interface ReportParts {
  readonly kind: PictureKind;
  readonly readingConfidence: number;
  readonly fits: readonly ViewFit[];
  readonly fitItems: readonly ReportItem[];
  readonly groundItem: ReportItem;
  readonly markItems: readonly ReportItem[];
  readonly proposals: readonly PatternProposal[];
  readonly patternReads: boolean;
  readonly absent: readonly ViewId[];
  readonly failed: readonly { view: ViewId; sentence: string }[];
  readonly notes: readonly string[];
  readonly guessed: readonly string[];
  readonly fittedTo: string;
  readonly generatedPixels: boolean;
  readonly spend: Spend;
  readonly layerCount: number;
}

export function buildReport(parts: ReportParts): ImportReport {
  const patternItems: ReportItem[] = parts.proposals.flatMap((p, at): ReportItem[] => [
    {
      id: `pattern-${at + 1}`,
      layerId: p.layer.id,
      label: p.kind === "generator" ? "All-over pattern, as a pattern from our list" : p.kind === "tile" ? "All-over pattern, as a repeating picture" : "Full-panel picture",
      confidence: p.confidence,
      note: p.note,
    },
    ...(p.alternative
      ? [{ id: `pattern-${at + 1}-alt`, layerId: p.alternative.id, label: "Alternative: your pattern kept as a repeating picture", confidence: round2(p.confidence * 0.9), note: ALTERNATIVE_NOTE }]
      : []),
  ]);
  const items = [parts.groundItem, ...parts.fitItems, ...patternItems, ...parts.markItems];
  const empty: EmptyView[] = [
    ...parts.absent.map((view) => ({ view, sentence: emptyViewSentence(view, "absent") })),
    ...parts.failed.map((f) => ({ view: f.view, sentence: f.sentence })),
  ];
  const mean = [parts.readingConfidence, ...items.map((i) => i.confidence)];
  const confidence = round2(mean.reduce((a, b) => a + b, 0) / mean.length);
  const dpi = parts.proposals.flatMap((p) => (p.dpiWarning === null ? [] : [p.dpiWarning]));
  const repeats = parts.proposals.filter((p) => p.repeat !== null);
  return {
    summary: `A ${CLOSE_READING}: ${parts.layerCount} ${parts.layerCount === 1 ? "layer" : "layers"} on the ${parts.fits.map((f) => viewWords(f.view)).join(" and ")}. Look at the drawing beside your picture before you accept anything.`,
    pictureNote: PICTURE_NOTES[parts.kind],
    confidence,
    items,
    emptyViews: empty,
    notes: [...parts.notes, ...(parts.patternReads ? [] : [PATTERN_NOT_READ_YET]), ...(repeats.length > 0 ? [REPEAT_NOTE] : []), ...(parts.patternReads ? [MATCH_BUDGET_SENTENCE] : [])],
    dpiWarnings: dpi,
    guessed: parts.guessed,
    fittedTo: parts.fittedTo,
    generatedPixels: parts.generatedPixels,
    spend: parts.spend,
  };
}
