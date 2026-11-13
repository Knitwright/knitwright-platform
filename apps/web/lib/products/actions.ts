"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getBaseArticle } from "@/lib/catalogue";
import { brandChartSet } from "@/lib/charts/service";
import { optionCodeMap } from "@/lib/option-codes";
import { createProject, saveActions } from "@/lib/projects/service";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { log } from "@/lib/server/log";
import { designFromBase, designFromBaseSchema } from "./design";
import { garmentEditorHref } from "@/lib/canvas/address";

/**
 * CREATE MY DESIGN in the product configurator (plan v6 P4, decision 0142). The brand and the user come from the
 * session, never from the form; the base and its options are checked again against the catalogue's rows.
 */
export const designFromBaseAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.createProject,
  schema: designFromBaseSchema,
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const who = { brandId: session.brand.id, userId: session.userId };
    const id = await designFromBase(input, {
      article: (code) => getBaseArticle(client, code),
      optionMap: (code) => optionCodeMap(client, code),
      create: async ({ typeId, wearer, name }) =>
        createProject(adminClient(), { ...who, typeId, wearer, name, styleNumber: "", season: "", charts: await brandChartSet(client, who.brandId) }),
      applyOptions: async (projectId, actions) => {
        const outcome = await saveActions(adminClient(), client, { ...who, projectId, expectedVersion: 1, actions });
        return outcome.ok ? null : outcome.reason;
      },
      warn: (message) => log({ level: "warn", message, where: "action design-from-base" }),
    });
    revalidatePath("/studio");
    redirect(garmentEditorHref(id));
  },
});
