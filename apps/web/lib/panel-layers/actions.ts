"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CONFLICT_MESSAGE, failureFromDatabase } from "@/lib/projects/database-errors";
import { getProject } from "@/lib/projects/project-reads";
import { MAX_VERSION } from "@/lib/projects/schemas";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { panelLayersOn } from "./flag";
import { designWithStack } from "./save";

const saveSchema = z.object({
  projectId: z.uuid("That is not a design."),
  expectedVersion: z.number().int().min(1).max(MAX_VERSION),
  /** The stack as JSON. It is read again with the stack's own rules before anything is stored. */
  stack: z.unknown(),
});

/**
 * Stores the layers of the prototype as the next version of the design, through the artwork layer model's dual write
 * (decision 0035). The brand comes from the session. A design changed somewhere else since it was loaded is a conflict.
 */
export const savePanelLayersAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.editDesign,
  schema: saveSchema,
  handler: async ({ input, session }) => {
    if (!panelLayersOn()) throw new AppError("not_found", "That page does not exist.");
    const project = await getProject(await sessionClient(), session.brand.id, input.projectId);
    if (project.currentVersion !== input.expectedVersion) throw new AppError("conflict", CONFLICT_MESSAGE);
    const next = designWithStack(project.spec, input.stack, project.currentVersion);
    if (!next.ok) throw new AppError("invalid_input", next.reason);
    const { data, error } = await adminClient().rpc("append_spec_version", {
      p_project_id: input.projectId,
      p_user_id: session.userId,
      p_expected_version: input.expectedVersion,
      p_spec: next.spec,
      p_schema_version: next.spec.schemaVersion,
      p_note: "Layers changed in the panel layers prototype",
      p_restored_from: null,
    });
    if (error) throw failureFromDatabase(error);
    revalidatePath(`/studio/${input.projectId}`);
    return { version: z.number().int().min(1).parse(data) };
  },
});
