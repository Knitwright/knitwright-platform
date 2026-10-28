import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError } from "@/lib/server/core/errors";
import { pointSchema } from "@/lib/production/contract";
import { cleanOverrides, type Landmarks } from "./landmarks";
import { MAX_DXF_BYTES } from "./dxf/parse";
import { createBlock, createProgramme } from "./service";
import { buildSet } from "./set";
import { slotFor, SLOTS } from "./slots";

/**
 * A technician's or a brand's own DXF files, uploaded as a size set. The fields come from a
 * form; the files are read, completed, checked and measured by `buildSet`, and a set that
 * would not sew together is refused with the reason in words.
 */

const PIECE_SLOTS = SLOTS.filter((slot) => slot.kind === "pieces").map((slot) => slot.productKey);
const PROGRAMME_SLOTS = SLOTS.filter((slot) => slot.kind === "knit-programme").map((slot) => slot.productKey);

const common = {
  wearer: z.enum(["men", "women", "youth"]),
  cut: z.enum(["mens", "womens", "junior", "unisex"]),
  name: z.string().trim().min(1).max(120).optional(),
  source: z.enum(["technician-upload", "brand-import"]),
};

/** Landmarks placed by hand: { "M/front": { "hps": [x, y] } }. */
const landmarksJson = z
  .string()
  .max(200_000)
  .transform((text, context) => {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      context.addIssue({ code: "custom", message: "The landmarks are not valid JSON." });
      return z.NEVER;
    }
  })
  .pipe(z.record(z.string().max(80), z.record(z.string(), pointSchema)));

export const uploadFieldsSchema = z.object({
  ...common,
  productKey: z.enum(PIECE_SLOTS as [string, ...string[]]),
  outline: z.enum(["net", "gross"]).optional(),
  sizeOrder: z.string().trim().max(300).optional(),
  landmarks: landmarksJson.optional(),
});
type UploadFields = z.output<typeof uploadFieldsSchema>;

export const programmeFieldsSchema = z.object({
  ...common,
  productKey: z.enum(PROGRAMME_SLOTS as [string, ...string[]]),
  name: common.name.default("Knit programme"),
  sizeMap: z.record(z.string().min(1).max(16), z.string().min(1).max(40)).refine((m) => Object.keys(m).length >= 1 && Object.keys(m).length <= 40, "Give between 1 and 40 sizes."),
  note: z.string().trim().max(500).default(""),
});
type ProgrammeFields = z.output<typeof programmeFieldsSchema>;

type UploadedFile = Readonly<{ name: string; bytes: Uint8Array }>;
export type Uploaded = Readonly<{
  id: string;
  version: number;
  sizes: readonly string[];
  questions: readonly string[];
  warnings: readonly string[];
  derived: readonly string[];
}>;

const MAX_FILES = 30;

/** Landmarks keyed "size/piece" with unknown names dropped. */
export function overridesFrom(raw: UploadFields["landmarks"]): Record<string, Landmarks> {
  return Object.fromEntries(Object.entries(raw ?? {}).map(([key, value]) => [key, cleanOverrides(value)]));
}

export async function uploadSet(admin: SupabaseClient, who: Readonly<{ brandId: string; userId: string }>, fields: UploadFields, files: readonly UploadedFile[]): Promise<Uploaded> {
  if (files.length === 0 || files.length > MAX_FILES) throw new AppError("invalid_input", `Choose between 1 and ${MAX_FILES} DXF files.`);
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const tooBig = files.find((f) => f.bytes.byteLength > MAX_DXF_BYTES);
  if (tooBig) throw new AppError("too_large", `${tooBig.name} is too large to read.`);
  const overrides = overridesFrom(fields.landmarks);
  const built = buildSet({
    files: files.map((f) => ({ name: f.name.slice(0, 120), text: decoder.decode(f.bytes) })),
    outline: fields.outline ?? null,
    overrides,
    sizeOrder: fields.sizeOrder ? fields.sizeOrder.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
  });
  if (!built.ok) throw new AppError("invalid_input", built.reasons.slice(0, 5).join(" "));
  const slot = slotFor(fields.productKey);
  const made = await createBlock(admin, {
    ...who, productKey: fields.productKey, wearer: fields.wearer, cut: fields.cut, name: fields.name ?? slot?.label ?? fields.productKey,
    source: fields.source, set: built, overrides,
  });
  return { id: made.id, version: made.version, sizes: built.sizes, questions: built.questions, warnings: built.warnings, derived: built.derived };
}

export async function uploadProgramme(admin: SupabaseClient, who: Readonly<{ brandId: string; userId: string }>, fields: ProgrammeFields): Promise<{ id: string; version: number }> {
  return createProgramme(admin, {
    ...who, productKey: fields.productKey, wearer: fields.wearer, cut: fields.cut, name: fields.name, source: fields.source,
    sizeMap: fields.sizeMap, note: fields.note,
  });
}
