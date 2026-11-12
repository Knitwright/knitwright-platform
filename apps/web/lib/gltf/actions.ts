"use server";

import { z } from "zod";
import { loadPrintContext } from "@/lib/print/inputs/context";
import { getProjectAt } from "@/lib/projects/project-reads";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { atlasForDesign } from "./atlas-service";

const code = z.string().trim().min(1).max(64);

const atlasSchema = z.object({
  projectId: z.uuid(),
  version: z.number().int().positive(),
  size: z.string().trim().min(1).max(16),
  colourwayId: code.nullable(),
  form: z.object({
    options: z.record(code, code).refine((value) => Object.keys(value).length <= 40, "Too many options."),
    parameters: z.record(code, z.number().finite()).refine((value) => Object.keys(value).length <= 80, "Too many lengths."),
  }),
});

/**
 * The 3D view's panel pictures (plan v6 D3, decision 0134): the art of the design's own print files,
 * for the shown size, form and colourway of one saved version. It reads only, stores nothing and hands
 * over no file, so it costs no credits. A design of another brand is not found.
 */
export const panelPicturesAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: atlasSchema,
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const project = await getProjectAt(client, session.brand.id, input.projectId, input.version);
    const context = await loadPrintContext({ client, admin: adminClient() }, session.brand.id);
    return atlasForDesign(project.spec, context, { size: input.size, colourwayId: input.colourwayId, form: input.form });
  },
});
