"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { brandChartSet } from "@/lib/charts/service";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { guideAddress } from "@/lib/guided/flow";
import { planGuidedStart } from "@/lib/guided/start";
import { guidedStartWithKindSchema } from "@/lib/leads/guided-start";
import { setProjectBuyerKind } from "@/lib/leads/service";
import { log } from "@/lib/server/log";
import { verifyProposal } from "@/lib/intent/proposal-token";
import { nowSeconds, proposalSigningKey } from "./assistant";
import { applySignedProposal } from "./assistant-request";
import {
  applyDesignActionSchema,
  applyProposalSchema,
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
  saveTrustedActions,
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
      charts: await brandChartSet(await sessionClient(), session.brand.id),
    });
    revalidatePath("/studio");
    redirect(`/studio/${id}`);
  },
});

/**
 * Starts a design in the guided flow (plan step 15): from a sentence, a sketch or a picked
 * garment. The design is made at once and the guide opens at its first step, which sends the
 * sentence to the assistant or asks for the sketch.
 */
export const startGuidedAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.createProject,
  schema: guidedStartWithKindSchema,
  handler: async ({ input, session }) => {
    const plan = planGuidedStart(input);
    const id = await createProject(adminClient(), {
      brandId: session.brand.id,
      userId: session.userId,
      typeId: plan.typeId,
      wearer: plan.wearer,
      name: plan.name,
      styleNumber: "",
      season: "",
      charts: await brandChartSet(await sessionClient(), session.brand.id),
    });
    // The path the person chose (decision 0024). The design is made already, so a failure here
    // is logged and the guide opens anyway.
    await setProjectBuyerKind(adminClient(), { projectId: id, userId: session.userId, buyerKind: input.buyerKind }).catch(
      (error: unknown) => log({ level: "warn", message: "The buyer kind could not be saved", where: "action create-project", error }),
    );
    revalidatePath("/studio");
    redirect(guideAddress(id, "start", plan.next) as Route);
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

/**
 * Applies one of the assistant's proposals: a choice it offered, or a reading of a picture
 * the person confirmed. Only a proposal the server signed for this person, brand, design
 * and version is accepted, and its changes keep the source the server gave them.
 */
export const applyProposalAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.applyProposal,
  schema: applyProposalSchema,
  handler: async ({ input, session }) => {
    const who = { projectId: input.projectId, brandId: session.brand.id, userId: session.userId };
    const client = await sessionClient();
    const outcome = await applySignedProposal({
      verify: () => verifyProposal(input.token, proposalSigningKey(), who, nowSeconds()),
      save: (batch) => saveTrustedActions(adminClient(), client, { ...who, ...batch }),
      expectedVersion: input.expectedVersion,
    });
    if (!outcome.ok) throw new AppError("invalid_input", outcome.reason);
    refreshDesign(input.projectId);
    return { version: outcome.version };
  },
});
