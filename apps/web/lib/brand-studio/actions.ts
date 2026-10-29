"use server";

import { revalidatePath } from "next/cache";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import type { MemberSession } from "@/lib/server/core/guard";
import { defineAction } from "@/lib/server/define-action";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { assetsSchema, deletePaletteSchema, fontsSchema, paletteSchema, profileSchema } from "./schemas";
import { deletePalette, saveAssets, saveFonts, savePalette, saveProfile } from "./service";

/**
 * The writes of Brand Studio (spec F-S9, decision 0079). Each runs as a member of the brand, and
 * the database function it calls checks the person's role again: the screen's own check only keeps
 * a refusal readable. The brand and the person always come from the session.
 */

const BRAND_STUDIO_PATH = "/brand-studio";

/** The same roles that may change the club kit may change the brand record (decision 0042). */
const who = (session: MemberSession) => {
  requireAbility(session, "manageKit");
  return whoOf(session);
};

export const saveBrandProfileAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.brandStudioWrite,
  schema: profileSchema,
  handler: async ({ input, session }) => {
    await saveProfile(adminClient(), who(session), input);
    revalidatePath(BRAND_STUDIO_PATH);
    revalidatePath("/", "layout");
    return { saved: true };
  },
});

export const saveBrandPaletteAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.brandStudioWrite,
  schema: paletteSchema,
  handler: async ({ input, session }) => {
    const paletteId = await savePalette(adminClient(), who(session), input);
    revalidatePath(BRAND_STUDIO_PATH);
    revalidatePath("/", "layout");
    return { paletteId };
  },
});

export const deleteBrandPaletteAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.brandStudioWrite,
  schema: deletePaletteSchema,
  handler: async ({ input, session }) => {
    await deletePalette(adminClient(), who(session), input.paletteId);
    revalidatePath(BRAND_STUDIO_PATH);
    revalidatePath("/", "layout");
    return { deleted: true };
  },
});

export const saveBrandFontsAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.brandStudioWrite,
  schema: fontsSchema,
  handler: async ({ input, session }) => {
    await saveFonts(adminClient(), who(session), input);
    revalidatePath(BRAND_STUDIO_PATH);
    revalidatePath("/", "layout");
    return { saved: true };
  },
});

export const saveBrandAssetsAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.brandStudioWrite,
  schema: assetsSchema,
  handler: async ({ input, session }) => {
    const count = await saveAssets(adminClient(), who(session), input);
    revalidatePath(BRAND_STUDIO_PATH);
    revalidatePath("/", "layout");
    return { count };
  },
});

