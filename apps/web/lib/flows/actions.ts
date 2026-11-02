"use server";

import { revalidatePath } from "next/cache";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { launchProjectPath } from "@/lib/launch";
import { loadLaunchCanvas } from "@/lib/launch/server";
import { saveBoard } from "@/lib/launch/service";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { listingPayload, listingVerdict } from "./listing";
import { planOperation } from "./operations";
import { applyFlowTemplateBody, flowOperationBody, publishFlowListingBody, runFlowBody } from "./schemas";
import { applyFlowTemplate, publishFlowListing } from "./service";
import { runFlowForBrand } from "./server";
import { flowCostSource } from "./cost";
import { estimateFlow } from "./cost";

/**
 * The flow actions (plan v5 L6, decision 0096). The brand and the person come from the session; the
 * role is checked here for a clear answer and again inside every database function.
 *
 * **The cost is checked twice.** A run's body carries the figure the person was shown, and the
 * server works the estimate out again from the canvas and the platform's own credit prices. A run
 * whose real cost is higher than the figure on the button is refused rather than charged: the one
 * promise this screen makes about money is that the cost is shown first, and this is what keeps it.
 */

const refresh = (launchProjectId: string): void => {
  revalidatePath(launchProjectPath(launchProjectId));
};

/** The canvas, or a refusal. A canvas of another brand is a canvas that does not exist. */
async function canvasOf(brandId: string, launchProjectId: string) {
  const canvas = await loadLaunchCanvas(await sessionClient(), brandId, launchProjectId);
  if (canvas === null) throw new AppError("not_found", "That launch project does not exist.");
  return canvas;
}

export const applyFlowTemplateAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: applyFlowTemplateBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const canvas = await canvasOf(session.brand.id, input.launchProjectId);
    const applied = await applyFlowTemplate(adminClient(), whoOf(session), {
      launchProjectId: input.launchProjectId,
      template: input.template,
      designProjectId: input.designProjectId,
      designVersion: input.designVersion,
      presets: canvas.presets,
      origin: { x: input.x, y: input.y },
    });
    refresh(input.launchProjectId);
    return { boards: Object.keys(applied.boardIds).length, assets: applied.plan.assets };
  },
});

export const runFlowAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: runFlowBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const canvas = await canvasOf(session.brand.id, input.launchProjectId);
    const graph = { boards: canvas.project.boards, edges: canvas.project.edges };
    const costs = flowCostSource(canvas.costs);
    const scope = { from: input.boardId, scope: input.scope };
    const estimate = estimateFlow(graph, scope, costs);
    if (estimate.credits > input.shownCredits) {
      throw new AppError(
        "conflict",
        `This run now costs ${estimate.credits} credits, not ${input.shownCredits}. Nothing has been spent; open the run panel to see the new figure.`,
      );
    }
    const outcome = await runFlowForBrand(
      { admin: adminClient(), who: whoOf(session) },
      { launchProjectId: input.launchProjectId, graph, scope, template: null, costs },
    );
    refresh(input.launchProjectId);
    return { runId: outcome.runId, assets: outcome.report.assets, spent: outcome.report.spent, refunded: outcome.report.refunded };
  },
});

export const flowOperationAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: flowOperationBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const canvas = await canvasOf(session.brand.id, input.launchProjectId);
    const board = canvas.project.boards.find((one) => one.id === input.boardId);
    if (!board) throw new AppError("not_found", "That board does not exist.");
    const plan = planOperation(input.operation, {
      graph: { boards: canvas.project.boards, edges: canvas.project.edges },
      board,
      source: flowCostSource(canvas.costs),
      presets: canvas.presets,
      ...(input.factor === undefined ? {} : { factor: input.factor }),
      ...(input.presetKey === undefined ? {} : { presetKey: input.presetKey }),
    });
    if (plan === null) throw new AppError("conflict", "That cannot be done to this board yet. The task bar says why.");
    // The change is saved; the board is then rerun from it, so the operation is charged, refunded
    // and recorded exactly like any other run.
    await saveBoard(adminClient(), whoOf(session), {
      launchProjectId: input.launchProjectId,
      boardId: board.id,
      kind: board.kind,
      name: board.name,
      x: board.at.x,
      y: board.at.y,
      width: plan.size.width,
      height: plan.size.height,
      settings: plan.settings,
      inputVersion: board.inputVersion,
    });
    refresh(input.launchProjectId);
    return { credits: plan.credits, note: plan.note };
  },
});

export const publishFlowListingAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: publishFlowListingBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const canvas = await canvasOf(session.brand.id, input.launchProjectId);
    const design = canvas.project.boards.find((one) => one.kind === "design") ?? null;
    const payload = listingPayload(
      { boards: canvas.project.boards, edges: canvas.project.edges },
      {
        launchProjectId: input.launchProjectId,
        title: input.title,
        designProjectId: canvas.project.designProjectId,
        designVersion: design?.inputVersion ?? null,
        ...(input.boardIds.length === 0 ? {} : { boardIds: input.boardIds }),
      },
    );
    const verdict = listingVerdict(payload);
    if (!verdict.ready) throw new AppError("conflict", verdict.reason);
    const id = await publishFlowListing(adminClient(), whoOf(session), input.launchProjectId, payload);
    refresh(input.launchProjectId);
    // Nothing has been published: this is a hand-off the separate Store collects (wave 5, O2).
    return { id, media: payload.media.length, published: false };
  },
});
