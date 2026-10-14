import type { ArtworkStack } from "@/lib/artwork-stack";
import { needsOwnFile, type StoredImport } from "./service";
import { ACCURACY_LIMITS, CLOSE_READING, confidenceLabel, type EmptyView, type ImportReport } from "./report";
import type { Overlay } from "./pipeline";
import { confidenceWords } from "./types";

/** What the screen is given: the layers as rows with their confidence in words, the report, the overlay and the limits that are always shown. */

export interface LayerRow {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly confidence: number;
  readonly confidenceWords: string;
  readonly level: "high" | "medium" | "low";
  readonly note: string;
  /** Needs the person's own file: redrawn from the picture. */
  readonly needsOwnFile: boolean;
}

export interface ImportView {
  readonly id: string;
  readonly status: StoredImport["status"];
  readonly pictureUrl: string;
  readonly heading: string;
  readonly summary: string;
  readonly pictureNote: string;
  readonly rows: readonly LayerRow[];
  readonly emptyViews: readonly EmptyView[];
  readonly notes: readonly string[];
  readonly dpiWarnings: readonly string[];
  readonly guessed: readonly string[];
  readonly fittedTo: string;
  readonly generatedPixels: boolean;
  readonly overlay: Overlay;
  readonly limits: readonly string[];
  readonly stack: ArtworkStack;
  readonly savedAsDesign: boolean;
}

export const HEADING = `A ${CLOSE_READING}`;

function rowsOf(stack: ArtworkStack, report: ImportReport): LayerRow[] {
  const own = new Set(needsOwnFile(stack));
  return stack.layers.map((layer) => {
    const item = report.items.find((entry) => entry.layerId === layer.id);
    const confidence = item?.confidence ?? 0;
    return {
      id: layer.id,
      label: item?.label ?? layer.name ?? layer.kind,
      kind: layer.kind,
      confidence,
      confidenceWords: confidenceLabel(confidence),
      level: confidenceWords(confidence),
      note: item?.note ?? "",
      needsOwnFile: own.has(layer.id),
    };
  });
}

export function analysisView(stored: StoredImport): ImportView {
  return {
    id: stored.id,
    status: stored.status,
    pictureUrl: `/api/files/${stored.sourceFileId}`,
    heading: HEADING,
    summary: stored.report.summary,
    pictureNote: stored.report.pictureNote,
    rows: rowsOf(stored.stack, stored.report),
    emptyViews: stored.report.emptyViews,
    notes: stored.report.notes,
    dpiWarnings: stored.report.dpiWarnings,
    guessed: stored.report.guessed,
    fittedTo: stored.report.fittedTo,
    generatedPixels: stored.report.generatedPixels,
    overlay: stored.overlay,
    limits: ACCURACY_LIMITS,
    stack: stored.stack,
    savedAsDesign: stored.acceptedStack !== null,
  };
}
