"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPlatformAdmin } from "@/lib/ops/access";
import { defineAction } from "@/lib/server/define-action";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { addTier, applyEdit } from "./apply";
import { factoryService, factoryStore } from "./server";

/**
 * The ops factories page's actions (decision 0071). Platform admins only; anyone else gets "not found", as every ops
 * action does. Each write drops the cached factory profiles. Nothing here sells or charges.
 */

const PAGE = "/ops/factories";

export const saveFactoryFieldAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: z.object({
    table: z.string().min(1).max(40),
    id: z.uuid(),
    column: z.string().min(1).max(40),
    value: z.string().max(4000, "That is too long.").default(""),
  }),
  handler: async ({ input, session }) => {
    await assertPlatformAdmin(await sessionClient());
    const field = await applyEdit(factoryStore(), session.userId, input);
    factoryService().invalidate();
    revalidatePath(PAGE);
    return { table: field.table, column: field.column };
  },
});

const quantity = z.coerce.number({ error: "Give a number." }).int("Whole numbers only.").min(1, "Use 1 or more.").max(1_000_000);

export const addPriceTierAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: z.object({
    capabilityId: z.uuid(),
    qtyMin: quantity,
    qtyMax: z.preprocess((v) => (v === "" || v === undefined ? null : v), quantity.nullable()),
  }),
  handler: async ({ input, session }) => {
    await assertPlatformAdmin(await sessionClient());
    await addTier(factoryStore(), session.userId, input);
    factoryService().invalidate();
    revalidatePath(PAGE);
    return { capabilityId: input.capabilityId };
  },
});
