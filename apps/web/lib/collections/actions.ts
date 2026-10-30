"use server";

import { revalidatePath } from "next/cache";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { checkSampleRequest } from "@/lib/make/sample";
import { loadMake } from "@/lib/make/server";
import { submitMakeOrder } from "@/lib/make/service";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { canExportDrop, dropFindings, dropPayload } from "./drop";
import { samplesForApproved } from "./samples";
import { createDropBody, createCollectionBody, dropPayloadSchema, orderSamplesBody, removeStyleBody, saveFrameBody, saveStyleBody } from "./schemas";
import { loadPlanView } from "./server";
import { createCollection, exportDrop, removeStyle, saveFrame, saveStyle } from "./service";

/**
 * The collection plan's actions (plan v5 Z4, decision 0085). The brand and the person come from the
 * session; the role is checked here for a clear answer and again inside every database function.
 *
 * Neither action takes a payment and neither reaches a storefront (owner decision 1). "Order samples"
 * goes through the make flow's one door, and "Create drop" writes a payload the Store collects.
 */

const refresh = (collectionId: string): void => {
  revalidatePath("/studio/collections");
  revalidatePath(`/studio/collections/${collectionId}`);
};

export const createCollectionAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: createCollectionBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const id = await createCollection(adminClient(), whoOf(session), input);
    revalidatePath("/studio/collections");
    return { id };
  },
});

export const saveFrameAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: saveFrameBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const id = await saveFrame(adminClient(), whoOf(session), input);
    refresh(input.collectionId);
    return { id };
  },
});

export const saveStyleAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: saveStyleBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const id = await saveStyle(adminClient(), whoOf(session), input);
    refresh(input.collectionId);
    return { id };
  },
});

export const removeStyleAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: removeStyleBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    await removeStyle(adminClient(), whoOf(session), input.styleId);
    refresh(input.collectionId);
    return { removed: input.styleId };
  },
});

/**
 * "Create drop": the payload is built from the plan on the server, checked against its own schema, and
 * recorded. Nothing is published, nothing is charged, and no storefront is touched.
 */
export const createDropAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: createDropBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const view = await loadPlanView(await sessionClient(), session.brand.id, input.collectionId);
    if (view === null) throw new AppError("not_found", "That collection does not exist.");
    const findings = dropFindings(view.plan);
    if (!canExportDrop(findings)) throw new AppError("conflict", findings.filter((found) => found.severity === "blocker").map((found) => found.message).join(" "));
    const payload = dropPayloadSchema.safeParse(dropPayload(view.plan, view.pricing, new Date()));
    if (!payload.success) throw new AppError("internal", "The drop payload could not be built from this plan.");
    const exported = await exportDrop(adminClient(), whoOf(session), input.collectionId, payload.data);
    refresh(input.collectionId);
    return exported;
  },
});

/**
 * "Order samples for all approved styles": one sample per approved style, one piece per size, through
 * the make flow's door (plan v5 Y7). Each order carries its own key, so pressing twice sends nothing
 * twice. A style that cannot be sampled is reported, never silently skipped.
 */
export const orderSamplesAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: orderSamplesBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const client = await sessionClient();
    const view = await loadPlanView(client, session.brand.id, input.collectionId);
    if (view === null) throw new AppError("not_found", "That collection does not exist.");
    const { targets, skipped } = samplesForApproved(view.plan);
    if (targets.length === 0) throw new AppError("conflict", "No approved style in this plan can be sampled yet.");

    const sent = [];
    for (const target of targets) {
      const style = view.plan.styles.find((one) => one.id === target.styleId);
      if (!style?.projectId) throw new AppError("conflict", `${target.name} has no design to sample.`);
      const context = await loadMake(client, session.brand.id, style.projectId, view.plan.currency);
      const release = context.releases[0];
      if (!release) throw new AppError("conflict", `${target.name} has no frozen release to make yet.`);
      const check = checkSampleRequest({ sizes: target.sizes, sizeRun: context.sizeRun });
      if (!check.canSend) throw new AppError("invalid_input", check.findings.map((found) => found.message).join(" "));
      sent.push(
        await submitMakeOrder(adminClient(), whoOf(session), {
          productId: target.productId,
          kind: "sample",
          releaseId: release.id,
          factoryProfileId: context.factory.profileId,
          fabricKey: style.fabricCode ?? context.fabricKey,
          sizes: check.sizes,
          flags: [],
          requestKey: `${input.requestKey}:${target.styleId}`.slice(0, 64),
        }),
      );
    }
    refresh(input.collectionId);
    return { sent, skipped: skipped.map((one) => one.finding.message) };
  },
});
