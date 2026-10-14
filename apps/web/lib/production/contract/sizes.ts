import { z } from "zod";

export const SIZE_MAP_SOURCES = ["suggested", "brand-supplied", "user-edited"] as const;

/** Which pattern size a size label on a garment is cut from, for one wearer and cut. */
export const sizeLabelMapSchema = z.object({
  label: z.string().min(1).max(16),
  wearer: z.enum(["men", "women", "youth"]),
  cut: z.enum(["mens", "womens", "junior", "unisex"]),
  patternSize: z.string().min(1).max(16),
  source: z.enum(SIZE_MAP_SOURCES),
});
export type SizeLabelMap = z.output<typeof sizeLabelMapSchema>;
