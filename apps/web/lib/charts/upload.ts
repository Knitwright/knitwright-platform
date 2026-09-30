import { z } from "zod";
import type { Grid } from "./grid";
import { CHART_IMPORT_LIMITS } from "./limits";
import type { MappingSuggestion } from "./mapping";
import { CHART_UNITS } from "./units";

/**
 * Sending a chart file to the upload route, kept apart from the screen. The server checks
 * and reads the file again. These checks only save a round trip.
 */
export type ChartUpload =
  | Readonly<{ ok: true; fileId: string; grid: Grid; suggestion: MappingSuggestion }>
  | Readonly<{ ok: false; reason: string }>;

const EMPTY = "That file is empty. Choose another.";
const TOO_BIG = `A size chart file can be ${CHART_IMPORT_LIMITS.maxBytes / 1024} KB at most.`;
const FAILED = "The upload did not work. Try again.";
const UNREACHABLE = "We could not reach the server. Check your connection and try again.";

const answer = z.union([
  z.object({
    success: z.literal(true),
    data: z.object({
      fileId: z.uuid(),
      grid: z.array(z.object({ line: z.number().int(), cells: z.array(z.string()) })),
      suggestion: z.object({
        headerLine: z.number().int(),
        pointColumn: z.number().int(),
        sizeColumns: z.array(z.number().int()),
        toleranceColumn: z.number().int().nullable(),
        units: z.enum(CHART_UNITS),
        unitsColumn: z.number().int().nullable(),
        baseSize: z.string(),
      }),
    }),
  }),
  z.object({ success: z.literal(false), error: z.object({ message: z.string() }) }),
]);

export async function uploadChart(file: File, post: (form: FormData) => Promise<Response>): Promise<ChartUpload> {
  if (file.size === 0) return { ok: false, reason: EMPTY };
  if (file.size > CHART_IMPORT_LIMITS.maxBytes) return { ok: false, reason: TOO_BIG };
  const form = new FormData();
  form.set("file", file);
  try {
    const parsed = answer.safeParse(await (await post(form)).json().catch(() => null));
    if (!parsed.success) return { ok: false, reason: FAILED };
    if (!parsed.data.success) return { ok: false, reason: parsed.data.error.message };
    return { ok: true, ...parsed.data.data };
  } catch {
    return { ok: false, reason: UNREACHABLE };
  }
}
