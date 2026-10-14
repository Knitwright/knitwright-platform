import { z } from "zod";
import { checkTile, previewSeamless, removeWhiteBackground, saveSeamless } from "@/lib/artwork-intake/derive";
import { logoRightsFor } from "@/lib/storage/rights";
import { AppError } from "@/lib/server/core/errors";
import { SEAMLESS_METHODS } from "@/lib/artwork-intake/tile";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

export const maxDuration = 60;

const method = z.enum(SEAMLESS_METHODS);

/**
 * Work on an artwork that is already stored. Looking at a tile or previewing "make it seamless" changes
 * nothing. Removing the white background and saving a seamless tile make a new artwork that remembers the
 * one it came from; the original is never changed. The rights confirmation is repeated on each new one.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.artworkConvert,
  schema: {
    params: z.object({ artworkId: z.uuid() }),
    body: z.discriminatedUnion("action", [
      z.object({ action: z.literal("remove-white"), rights: z.literal(true) }),
      z.object({ action: z.literal("check-tile") }),
      z.object({ action: z.literal("preview-seamless"), method }),
      z.object({ action: z.literal("save-seamless"), method, rights: z.literal(true) }),
    ]),
  },
  handler: async ({ input, session }) => {
    const brandId = session.brand.id;
    const rights = logoRightsFor({ kind: "artwork", confirmed: true, userId: session.userId, now: new Date() });
    if (!rights.ok || !rights.rights) throw new AppError("invalid_input", "Confirm that you may use this artwork.");
    const who = { admin: adminClient(), brandId, userId: session.userId, rights: rights.rights };
    const { artworkId } = input.params;
    const { body } = input;
    switch (body.action) {
      case "remove-white":
        return { artwork: await removeWhiteBackground(who, artworkId) };
      case "check-tile":
        return { tile: await checkTile(who, artworkId) };
      case "preview-seamless":
        return { seamless: await previewSeamless(who, artworkId, body.method) };
      case "save-seamless":
        return { artwork: await saveSeamless(who, artworkId, body.method) };
    }
  },
});
