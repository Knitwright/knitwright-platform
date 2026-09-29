import { MEASUREMENT_MAX_TENTHS_MM, wearerSchema } from "@/lib/garment";
import { z } from "zod";

/** The fit choices a chart may be given for. They match the fit option of a top. */
export const FIT_CHOICES = ["regular", "slim", "relaxed"] as const;
export const SIZE_LABEL_MAX_LENGTH = 12;
export const MAX_SIZES_IN_RUN = 30;

const idText = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower case letters, numbers and single dashes.");
const sizeLabel = z.string().trim().min(1, "A size needs a name.").max(SIZE_LABEL_MAX_LENGTH);

/** Sizes for one wearer, smallest first. Labels are free text and are not repeated. */
export const sizeRunSchema = z
  .object({
    id: idText,
    wearer: wearerSchema,
    sizes: z.array(sizeLabel).min(2, "A size run needs at least two sizes.").max(MAX_SIZES_IN_RUN).readonly(),
  })
  .readonly()
  .refine((run) => new Set(run.sizes).size === run.sizes.length, {
    message: "Each size name can appear only once in a size run.",
    path: ["sizes"],
  });
export type SizeRun = z.output<typeof sizeRunSchema>;

/** Whole tenths of a millimetre, at least one. */
const tenthsMm = z.number().int().min(1).max(MEASUREMENT_MAX_TENTHS_MM);
const stepTenthsMm = z.number().int().min(-MEASUREMENT_MAX_TENTHS_MM).max(MEASUREMENT_MAX_TENTHS_MM);

/**
 * How a value changes from one size to the next. "even" uses one step between every
 * pair of sizes. "steps" gives one step for each pair, smallest pair first.
 */
export const gradeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("even"), step: stepTenthsMm }).readonly(),
  z
    .object({
      kind: z.literal("steps"),
      steps: z.array(stepTenthsMm).min(2).max(MAX_SIZES_IN_RUN).readonly(),
    })
    .readonly(),
]);
export type Grade = z.output<typeof gradeSchema>;

export const chartPointSchema = z
  .object({
    pointId: idText,
    /** The value at the base size. */
    baseValue: tenthsMm,
    grade: gradeSchema,
    /** Plus or minus. */
    tolerance: tenthsMm,
  })
  .readonly();
export type ChartPoint = z.output<typeof chartPointSchema>;

const PLACEHOLDER_NAMES = ["tbc", "tbd", "unknown", "n/a", "na", "none", "anon", "anonymous", "someone"];

const isRealDate = (date: string): boolean => {
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date);
};

/** Who produced the numbers and when. A chart without both is not valid. */
export const chartSourceSchema = z
  .object({
    person: z
      .string()
      .trim()
      .min(1, "Name the person who produced the numbers.")
      .refine((name) => /\p{L}/u.test(name) && !PLACEHOLDER_NAMES.includes(name.toLowerCase()), {
        message: "Name a real person, not a placeholder.",
      }),
    /** A calendar day written as year, month and day, such as 2026-10-02. */
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Give the date as year, month and day, such as 2026-10-02.")
      .refine(isRealDate, { message: "That date is not a real day." }),
  })
  .readonly();
export type ChartSource = z.output<typeof chartSourceSchema>;

/** The chart for one wearer and one garment type, and optionally one fit. */
export const sizeChartSchema = z
  .object({
    wearer: wearerSchema,
    garmentType: idText,
    /** Null means the chart is used for every fit. */
    fit: z.enum(FIT_CHOICES).nullable(),
    sizeRunId: idText,
    baseSize: sizeLabel,
    points: z.array(chartPointSchema).min(1, "A chart needs at least one point of measure.").readonly(),
    source: chartSourceSchema,
  })
  .readonly()
  .refine((chart) => new Set(chart.points.map((point) => point.pointId)).size === chart.points.length, {
    message: "Each point of measure can appear only once in a chart.",
    path: ["points"],
  });
export type SizeChart = z.output<typeof sizeChartSchema>;
