import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { DEFAULT_CHART_SET, withBrandCharts, type BrandChart, type ChartSet } from "@/lib/sizing";
import { TOO_LARGE, type FileReader } from "@/lib/storage/read";
import { storeChartFile } from "@/lib/storage/store";
import type { Grid } from "./grid";
import { CHART_IMPORT_LIMITS } from "./limits";
import { applyMapping, suggestMapping, type ChartMapping, type MappingSuggestion } from "./mapping";
import { readChartFile } from "./read-sheet";
import { brandChartFromRow } from "./stored";

/**
 * Importing a brand's size chart. The file goes through the upload helper of step 3.
 * The chart is written by the database function replace_brand_chart, which checks that
 * the user belongs to the brand, as the design functions do. The brand always comes from
 * the session, never from the request.
 */

const MOST_CHARTS_READ = 200;

export type UploadedChart = Readonly<{ fileId: string; grid: Grid; suggestion: MappingSuggestion }>;

type Who = Readonly<{ brandId: string; userId: string }>;

/** Reads the file first, so a file that cannot be a chart is refused before it is stored. */
export const uploadChartFile = async (admin: SupabaseClient, who: Who, bytes: Uint8Array): Promise<UploadedChart> => {
  const read = await readChartFile(bytes);
  if (!read.ok) throw new AppError("invalid_input", read.message);
  const stored = await storeChartFile({ admin, brandId: who.brandId, userId: who.userId, bytes });
  return { fileId: stored.id, grid: read.grid, suggestion: suggestMapping(read.grid) };
};

const FILE_GONE = "That file is no longer there. Upload it again.";

/** The grid of a stored chart file of the user's brand, read with the user's own rights. */
export const readStoredChart = async (reader: FileReader, fileId: string): Promise<Grid> => {
  const found = await reader.read(fileId, CHART_IMPORT_LIMITS.maxBytes);
  if (found === null) throw new AppError("not_found", FILE_GONE);
  if (found === TOO_LARGE) throw new AppError("invalid_input", "That file is too large to be a size chart.");
  const read = await readChartFile(found.bytes);
  if (!read.ok) throw new AppError("invalid_input", read.message);
  return read.grid;
};

export type ImportedChart = Readonly<{ garmentType: string; wearer: string; fit: string | null; sizes: readonly string[] }>;

type ImportInput = Who & Readonly<{ fileId: string; mapping: ChartMapping; today: string }>;

/**
 * Turns a stored file into the brand's chart for one wearer, garment type and fit, and
 * stores it in place of the one before. A file with a problem is refused with every
 * problem in plain words, the missing points of measure first, and nothing is stored.
 */
export const importChart = async (admin: SupabaseClient, reader: FileReader, input: ImportInput): Promise<ImportedChart> => {
  const grid = await readStoredChart(reader, input.fileId);
  const result = applyMapping(grid, input.mapping, input.today);
  if (!result.ok) {
    const [first = MESSAGES.invalid_input] = result.problems;
    throw new AppError("invalid_input", first, { file: result.problems, missing: result.missing });
  }
  const { error } = await admin.rpc("replace_brand_chart", {
    p_brand_id: input.brandId,
    p_user_id: input.userId,
    p_wearer: result.chart.wearer,
    p_garment_type: result.chart.garmentType,
    p_fit: result.chart.fit ?? "any",
    p_chart: result.chart,
    p_run: result.run,
    p_file_id: input.fileId,
  });
  if (error) {
    if (error.code === "P0002") throw new AppError("not_found", FILE_GONE);
    throw new AppError("internal", MESSAGES.internal, undefined, { cause: error });
  }
  return { garmentType: result.chart.garmentType, wearer: result.chart.wearer, fit: result.chart.fit, sizes: result.run.sizes };
};

/** The brand's own charts, read with the user's rights. A row that does not check out is left out. */
export const listBrandCharts = async (client: SupabaseClient, brandId: string): Promise<readonly BrandChart[]> => {
  const { data, error } = await client
    .from("brand_size_charts")
    .select("chart, run")
    .eq("brand_id", brandId)
    .order("garment_type")
    .limit(MOST_CHARTS_READ);
  if (error) throw new AppError("internal", MESSAGES.internal, undefined, { cause: error });
  return z
    .array(z.unknown())
    .parse(data ?? [])
    .flatMap((row) => {
      const chart = brandChartFromRow(row);
      return chart ? [chart] : [];
    });
};

/** The charts a brand's designs use: its own, in place of the platform's for the same garment. */
export const brandChartSet = async (client: SupabaseClient, brandId: string): Promise<ChartSet> =>
  withBrandCharts(DEFAULT_CHART_SET, await listBrandCharts(client, brandId));
