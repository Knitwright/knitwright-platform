import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const pct = z.number().finite().min(0).max(100);

/** A number a person types, or nothing. Empty means "not set", never zero. */
const optionalNumber = (schema: z.ZodNumber) => z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : typeof v === "string" ? Number(v) : v), schema.optional());

export const MAX_FABRICS_PER_BRAND = 60;
export const MAX_TEST_PHOTOS = 6;

/** What a supplier's sheet states, each value optional. Anything left out stays "not set". */
export const supplierSheetSchema = z.object({
  gsm: optionalNumber(z.number().finite().min(20).max(1000)),
  usableWidthMm: optionalNumber(z.number().finite().min(300).max(4000)),
  stretchLengthPct: optionalNumber(pct),
  stretchWidthPct: optionalNumber(pct),
  recoveryPct: optionalNumber(pct),
  shrinkLengthPct: optionalNumber(z.number().finite().min(0).max(30)),
  shrinkWidthPct: optionalNumber(z.number().finite().min(0).max(30)),
});
export type SupplierSheet = z.output<typeof supplierSheetSchema>;

export const fabricInputSchema = z.object({
  name: text(80).min(1, "Give the fabric a name."),
  composition: text(200).default(""),
  construction: text(120).default(""),
  notes: text(500).default(""),
  supplier: supplierSheetSchema.default({}),
});
export type FabricInput = z.output<typeof fabricInputSchema>;

const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Give the date as year, month and day, such as 2026-10-02.")
  .refine((d) => !Number.isNaN(new Date(`${d}T00:00:00Z`).getTime()) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d), "That date is not a real day.");

const PLACEHOLDER_NAMES = ["tbc", "tbd", "unknown", "n/a", "na", "none", "anon", "anonymous", "someone"];

/**
 * A fabric test: who ran it, when, how, and what it found. Stretch needs the load it was pulled at;
 * shrink needs the temperature and time it was pressed at. Without them a number cannot be repeated.
 */
export const fabricTestInputSchema = z
  .object({
    testedBy: text(80)
      .min(1, "Name the person who ran the test.")
      .refine((n) => /\p{L}/u.test(n) && !PLACEHOLDER_NAMES.includes(n.toLowerCase()), "Name a real person, not a placeholder."),
    testedOn: isoDay,
    method: text(300).min(1, "Say how the test was done, in a sentence."),
    loadNewtons: optionalNumber(z.number().finite().min(0.1).max(500)),
    stretchLengthPct: optionalNumber(pct),
    stretchWidthPct: optionalNumber(pct),
    recoveryPct: optionalNumber(pct),
    shrinkLengthPct: optionalNumber(z.number().finite().min(0).max(30)),
    shrinkWidthPct: optionalNumber(z.number().finite().min(0).max(30)),
    pressTempC: optionalNumber(z.number().finite().min(20).max(250)),
    pressSeconds: optionalNumber(z.number().finite().min(1).max(3600)),
    /** The stretch reduction the technician found right for this fabric, if the test gave one. */
    reductionPct: optionalNumber(z.number().finite().min(0).max(30)),
    photoFileIds: z.array(z.uuid()).max(MAX_TEST_PHOTOS).default([]),
  })
  .superRefine((t, ctx) => {
    const stretch = [t.stretchLengthPct, t.stretchWidthPct, t.recoveryPct].some((v) => v !== undefined);
    const shrink = [t.shrinkLengthPct, t.shrinkWidthPct].some((v) => v !== undefined);
    if (!stretch && !shrink && t.reductionPct === undefined) {
      ctx.addIssue({ code: "custom", message: "Give at least one result: stretch, recovery, shrink or a stretch reduction.", path: ["stretchLengthPct"] });
    }
    if (stretch && t.loadNewtons === undefined) {
      ctx.addIssue({ code: "custom", message: "Say the load the fabric was stretched at, in newtons.", path: ["loadNewtons"] });
    }
    if (shrink && (t.pressTempC === undefined || t.pressSeconds === undefined)) {
      ctx.addIssue({ code: "custom", message: "Say the temperature and the time the fabric was pressed at.", path: ["pressTempC"] });
    }
  });
export type FabricTestInput = z.output<typeof fabricTestInputSchema>;

export const sizeMapEntrySchema = z.object({
  label: text(16).min(1),
  wearer: z.enum(["men", "women", "youth"]),
  cut: z.enum(["mens", "womens", "junior", "unisex"]),
  patternSize: text(16).min(1, "Say which pattern size this label is cut from."),
  source: z.enum(["brand-supplied", "user-edited"]).default("user-edited"),
});
export type SizeMapEntry = z.output<typeof sizeMapEntrySchema>;

/** The "add a fabric" form sends its sheet values as flat fields. This reads them into a fabric. */
export const fabricFormSchema = fabricInputSchema
  .omit({ supplier: true })
  .extend(supplierSheetSchema.shape)
  .transform(({ name, composition, construction, notes, ...supplier }): FabricInput => ({
    name,
    composition,
    construction,
    notes,
    supplier: Object.fromEntries(Object.entries(supplier).filter(([, value]) => value !== undefined)),
  }));

/** The "add a test" form: the fabric it belongs to, and the test. */
export const fabricTestFormSchema = fabricTestInputSchema.and(z.object({ fabricId: z.uuid() }));
