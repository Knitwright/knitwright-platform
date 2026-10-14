import { z } from "zod";
import type { LandmarkId } from "@/lib/production/contract";
import type { ViewId } from "@/lib/artwork-stack";

/** A point in the picture, in pixels of the analysis copy (origin top left, y down). */
export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** A rectangle as fractions (0 to 1) of the whole picture, so it does not depend on the copy's size. */
export const boxSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().gt(0).max(1),
    h: z.number().gt(0).max(1),
  })
  .strict()
  .readonly();
export type Box = z.output<typeof boxSchema>;

/** Landmarks in the picture, by W0 landmark name. */
export type LandmarkSet = Readonly<Partial<Record<LandmarkId, Pt>>>;
export type ViewLandmarks = Readonly<Partial<Record<ViewId, LandmarkSet>>>;

/** How sure a stage is, from 0 to 1, with its words. Never shown as a promise. */
export const confidenceWords = (value: number): "high" | "medium" | "low" => (value >= 0.75 ? "high" : value >= 0.45 ? "medium" : "low");
export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
export const round2 = (value: number): number => Math.round(value * 100) / 100 + 0;

/** The picture kinds a reading may name. A worn photo is flattened approximately. */
export const PICTURE_KINDS = ["flat", "mockup", "worn-photo", "sketch", "sheet"] as const;
export type PictureKind = (typeof PICTURE_KINDS)[number];

export const MARK_KINDS = ["number", "name", "crest", "sponsor", "sleeve-badge"] as const;
export type MarkKind = (typeof MARK_KINDS)[number];
