"use server";

import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/server/define-action";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { fabricFormSchema, fabricTestFormSchema, sizeMapEntrySchema } from "./schemas";
import { addFabricTest, createFabric, saveSizeMap } from "./service";

const PAGE = "/brands/fabrics";

/** The add-a-fabric form on the fabric library page. */
export const addFabricAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.fabricWrite,
  schema: fabricFormSchema,
  handler: async ({ input, session }) => {
    const id = await createFabric(adminClient(), { brandId: session.brand.id, userId: session.userId }, input);
    revalidatePath(PAGE);
    return { id };
  },
});

/** The add-a-test form under a fabric. */
export const addFabricTestAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.fabricWrite,
  schema: fabricTestFormSchema,
  handler: async ({ input, session }) => {
    const { fabricId, ...test } = input;
    const id = await addFabricTest(adminClient(), { brandId: session.brand.id, userId: session.userId }, fabricId, test);
    revalidatePath(PAGE);
    return { id };
  },
});

/** The pattern size field next to a size label. */
export const saveSizeMapAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.fabricWrite,
  schema: sizeMapEntrySchema,
  handler: async ({ input, session }) => {
    await saveSizeMap(adminClient(), { brandId: session.brand.id, userId: session.userId }, input);
    revalidatePath(PAGE);
    return { saved: true };
  },
});
