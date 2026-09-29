"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { createFileReader } from "@/lib/storage/read";
import { chartMappingSchema } from "./mapping";
import { importChart } from "./service";

const importChartSchema = z.strictObject({
  fileId: z.uuid("That is not a file."),
  mapping: chartMappingSchema,
});

/**
 * Imports a stored chart file as the brand's chart, replacing the one for the same
 * wearer, garment type and fit. The brand comes from the session. The file is read with
 * the user's own rights, and the database checks again that the user belongs to the brand.
 */
export const importChartAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.importChart,
  schema: importChartSchema,
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const imported = await importChart(adminClient(), createFileReader(client, session.brand.id), {
      brandId: session.brand.id,
      userId: session.userId,
      fileId: input.fileId,
      mapping: input.mapping,
      today: new Date().toISOString().slice(0, 10),
    });
    revalidatePath("/studio", "layout");
    return imported;
  },
});
