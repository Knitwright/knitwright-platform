"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPlatformAdmin } from "@/lib/ops/access";
import { creditsService } from "@/lib/credits/server";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { applyChange } from "./apply";
import { writeSetting } from "./change";
import { parseInput } from "./input";
import { findSetting } from "./registry";

/**
 * The console's one action: set a setting from what was typed, or put it back to the Knitwright default.
 * Platform admins only; anyone else gets "not found", as the ops and leads pages do. Nothing here sells or charges.
 */
const formSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().max(4000, "That is too long.").default(""),
  intent: z.enum(["save", "reset"]),
});

export const saveSettingAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: formSchema,
  handler: async ({ input, session }) => {
    await assertPlatformAdmin(await sessionClient());
    const def = findSetting(input.key);
    if (!def) throw new AppError("invalid_input", "That setting does not exist.");
    let value: unknown = null;
    if (input.intent === "save") {
      const parsed = parseInput(def, input.value);
      if (!parsed.ok) throw new AppError("invalid_input", parsed.message, { value: [parsed.message] });
      value = parsed.value;
    }
    const admin = adminClient();
    await writeSetting(admin, session.userId, def.key, value);
    await applyChange(admin, session.userId, def.key, () => creditsService().syncCreditPrices());
    revalidatePath("/admin/settings");
    revalidatePath("/ops/settings");
    return { key: def.key, reset: value === null };
  },
});
