import { loadPrintSettings, savePrintProfile } from "@/lib/print/server/settings";
import { printProfileInputSchema } from "@/lib/print/server/schemas";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { createFileReader } from "@/lib/storage/read";

/** The brand's print settings: its own profile, or Knitwright's defaults, with the label that says which. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async ({ session }) => {
    const client = await sessionClient();
    const settings = await loadPrintSettings(client, createFileReader(client, session.brand.id), session.brand.id);
    const { iccBytes, ...shown } = settings;
    return { ...shown, hasColourProfile: iccBytes !== null };
  },
});

/** Saves what the brand's print house stated: bleed, resolution, lowest resolution, widest print and colour profile. */
export const PUT = defineRoute({
  auth: "member",
  rateLimit: LIMITS.printFiles,
  schema: { body: printProfileInputSchema },
  handler: async ({ input, session }) => {
    await savePrintProfile(adminClient(), { brandId: session.brand.id, userId: session.userId }, input.body);
    return { saved: true };
  },
});
