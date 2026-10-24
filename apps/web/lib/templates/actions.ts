"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { useTemplateSchema, editorAddress } from "./schemas";
import { createFromTemplate } from "./service";

/**
 * Makes a new design in the member's brand from a template and opens the editor on it, at version 1. The brand
 * and user come from the session, never from the form. The design is a copy: the template is not linked to it.
 */
export const useTemplateAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.createProject,
  schema: useTemplateSchema,
  handler: async ({ input, session }) => {
    const id = await createFromTemplate(adminClient(), await sessionClient(), {
      brandId: session.brand.id,
      userId: session.userId,
      templateId: input.templateId,
    });
    revalidatePath("/studio");
    redirect(editorAddress(id) as Route);
  },
});
