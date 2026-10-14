import { z } from "zod";
import { currentStack } from "@/lib/artwork-stack";
import type { GarmentSpec } from "@/lib/garment";
import type { PrintRuleSet } from "@/lib/production/contract";
import { createPrintFileBuilder } from "./build/file-builder";
import { makeFiles, zipFiles } from "./build/package";
import { MAX_PLAN_FILES, planPrintFiles, type Format } from "./build/plan";
import type { StoredPrintProfile } from "./profiles";
import { patternFor } from "./source";
import { createFakeAssetReader, type AssetReader } from "@/lib/artwork-stack";
import { AppError } from "@/lib/server/core/errors";

const FORMATS = ["pdf", "svg", "tiff"] as const;

export const printQuerySchema = z.object({
  size: z.string().trim().min(1).max(16).optional(),
  formats: z
    .string()
    .max(30)
    .default("pdf,svg")
    .transform((text) => [...new Set(text.split(",").map((part) => part.trim()))].filter((part) => part !== ""))
    .pipe(z.array(z.enum(FORMATS)).min(1).max(3)),
  colourway: z.string().trim().min(1).max(64).optional(),
});
export type PrintQuery = z.output<typeof printQuerySchema>;

export interface PrintDeps {
  readonly project: { readonly name: string; readonly version: number; readonly spec: GarmentSpec };
  readonly profile: StoredPrintProfile;
  readonly rules: PrintRuleSet;
  readonly icc: Uint8Array | null;
  /** Reads a user's artwork. The route has no reader until the artwork intake is merged, so pictures are left off and said so. */
  readonly assets?: AssetReader;
}

const NO_PATTERN = "There is no pattern for this garment yet, so print files cannot be made.";
const TIFF_NEEDS_SIZE = "Choose one size to make TIFF files, because they are large.";
const TOO_MANY = `That would be more than ${MAX_PLAN_FILES} files. Choose one size or fewer formats.`;
const NO_SIZE = "That size is not in the pattern.";

const slug = (text: string): string => text.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "design";

/** The print files of a design as one zip, made now and sent once. Nothing is stored. */
export async function servePrintFiles(deps: PrintDeps, query: PrintQuery): Promise<Response> {
  const choice = patternFor(deps.project.spec.typeId);
  if (!choice) throw new AppError("not_found", NO_PATTERN);
  const sizes = query.size === undefined ? choice.pattern.sizes : choice.pattern.sizes.filter((size) => size === query.size);
  if (sizes.length === 0) throw new AppError("invalid_input", NO_SIZE);
  if (query.formats.includes("tiff") && query.size === undefined) throw new AppError("invalid_input", TIFF_NEEDS_SIZE);
  const spec = deps.project.spec;
  const stack = currentStack(spec);
  const colourwayId = query.colourway ?? stack.colourways[0]?.id ?? "main";
  const defaultsNote = deps.profile.source === "knitwright-default" ? `Bleed and resolution are Knitwright defaults, not from your print house. ${choice.note}` : choice.note;
  const plan = planPrintFiles({ pattern: choice.pattern, stack, sizes, formats: query.formats as Format[], profile: deps.profile });
  if (plan.entries.length > MAX_PLAN_FILES) throw new AppError("invalid_input", TOO_MANY);
  const builder = createPrintFileBuilder({
    pattern: choice.pattern,
    stack,
    colourwayId,
    assets: deps.assets ?? createFakeAssetReader([]),
    rules: deps.rules,
    roster: null,
    garment: choice.garment,
    minDpi: deps.profile.minDpi,
    scaleNote: "Not scaled for shrink: this fabric has no shrink test.",
    defaultsNote,
    patternReviewed: false,
    ...(deps.icc ? { icc: deps.icc } : {}),
  });
  const files = await makeFiles(builder, plan.entries);
  const bytes = zipFiles(files, { "read-me.txt": `${choice.note}\r\nBuilt when asked; nothing is stored. Each file lists what to check in its margin and in manifest.csv.\r\n` });
  const name = `${slug(deps.project.name)}-v${deps.project.version}-print-files.zip`;
  return new Response(bytes as Uint8Array<ArrayBuffer>, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "content-length": String(bytes.byteLength),
    },
  });
}
