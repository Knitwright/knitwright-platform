"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import {
  applyDesignActionSchema,
  createProjectSchema,
  designIdSchema,
  projectDetailsSchema,
  restoreVersionSchema,
  undoDesignSchema,
} from "./schemas";
import {
  createProject,
  currentVersion,
  renameProject,
  restoreVersion,
  saveAction,
  undoDesign,
  type SaveOutcome,
} from "./service";

/**
 * Every action here takes the brand from the session and never from the form. The
 * database checks again that the user belongs to it.
 */

/** A refused change becomes a failure the editor can show, and stores nothing. */
const savedOrRefused = (outcome: SaveOutcome) => {
  if (!outcome.ok) throw new AppError("invalid_input", outcome.reason);
  return { version: outcome.version, dropped: outcome.dropped };
};

const refreshDesign = (projectId: string): void => {
  revalidatePath(`/studio/${projectId}`);
  revalidatePath(`/studio/${projectId}/tech-pack`);
  revalidatePath("/studio");
};

export const createProjectAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.createProject,
  schema: createProjectSchema,
  handler: async ({ input, session }) => {
    const id = await createProject(adminClient(), {
      brandId: session.brand.id,
      userId: session.userId,
      ...input,
    });
    revalidatePath("/studio");
    redirect(`/studio/${id}`);
  },
});

/** Applies one change to a design and stores it as a new version. */
export const applyDesignActionAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.editDesign,
  schema: applyDesignActionSchema,
  handler: async ({ input, session }) => {
    const outcome = await saveAction(adminClient(), await sessionClient(), {
      brandId: session.brand.id,
      userId: session.userId,
      ...input,
    });
    const answer = savedOrRefused(outcome);
    refreshDesign(input.projectId);
    return answer;
  },
});

/** Goes back to an older version by storing it as a new one. Undo uses this too. */
export const restoreVersionAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.restoreVersion,
  schema: restoreVersionSchema,
  handler: async ({ input, session }) => {
    const outcome = await restoreVersion(adminClient(), await sessionClient(), {
      brandId: session.brand.id,
      userId: session.userId,
      ...input,
    });
    const answer = savedOrRefused(outcome);
    refreshDesign(input.projectId);
    return answer;
  },
});

/** Goes back one design. The server works out which, from the version it runs at. */
export const undoDesignAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.restoreVersion,
  schema: undoDesignSchema,
  handler: async ({ input, session }) => {
    const outcome = await undoDesign(adminClient(), await sessionClient(), {
      brandId: session.brand.id,
      userId: session.userId,
      ...input,
    });
    const answer = savedOrRefused(outcome);
    refreshDesign(input.projectId);
    return answer;
  },
});

/** The version a design is at now. The editor asks after a reply was lost, to see if a save went through. */
export const readVersionAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: designIdSchema,
  handler: async ({ input, session }) => ({
    version: await currentVersion(await sessionClient(), session.brand.id, input.projectId),
  }),
});

export const renameProjectAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.renameProject,
  schema: projectDetailsSchema,
  handler: async ({ input, session }) => {
    await renameProject(adminClient(), await sessionClient(), {
      brandId: session.brand.id,
      userId: session.userId,
      ...input,
    });
    refreshDesign(input.projectId);
    return { name: input.name };
  },
});
