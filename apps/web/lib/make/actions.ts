"use server";

import { revalidatePath } from "next/cache";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { checkRun } from "./run";
import { checkSampleRequest } from "./sample";
import { changesBody, goldenSamplePhotoBody, goldenSamplePomBody, goldenSampleReadingBody, runBody, sampleBody, selectSizesBody, signOffBody, startGoldenSampleBody } from "./schemas";
import { addPhoto, addPom, addReading, carryOver, requestChanges, signOff, startGoldenSample, submitMakeOrder } from "./service";
import type { MakeContext } from "./context";
import type { OrderProduct } from "./order-modal";
import { loadMake, loadOrderProducts } from "./server";
import { GAP_RULE_ID } from "./vocabulary";

/**
 * The make flow's actions (plan v5 Y7, decision 0080). The brand and the person come from the session; the role is
 * checked here for a clear answer and again inside every database function. None of these takes a payment: there
 * is no money in the make flow at all (owner decision 1).
 */

const refresh = (projectId: string): void => {
  revalidatePath(`/studio/${projectId}/make`);
};

export const requestSampleAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: sampleBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const client = await sessionClient();
    const context = await loadMake(client, session.brand.id, input.projectId, "GBP");
    const check = checkSampleRequest({ sizes: input.sizes, sizeRun: context.sizeRun });
    if (!check.canSend) throw new AppError("invalid_input", check.findings.map((found) => found.message).join(" "));
    const sent = await submitMakeOrder(adminClient(), whoOf(session), {
      productId: input.productId,
      kind: "sample",
      releaseId: input.releaseId,
      factoryProfileId: context.factory.profileId,
      fabricKey: input.fabricKey,
      sizes: check.sizes,
      flags: [],
      requestKey: input.requestKey,
    });
    refresh(input.projectId);
    return sent;
  },
});

export const orderRunAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: runBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const client = await sessionClient();
    const context = await loadMake(client, session.brand.id, input.projectId, "GBP");
    const check = checkRun({ quantities: input.quantities, productionClass: context.productionClass, moq: context.factory.moq });
    if (!check.canSend) throw new AppError("invalid_input", check.findings.filter((found) => found.severity === "blocker").map((found) => found.message).join(" "));
    await allowRun(session, context);
    const sent = await submitMakeOrder(adminClient(), whoOf(session), {
      productId: input.productId,
      kind: "run",
      releaseId: input.releaseId,
      factoryProfileId: context.factory.profileId,
      fabricKey: input.fabricKey,
      sizes: check.sizes,
      flags: check.findings.filter((found) => found.severity === "warning").map((found) => ({ code: found.code, text: found.message })),
      requestKey: input.requestKey,
    });
    refresh(input.projectId);
    return sent;
  },
});

export const startGoldenSampleAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: startGoldenSampleBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const id = await startGoldenSample(adminClient(), whoOf(session), { productId: input.productId, runId: input.runId });
    refresh(input.projectId);
    return { id };
  },
});

export const addGoldenSamplePhotoAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: goldenSamplePhotoBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const id = await addPhoto(adminClient(), whoOf(session), input);
    refresh(input.projectId);
    return { id };
  },
});

export const addGoldenSamplePomAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: goldenSamplePomBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const id = await addPom(adminClient(), whoOf(session), input);
    refresh(input.projectId);
    return { id };
  },
});

export const addGoldenSampleReadingAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: goldenSampleReadingBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const id = await addReading(adminClient(), whoOf(session), input);
    refresh(input.projectId);
    return { id };
  },
});

export const signOffGoldenSampleAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: signOffBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const state = await signOff(adminClient(), whoOf(session), input);
    refresh(input.projectId);
    return { state };
  },
});

export const requestGoldenSampleChangesAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: changesBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const state = await requestChanges(adminClient(), whoOf(session), input);
    refresh(input.projectId);
    return { state };
  },
});

/**
 * The order modal's hand-off: one order per product, each through the make flow's door, each with its own key so
 * a second press sends nothing twice. The sizes are the ones chosen; the release is the product's newest.
 */
export const selectSizesAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: selectSizesBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const client = await sessionClient();
    const products = await loadOrderProducts(client, session.brand.id, "GBP");
    const wanted = [...new Set(input.lines.map((line) => line.productId))];
    const sent = [];
    for (const productId of wanted) {
      const product = products.find((one) => one.productId === productId);
      if (!product) throw new AppError("not_found", "That product does not exist.");
      const sizes = Object.fromEntries(input.lines.filter((line) => line.productId === productId).map((line) => [line.size, line.pieces]));
      sent.push(await handOver(session, product, sizes, input.requestKey));
    }
    return { sent };
  },
});

type Session = Parameters<typeof whoOf>[0];

/**
 * A run goes only where a golden sample covers the version being made. Where the sign-off is a parent version's,
 * the reason is written to the database first: the carry-over row is what lets the run function through, and it
 * refuses any field the server did not label surface.
 */
async function allowRun(session: Session, context: MakeContext): Promise<void> {
  if (context.gate.status === "blocked") throw new AppError("conflict", context.gate.finding.message);
  if (!context.gate.carriedOver) return;
  await carryOver(adminClient(), whoOf(session), {
    goldenSampleId: context.gate.goldenSampleId,
    toVersion: context.currentVersion,
    changed: context.gate.changed,
    ruleId: GAP_RULE_ID,
  });
}

/** One product's own order, with the pieces of every size chosen for it in the modal. */
async function handOver(session: Session, product: OrderProduct, sizes: Readonly<Record<string, number>>, requestKey: string) {
  const client = await sessionClient();
  const context = await loadMake(client, session.brand.id, product.projectId, "GBP");
  const release = context.releases[0];
  if (!release) throw new AppError("conflict", `${product.name} has no frozen release to make yet.`);
  await allowRun(session, context);
  return submitMakeOrder(adminClient(), whoOf(session), {
    productId: product.productId,
    kind: "run",
    releaseId: release.id,
    factoryProfileId: context.factory.profileId,
    fabricKey: context.fabricKey,
    sizes,
    flags: [],
    requestKey: `${requestKey}:${product.productId}`.slice(0, 64),
  });
}
