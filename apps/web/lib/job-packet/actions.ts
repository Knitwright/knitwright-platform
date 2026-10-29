"use server";

import { revalidatePath } from "next/cache";
import { getEnv } from "@/lib/config/env";
import { assertPlatformAdmin } from "@/lib/ops/access";
import { batchLabel } from "@/lib/ops/format";
import { loadBatch } from "@/lib/ops/service";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, productionDeps, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { dueDateOf, issuePacket } from "./issue";
import { selectNotifier } from "./notify";
import { withPacketLimit } from "./record";
import { createPacketSchema, noteFormSchema, resendPacketSchema, revokePacketSchema, stepFormSchema } from "./schemas";
import { recordFactoryEvent, revokePacket } from "./service";
import { newPacketToken } from "./token";

/**
 * Factory job packets (decision 0072). The ops actions are for platform admins only: each asks the database
 * whether the signed-in person is one, and the database functions check the actor again. The factory's actions
 * need no session: the token in the form is the only key, checked by the database, and each is limited per
 * address and per packet.
 */

const opsContext = async (userId: string) => {
  await assertPlatformAdmin(await sessionClient());
  return { admin: adminClient(), actor: userId };
};

const refreshBatch = (batchId: string): void => revalidatePath(`/ops/batches/${batchId}`);

const issueFor = async (admin: ReturnType<typeof adminClient>, batchId: string) => {
  const { batch, orders } = await loadBatch(admin, batchId);
  return {
    deps: { admin, siteUrl: getEnv().NEXT_PUBLIC_SITE_URL, notifier: selectNotifier(), newToken: newPacketToken },
    batch: batchLabel(batch),
    due: dueDateOf(orders),
  };
};

/** Makes the batch's link. The address is returned once and never stored. */
export const createPacketAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageJobPackets,
  schema: createPacketSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await opsContext(session.userId);
    const { deps, batch, due } = await issueFor(admin, input.batchId);
    const issued = await issuePacket(deps, { kind: "create", batchId: input.batchId }, { actor, days: input.days, whatsapp: input.whatsapp, batch, due });
    refreshBatch(input.batchId);
    return issued;
  },
});

/** Sends the link again with a new address. The old address stops opening the packet. */
export const resendPacketAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageJobPackets,
  schema: resendPacketSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await opsContext(session.userId);
    const { deps, batch, due } = await issueFor(admin, input.batchId);
    const issued = await issuePacket(deps, { kind: "resend", batchId: input.batchId, packetId: input.packetId }, { actor, days: input.days, whatsapp: input.whatsapp, batch, due });
    refreshBatch(input.batchId);
    return issued;
  },
});

export const revokePacketAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageJobPackets,
  schema: revokePacketSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await opsContext(session.userId);
    await revokePacket(admin, { actor, batchId: input.batchId, packetId: input.packetId });
    refreshBatch(input.batchId);
    return { revoked: true };
  },
});

/** A factory presses Received, In production or Ready for QC. */
export const recordStepAction = defineAction({
  auth: "public",
  rateLimit: LIMITS.jobPacketRecord,
  schema: stepFormSchema,
  handler: async ({ input }) => {
    const recorded = await withPacketLimit(productionDeps.hitRateLimit, LIMITS.jobPacketRecordLink, input.token, () =>
      recordFactoryEvent(adminClient(), { token: input.token, kind: input.step, note: input.note, photoKey: null }),
    );
    revalidatePath(`/job/${input.token}`);
    return { step: input.step, at: recorded.at, ordersMoved: recorded.ordersMoved };
  },
});

/** A factory writes a note. */
export const recordNoteAction = defineAction({
  auth: "public",
  rateLimit: LIMITS.jobPacketRecord,
  schema: noteFormSchema,
  handler: async ({ input }) => {
    const recorded = await withPacketLimit(productionDeps.hitRateLimit, LIMITS.jobPacketRecordLink, input.token, () =>
      recordFactoryEvent(adminClient(), { token: input.token, kind: "note", note: input.note, photoKey: null }),
    );
    revalidatePath(`/job/${input.token}`);
    return { at: recorded.at };
  },
});
