import { z } from "zod";
import { VIEW_IDS } from "@/lib/artwork-stack";
import { PICTURE_KINDS } from "./read";
import { ACCURACY_LIMITS, CLOSE_READING, NOT_READ_YET } from "./wording";
import { confidenceWords, READ_PROVENANCE } from "./types";

/**
 * What the reading found, how sure it was, and what it left empty (plan W7d step 8). Every item names its
 * stage and its provenance. This is what the side-by-side screen shows beside the drawing.
 */

export const STAGES = ["reading", "views", "outline", "landmarks", "colours", "marks"] as const;
export type Stage = (typeof STAGES)[number];

export const reportItemSchema = z
  .object({
    id: z.string().min(1).max(80),
    stage: z.enum(STAGES),
    label: z.string().min(1).max(160),
    confidence: z.number().min(0).max(1),
    confidenceWords: z.enum(["high", "medium", "low"]),
    note: z.string().min(1).max(600),
    provenance: z.literal(READ_PROVENANCE),
    /** The layer in the proposed stack this item is about, when it has one. */
    layerId: z.string().max(80).optional(),
    /** True when the pixels or values came from an image model, not from the picture itself. */
    generated: z.boolean().optional(),
  })
  .readonly();
export type ReportItem = z.output<typeof reportItemSchema>;

export const importReportSchema = z
  .object({
    heading: z.literal(CLOSE_READING),
    pictureKind: z.enum([...PICTURE_KINDS, "unknown"]),
    items: z.array(reportItemSchema).max(80).readonly(),
    /** Views the design has that the picture does not show. They are left empty. */
    missing: z.array(z.object({ view: z.enum(VIEW_IDS), note: z.string().max(300) }).readonly()).max(5).readonly(),
    warnings: z.array(z.string().max(600)).max(30).readonly(),
    limits: z.array(z.string().max(300)).max(12).readonly(),
    notReadYet: z.array(z.string().max(300)).max(12).readonly(),
    /** What it used of the budget: vision reads and image edits. */
    used: z.object({ visionCalls: z.number().int().min(0).max(3), imageEdits: z.number().int().min(0).max(2) }).readonly(),
    fittedTo: z.string().max(300),
  })
  .readonly();
export type ImportReport = z.output<typeof importReportSchema>;

export function item(
  id: string,
  stage: Stage,
  label: string,
  confidence: number,
  note: string,
  extra: { readonly layerId?: string; readonly generated?: boolean } = {},
): ReportItem {
  const rounded = Math.max(0, Math.min(1, Math.round(confidence * 100) / 100));
  return { id, stage, label, confidence: rounded, confidenceWords: confidenceWords(rounded), note, provenance: READ_PROVENANCE, ...extra };
}

export function emptyReport(fields: Partial<Pick<ImportReport, "pictureKind" | "items" | "missing" | "warnings" | "used" | "fittedTo">> = {}): ImportReport {
  return {
    heading: CLOSE_READING,
    pictureKind: fields.pictureKind ?? "unknown",
    items: fields.items ?? [],
    missing: fields.missing ?? [],
    warnings: fields.warnings ?? [],
    limits: ACCURACY_LIMITS,
    notReadYet: NOT_READ_YET,
    used: fields.used ?? { visionCalls: 0, imageEdits: 0 },
    fittedTo: fields.fittedTo ?? "",
  };
}

/** A stored report, or null if the stored JSON is not one. */
export function parseReport(input: unknown): ImportReport | null {
  const parsed = importReportSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}
