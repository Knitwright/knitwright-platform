"use server";

import { revalidatePath } from "next/cache";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { launchProjectPath, type Graph } from "@/lib/launch";
import { loadLaunchCanvas } from "@/lib/launch/server";
import { generatedOutputFiles, saveBoard } from "@/lib/launch/service";
import { refuseIfBlocked, screenText } from "@/lib/moderation/hooks";
import { moderationDeps } from "@/lib/moderation/server";
import { AppError } from "@/lib/server/core/errors";
import type { MemberSession } from "@/lib/server/core/guard";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { listingPayload, listingVerdict } from "./listing";
import { planOperation } from "./operations";
import { productionRegistry } from "./real/server";
import { planRemix } from "./remix";
import { applyFlowTemplateBody, flowOperationBody, publishFlowListingBody, remixFlowBoardBody, runFlowBody } from "./schemas";
import { applyFlowTemplate, publishFlowListing } from "./service";
import { runFlowForBrand } from "./server";
import { estimateFlow, flowCostSource } from "./cost";

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

/**
 * What every run is handed: the admin client, the person, and the real registry (decision 0133), so
 * no action can run a board on the stub again. The registry is built from the graph the run uses.
 */
async function runDeps(session: MemberSession, launchProjectId: string, graph: Graph, route: string) {
  const who = whoOf(session);
  return {
    admin: adminClient(),
    who,
    registry: productionRegistry({ client: await sessionClient(), who, launchProjectId, route }, graph),
  };
}

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
    const outcome = await runFlowForBrand(await runDeps(session, input.launchProjectId, graph, "runFlowAction"), {
      launchProjectId: input.launchProjectId,
      graph,
      scope,
      template: null,
      costs,
    });
    refresh(input.launchProjectId);
    // The first board that did not finish, in its own words, so the shell can say why (decision 0133).
    const stopped = outcome.report.lines.find((line) => line.state !== "ready" && line.reason !== null) ?? null;
    const reason = stopped === null ? null : `${stopped.name || "A board"}: ${stopped.reason}`;
    return { runId: outcome.runId, assets: outcome.report.assets, spent: outcome.report.spent, refunded: outcome.report.refunded, reason };
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
    // The change is saved and the board is then rerun from it, so the operation is charged,
    // refunded and recorded exactly like any other run. The canvas is read again in between,
    // because the run has to see the settings the operation just saved.
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
    const after = await canvasOf(session.brand.id, input.launchProjectId);
    const graph = { boards: after.project.boards, edges: after.project.edges };
    const outcome = await runFlowForBrand(await runDeps(session, input.launchProjectId, graph, "flowOperationAction"), {
      launchProjectId: input.launchProjectId,
      graph,
      scope: { from: board.id, scope: "board" },
      template: null,
      costs: flowCostSource(after.costs),
    });
    refresh(input.launchProjectId);
    return { credits: outcome.report.spent, refunded: outcome.report.refunded, state: outcome.report.state, note: plan.note };
  },
});

/**
 * Remix (decision 0133): the selected generated picture, made again with a new attempt. The count is
 * saved on the board and the board is rerun, so it is charged, refunded and recorded like any run,
 * and the figure the person was shown is held to the server's own estimate, as Run is.
 */
export const remixFlowBoardAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: remixFlowBoardBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const canvas = await canvasOf(session.brand.id, input.launchProjectId);
    const board = canvas.project.boards.find((one) => one.id === input.boardId);
    if (!board) throw new AppError("not_found", "That board does not exist.");
    const plan = planRemix(board);
    if (!plan.ok) throw new AppError("conflict", plan.reason);
    const scope = { from: board.id, scope: "board" as const };
    const estimate = estimateFlow({ boards: canvas.project.boards, edges: canvas.project.edges }, scope, flowCostSource(canvas.costs));
    if (estimate.credits > input.shownCredits) {
      throw new AppError("conflict", `A remix now costs ${estimate.credits} credits, not ${input.shownCredits}. Nothing has been spent.`);
    }
    await saveBoard(adminClient(), whoOf(session), {
      launchProjectId: input.launchProjectId,
      boardId: board.id,
      kind: board.kind,
      name: board.name,
      x: board.at.x,
      y: board.at.y,
      width: board.size.width,
      height: board.size.height,
      settings: plan.settings,
      inputVersion: board.inputVersion,
    });
    const after = await canvasOf(session.brand.id, input.launchProjectId);
    const graph = { boards: after.project.boards, edges: after.project.edges };
    const outcome = await runFlowForBrand(await runDeps(session, input.launchProjectId, graph, "remixFlowBoardAction"), {
      launchProjectId: input.launchProjectId,
      graph,
      scope,
      template: null,
      costs: flowCostSource(after.costs),
    });
    refresh(input.launchProjectId);
    const line = outcome.report.lines.find((one) => one.boardId === board.id) ?? null;
    return { state: outcome.report.state, spent: outcome.report.spent, refunded: outcome.report.refunded, reason: line?.reason ?? null };
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
    // The spec's "AI-generated" label is mandatory on the hand-off, so it is taken from the files
    // themselves as well as from the shape of the canvas (security review v5 H1, decision 0116).
    const generatedFileIds = await generatedOutputFiles(
      adminClient(),
      session.brand.id,
      canvas.project.boards.flatMap((board) => board.outputFileId ?? []),
    );
    const payload = listingPayload(
      { boards: canvas.project.boards, edges: canvas.project.edges },
      {
        launchProjectId: input.launchProjectId,
        title: input.title,
        designProjectId: canvas.project.designProjectId,
        designVersion: design?.inputVersion ?? null,
        generatedFileIds,
        ...(input.boardIds.length === 0 ? {} : { boardIds: input.boardIds }),
      },
    );
    const verdict = listingVerdict(payload);
    if (!verdict.ready) throw new AppError("conflict", verdict.reason);
    /**
     * The title is free text from the body and went straight into the Store listing payload
     * unscreened, while `lib/moderation/text.ts` already implemented the spec's one named block
     * rule for exactly this context: "dupe", "inspired by <mark>" and another brand's name in a
     * product title are all blocks. "Nike dupe hoodie" shipped (security review v5 H3, decision
     * 0116). A flagged title is not refused: the hand-off is not a publication, and the flag sits
     * in the ops review queue where a person decides.
     */
    const screened = await screenText(moderationDeps({ brandId: session.brand.id, userId: session.userId }, "publishFlowListing"), {
      brandId: session.brand.id,
      userId: session.userId,
      text: input.title,
      context: "title",
    });
    refuseIfBlocked(screened, "title");
    const id = await publishFlowListing(adminClient(), whoOf(session), input.launchProjectId, payload);
    refresh(input.launchProjectId);
    // Nothing has been published: this is a hand-off the separate Store collects (wave 5, O2).
    return { id, media: payload.media.length, published: false };
  },
});
