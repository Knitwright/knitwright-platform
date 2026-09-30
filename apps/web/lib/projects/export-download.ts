import { fieldErrors } from "@/lib/server/core/guard";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import type { View } from "@/lib/flat/model";
import { buildWorkbook } from "@/lib/techpack/exports/excel/workbook";
import { NoDrawing } from "@/lib/techpack/exports/errors";
import { exportFileName } from "@/lib/techpack/exports/file-names";
import type { ExportFormat } from "@/lib/techpack/exports/formats";
import { downloadResponse } from "@/lib/techpack/exports/headers";
import { buildPdf } from "@/lib/techpack/exports/pdf/document";
import { illustrationsForExport } from "@/lib/techpack/exports/illustrations";
import { exportQuerySchema, type ExportQuery } from "@/lib/techpack/exports/request";
import { buildSvg } from "@/lib/techpack/exports/svg";
import type { TechPack } from "@/lib/techpack";
import { buildPackFor } from "./tech-pack-data";
import type { TechPackSource } from "./tech-pack-load";

/** One download, as it is recorded: which design, which version, which format and, for a drawing, which view. */
export interface DownloadEntry {
  readonly projectId: string;
  readonly version: number;
  readonly format: ExportFormat;
  readonly view: View | null;
}

/** What an export needs from outside. The route joins these to the database and the clock. */
export interface ExportDeps {
  readonly load: (options: { version?: number }) => Promise<TechPackSource>;
  /** Records a download. It throws when it cannot, and then no file is sent. */
  readonly record: (entry: DownloadEntry) => Promise<void>;
  readonly now: () => Date;
  readonly brandName: string;
}

export interface ExportInput {
  readonly projectId: string;
  readonly format: ExportFormat;
  /** The query of the address, as it came. It is checked here. */
  readonly query: unknown;
}

const parseQuery = (format: ExportFormat, query: unknown): ExportQuery => {
  const parsed = exportQuerySchema(format).safeParse(query);
  if (!parsed.success) throw new AppError("invalid_input", MESSAGES.invalid_input, fieldErrors(parsed.error.issues, "query"));
  return parsed.data;
};

async function buildFile(format: ExportFormat, view: View | null, source: TechPackSource, pack: TechPack): Promise<Uint8Array<ArrayBuffer> | string> {
  const { images, skipped } = source.pictures;
  const pictureLeftOut = skipped > 0;
  const illustrations = illustrationsForExport(source.illustrations, source.project.currentVersion);
  if (format === "pdf") return buildPdf(pack, images, { pictureLeftOut, illustrations });
  if (format === "xlsx") return buildWorkbook(pack, { illustrations });
  // The query of a drawing always names a view: exportQuerySchema requires it.
  if (view === null) throw new AppError("invalid_input", MESSAGES.invalid_input);
  return buildSvg(pack, view, images, { pictureLeftOut });
}

/**
 * Builds one export and sends it. The order is fixed: load the design, build the file in memory,
 * record the download, then send. If the download cannot be recorded, nothing is sent. Nothing is
 * written to disk or to storage. The design is the one the tech pack page shows, made by the same
 * function from the same reads. Each format's writer runs assertEverySetCellHasSource itself, once.
 */
export async function serveExport(deps: ExportDeps, input: ExportInput): Promise<Response> {
  const query = parseQuery(input.format, input.query);
  const source = await deps.load(query.version === undefined ? {} : { version: query.version });
  const pack = buildPackFor({
    project: source.project,
    history: source.history,
    brandName: deps.brandName,
    images: source.pictures.images,
    now: deps.now(),
    charts: source.charts,
    memberNames: source.memberNames,
    ...(query.colourway === undefined ? {} : { colourwayId: query.colourway }),
  });
  const view = query.view ?? null;
  let content: Uint8Array<ArrayBuffer> | string;
  try {
    content = await buildFile(input.format, view, source, pack);
  } catch (error) {
    if (error instanceof NoDrawing) throw new AppError("not_found", error.message);
    throw error;
  }
  await deps.record({ projectId: input.projectId, version: source.project.currentVersion, format: input.format, view });
  const name = exportFileName({
    styleNumber: source.project.styleNumber,
    designName: source.project.name,
    version: source.project.currentVersion,
    format: input.format,
    view,
  });
  return downloadResponse(input.format, name, content);
}
