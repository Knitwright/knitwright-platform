import { z } from "zod";
import { patternMeasurementSchema, patternPieceSchema } from "@/lib/production/contract";
import type { CheckResult } from "./checks";
import type { ReviewView } from "./review";

export const BLOCK_SOURCES = ["fashioninsta-bridge", "technician-upload", "brand-import"] as const;
export type BlockSource = (typeof BLOCK_SOURCES)[number];

export const SOURCE_WORDS: Readonly<Record<BlockSource, string>> = {
  "fashioninsta-bridge": "Drafted through fashionINSTA",
  "technician-upload": "Uploaded by a technician",
  "brand-import": "Imported from your own files",
};

export const blockRowSchema = z.object({
  id: z.uuid(),
  product_key: z.string(),
  wearer: z.enum(["men", "women", "youth"]),
  cut: z.enum(["mens", "womens", "junior", "unisex"]),
  name: z.string(),
  kind: z.enum(["pieces", "knit-programme"]),
  version: z.number().int(),
  source: z.enum(BLOCK_SOURCES),
  sizes: z.array(z.string()),
  derived: z.array(z.string()),
  warnings: z.array(z.string()),
  questions: z.array(z.string()),
  size_map: z.record(z.string(), z.string()).nullable(),
  programme_note: z.string().nullable(),
  landmark_overrides: z.record(z.string(), z.unknown()),
  created_at: z.string(),
});
export const BLOCK_COLUMNS =
  "id, product_key, wearer, cut, name, kind, version, source, sizes, derived, warnings, questions, size_map, programme_note, landmark_overrides, created_at" as const;

export const reviewRowSchema = z.object({
  id: z.uuid(),
  block_id: z.uuid(),
  reviewer_name: z.string(),
  reviewer_role: z.string(),
  note: z.string(),
  reviewed_on: z.string(),
});
export const REVIEW_COLUMNS = "id, block_id, reviewer_name, reviewer_role, note, reviewed_on" as const;

export const sizeRowSchema = z.object({
  size_label: z.string(),
  position: z.number().int(),
  pieces: z.array(patternPieceSchema),
  measurements: z.array(patternMeasurementSchema),
  skipped: z.array(z.object({ pointId: z.string(), reason: z.string() })),
  checks: z.array(z.object({ id: z.string(), size: z.string(), ok: z.boolean(), level: z.enum(["refuse", "warn", "note"]), sentence: z.string() })),
  dxf_file_id: z.uuid().nullable(),
});
export const SIZE_COLUMNS = "size_label, position, pieces, measurements, skipped, checks, dxf_file_id" as const;

/** A block as the library's list shows it. */
export type BlockView = Readonly<{
  id: string;
  productKey: string;
  wearer: "men" | "women" | "youth";
  cut: "mens" | "womens" | "junior" | "unisex";
  name: string;
  kind: "pieces" | "knit-programme";
  version: number;
  source: BlockSource;
  sources: string;
  sizes: readonly string[];
  derived: readonly string[];
  warnings: readonly string[];
  questions: readonly string[];
  sizeMap: Readonly<Record<string, string>> | null;
  programmeNote: string | null;
  createdAt: string;
  state: "draft" | "reviewed";
  review: ReviewView | null;
}>;

export type SizeView = Readonly<{
  size: string;
  position: number;
  pieces: readonly z.output<typeof patternPieceSchema>[];
  measurements: readonly z.output<typeof patternMeasurementSchema>[];
  skipped: readonly { pointId: string; reason: string }[];
  checks: readonly CheckResult[];
}>;

export type BlockDetail = Readonly<{ block: BlockView; sizes: readonly SizeView[]; reviews: readonly ReviewView[] }>;
