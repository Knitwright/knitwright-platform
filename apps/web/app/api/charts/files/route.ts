import { z } from "zod";
import { CHART_IMPORT_LIMITS } from "@/lib/charts/limits";
import { uploadChartFile } from "@/lib/charts/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** Room for the form's own text around the file. */
const FORM_OVERHEAD_BYTES = 16 * 1024;

/**
 * Stores a size chart file, CSV or .xlsx, for the brand the user is working in, and
 * gives back its cells as text for the column mapping screen. The file is checked and
 * read before it is stored. See lib/charts.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.importChart,
  maxBodyBytes: CHART_IMPORT_LIMITS.maxBytes + FORM_OVERHEAD_BYTES,
  schema: {
    form: z.object({ file: z.instanceof(File, { message: "Choose a CSV or .xlsx file." }) }),
  },
  handler: async ({ input, session }) =>
    uploadChartFile(
      adminClient(),
      { brandId: session.brand.id, userId: session.userId },
      new Uint8Array(await input.form.file.arrayBuffer()),
    ),
});
