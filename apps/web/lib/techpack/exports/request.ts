import { z } from "zod";
import { LANGUAGES, type Language } from "@/lib/translate/languages";
import { EXPORT_FORMATS, EXPORT_VIEWS, type ExportFormat } from "./formats";

/** The highest version number an address may ask for. It is far above what a design reaches. */
export const MAX_VERSION = 100_000;

export const exportParamsSchema = z.object({
  projectId: z.uuid(),
  format: z.enum(EXPORT_FORMATS),
});

const versionSchema = z
  .string()
  .regex(/^[1-9]\d{0,5}$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(MAX_VERSION));

const colourwaySchema = z.string().min(1).max(64);

/** The query as the route wrapper reads it: text, or a list when a key is repeated. It is checked again for the format. */
export const rawQuerySchema = z.record(z.string(), z.union([z.string(), z.array(z.string())]));

/**
 * The query of an export. A drawing needs a view, and only a drawing takes one. The PDF is the one
 * format whose fixed words can be set in another language (decision 0104), so it is the one format
 * that takes a language. The version is optional and defaults to the current one. Unknown keys are
 * refused, so a typo is not ignored.
 */
export function exportQuerySchema(format: ExportFormat) {
  const shared = { version: versionSchema.optional(), colourway: colourwaySchema.optional() };
  if (format === "svg") return z.strictObject({ ...shared, view: z.enum(EXPORT_VIEWS) });
  if (format === "pdf") return z.strictObject({ ...shared, language: z.enum(LANGUAGES).optional() });
  // `layout=sheets` asks for the eight-sheet workbook of the sheets preview (spec screen 31, decision 0151).
  return z.strictObject({ ...shared, layout: z.enum(EXPORT_LAYOUTS).optional() });
}
/** The Excel layouts: the eight sheets of the v3.9 preview. Left out, the eleven-tab factory workbook. */
export const EXPORT_LAYOUTS = ["sheets"] as const;
export type ExportLayout = (typeof EXPORT_LAYOUTS)[number];

export type ExportQuery = Readonly<{
  layout?: ExportLayout;
  version?: number;
  colourway?: string;
  view?: (typeof EXPORT_VIEWS)[number];
  language?: Language;
}>;
