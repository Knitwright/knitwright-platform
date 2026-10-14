import { z } from "zod";
import { currentStack } from "@/lib/artwork-stack";
import type { GarmentSpec } from "@/lib/garment";
import { createPrintFileBuilder, type Roster } from "./build/file-builder";
import { makeFiles, zipFiles } from "./build/package";
import { MAX_PLAN_FILES, planPrintFiles, type Format } from "./build/plan";
import type { PrintContext } from "./inputs/context";
import { defaultsNoteFor, SHRINK_NOT_APPLIED } from "./inputs/notes";
import type { DesignPattern } from "./inputs/pattern";
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
  /** A pattern from the library, by id. Without it the newest pattern for the garment is used. */
  pattern: z.uuid().optional(),
  /** A team list of this design: a set of files is made for every player in it. */
  order: z.uuid().optional(),
  /** A league rule set of the brand. Without it no rules are applied, and the files say so. */
  rules: z.uuid().optional(),
});
export type PrintQuery = z.output<typeof printQuerySchema>;

export interface PrintDeps {
  readonly project: { readonly name: string; readonly version: number; readonly spec: GarmentSpec };
  /** The pattern from the brand's library, with what the margin says about it. */
  readonly pattern: Extract<DesignPattern, { ok: true }>;
  /** The brand's profile, colour profile, rules and artwork reader. */
  readonly context: PrintContext;
  /** The team list player sets are made from, or null for none. */
  readonly roster: Roster | null;
}

const TIFF_NEEDS_SIZE = "Choose one size to make TIFF files, because they are large.";
const TOO_MANY = `That would be more than ${MAX_PLAN_FILES} files. Choose one size or fewer formats.`;
const NO_SIZE = "That size is not in the pattern.";

const slug = (text: string): string => text.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "design";

/** The print files of a design as one zip, made now and sent once. Nothing is stored. */
export async function servePrintFiles(deps: PrintDeps, query: PrintQuery): Promise<Response> {
  const { pattern } = deps.pattern;
  const { profile } = deps.context;
  const sizes = query.size === undefined ? pattern.sizes : pattern.sizes.filter((size) => size === query.size);
  if (sizes.length === 0) throw new AppError("invalid_input", NO_SIZE);
  if (query.formats.includes("tiff") && query.size === undefined) throw new AppError("invalid_input", TIFF_NEEDS_SIZE);
  const spec = deps.project.spec;
  const stack = currentStack(spec);
  const colourwayId = query.colourway ?? stack.colourways[0]?.id ?? "main";
  const plan = planPrintFiles({ pattern, stack, sizes, formats: query.formats as Format[], profile, roster: deps.roster });
  if (plan.entries.length > MAX_PLAN_FILES) throw new AppError("invalid_input", TOO_MANY);
  const builder = createPrintFileBuilder({
    pattern,
    stack,
    colourwayId,
    assets: deps.context.assets,
    rules: deps.context.rules,
    roster: deps.roster,
    garment: spec.typeId,
    minDpi: profile.minDpi,
    scaleNote: SHRINK_NOT_APPLIED,
    defaultsNote: defaultsNoteFor(profile),
    patternReviewed: deps.pattern.reviewed,
    patternNote: deps.pattern.note,
    ...(deps.context.icc ? { icc: deps.context.icc } : {}),
  });
  const files = await makeFiles(builder, plan.entries);
  const lines = [deps.pattern.note, "Built when asked; nothing is stored. Each file lists what to check in its margin and in manifest.csv.", ...plan.skipped];
  const bytes = zipFiles(files, { "read-me.txt": `${lines.join("\r\n")}\r\n` });
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
