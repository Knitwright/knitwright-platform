"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { guideAddress } from "@/lib/guided/flow";
import { loadCurrentDesign, saveTrustedActions } from "@/lib/projects/service";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { toolHref } from "@/lib/workspace/tools";
import { applyKitStyleSchema } from "./gallery";
import { kitStyleActions, kitStyleSentence } from "./presets";

/**
 * Puts the kit style a person picked on their design, in the colours they picked, as ONE
 * version, so one undo takes it back. The brand comes from the session. The changes are made
 * here on the server from the style's id and the colours, never sent by the browser, and every
 * value is marked as the person's own choice. Then the person goes back where they came from.
 */
export const applyKitStyleAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.editDesign,
  schema: applyKitStyleSchema,
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const who = { brandId: session.brand.id, userId: session.userId, projectId: input.projectId, expectedVersion: input.expectedVersion };
    const spec = await loadCurrentDesign(client, who);
    const colours = { main: input.main, second: input.second, third: input.third };
    const planned = kitStyleActions(spec, input.styleId, colours);
    if (!planned.ok) throw new AppError("invalid_input", planned.reason);
    const outcome = await saveTrustedActions(adminClient(), client, {
      ...who,
      actions: planned.actions,
      source: "kit-style",
      explanations: [kitStyleSentence(input.styleId, colours)],
    });
    if (!outcome.ok) throw new AppError("invalid_input", outcome.reason);
    revalidatePath(`/studio/${input.projectId}`);
    revalidatePath(`/studio/${input.projectId}/tech-pack`);
    revalidatePath("/studio");
    redirect((input.from === "guide" ? guideAddress(input.projectId, "start") : toolHref(input.projectId, "colours")) as Route);
  },
});
