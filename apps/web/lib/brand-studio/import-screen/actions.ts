"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { getEnv } from "@/lib/config/env";
import { chooseModels } from "@/lib/providers/select";
import type { MemberSession } from "@/lib/server/core/guard";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, productionDeps, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { createRateLimiter } from "@/lib/server/rate-limit";
import { loadStored } from "@/lib/settings/store";
import { importSettingsWith } from "../import/settings";
import { IMPORTED_PALETTE_NAME } from "../import/palette";
import { runImport } from "../import/run";
import { createModelStyleWriter, createStubStyleWriter, meteredStyleWriter, styleCostMicrodollars, type VisualStyleWriter } from "../import/style";
import { fontsSchema, hexSchema, paletteSchema, profileSchema } from "../schemas";
import { getProfile, listKitFonts, saveFonts, savePalette, saveProfile } from "../service";
import { FONT_ROLES, STYLE_FIELDS } from "../words";

/**
 * THE TWO WRITES OF THE BRAND IMPORT SCREEN (spec F-S9 phase 3; plan v5 L7, decision 0102 item 10;
 * wired by decision 0106).
 *
 * L7 built the whole engine and owned no component or route, so nothing ever called `runImport`.
 * These two actions are the call, and they sit **outside** `lib/brand-studio/import/**` on purpose:
 * `persistence.test.ts` walks that directory and proves no file in it can reach a database client,
 * a storage writer or a server action, which is the test the spec's "nothing of a third party is
 * stored" rule rests on. Wiring it from inside would have broken that proof.
 *
 * `runBrandImportAction` reads one page of the brand's own site and hands back a proposal in which
 * every row is still pending and the rights box is still unticked. `applyBrandImportAction` saves
 * only what the person kept, through **Y6's own schemas and Y6's own service functions**, so an
 * imported brand and a typed brand are the same brand afterwards.
 *
 * **What they deliberately do not do: upload a picture.** `uploadsFor` needs a proposal the server
 * can trust, and without a run row (owner question 2 of decision 0102) the proposal has been to the
 * browser and back. The three texts, the colours and the fonts are all re-checked here by schemas
 * that already exist -- a hex is a hex, a font key is one of a short list, a text is bounded -- so
 * applying them adds no trust surface at all. A picture would, and the screen says so rather than
 * uploading from an address the browser chose.
 */

const BRAND_STUDIO_PATH = "/brand-studio";
const IMPORT_PATH = "/brand-studio/import";

/** The same roles that may change the club kit may change the brand record (decision 0042). */
const who = (session: MemberSession) => {
  requireAbility(session, "manageKit");
  return whoOf(session);
};

/** The settings a platform admin may have changed, over Knitwright's own drafts. */
const settingsFor = async (): Promise<ReturnType<typeof importSettingsWith>> => {
  try {
    return importSettingsWith(await loadStored(adminClient()));
  } catch {
    return importSettingsWith({});
  }
};

/**
 * The deterministic stub with no model key, or the configured model, metered against the person and
 * the brand who asked and refunded when the call fails. Exactly the arrangement of
 * `lib/benchmarks/server.ts`, so the browser tests (`AI_PROVIDER_STUB=on`) never reach a vendor.
 */
function styleWriterFor(payer: Readonly<{ brandId: string; userId: string }>): VisualStyleWriter {
  const env = getEnv();
  const primary = env.AI_PROVIDER_STUB === "on" ? null : chooseModels(env).primary;
  if (!primary) return createStubStyleWriter();
  const writer = createModelStyleWriter(primary.provider);
  return meteredStyleWriter(writer, productionDeps.usage, payer, styleCostMicrodollars(primary.entry), `action ${LIMITS.brandImport.name}`);
}

export const runBrandImportAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.brandImport,
  schema: z.object({ url: z.string().trim().min(1, "Paste your site's address.").max(2000) }),
  handler: async ({ input, session }) => {
    const payer = who(session);
    const [settings, kitFonts] = await Promise.all([settingsFor(), listKitFonts(await sessionClient())]);
    return runImport(
      {
        // The platform's own fetch, handed in, so no test of the engine can reach the network.
        fetcher: (url, init) => fetch(url, init),
        limiter: createRateLimiter(adminClient()),
        styleWriter: styleWriterFor(payer),
        kitFonts,
        settings,
      },
      payer,
      { url: input.url, brandName: session.brand.name },
    );
  },
});

/** The three F-S9 texts, bounded here and bounded again by `profileSchema`. */
const styleSchema = z.object({ setting: z.string().max(1000), artDirection: z.string().max(1000), rulesBoundaries: z.string().max(1000) });

/**
 * What the screen may ask to be saved: the three texts, the colours and the fonts the person kept.
 * Every one is re-checked by the schema Brand Studio already uses for a brand that typed it.
 */
const applySchema = z.object({
  // The address the run read, which becomes the brand's website when it has none. https only, as
  // the import itself is, so it can never fail the profile's own check further down.
  url: z
    .string()
    .trim()
    .max(2000)
    .refine((text) => text === "" || /^https:\/\/[^\s]+\.[^\s]+$/.test(text), "Start with https:// and include a dot."),
  style: styleSchema.nullable(),
  colours: z.array(hexSchema).max(24),
  fonts: z.array(z.object({ role: z.enum(FONT_ROLES), fontKey: z.string().trim().max(40) })).max(FONT_ROLES.length),
});

type Applied = Readonly<{ profile: boolean; palette: boolean; fonts: number }>;

export const applyBrandImportAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.brandStudioWrite,
  schema: applySchema,
  handler: async ({ input, session }): Promise<Applied> => {
    const payer = who(session);
    const admin = adminClient();
    const client = await sessionClient();
    const current = await getProfile(client, payer.brandId);

    // Only a font whose licence is in this repository may be set at all (decision 0079).
    const usable = new Set((await listKitFonts(client)).filter((font) => font.selectable).map((font) => font.key));
    const fonts = input.fonts.filter((font) => usable.has(font.fontKey));

    const texts = Object.fromEntries(STYLE_FIELDS.map((field) => [field, input.style === null ? current.style[field] : input.style[field]]));
    const body = profileSchema.parse({
      category: current.category,
      // An import fills a website the brand has not given; it never replaces one it has.
      website: current.website ?? input.url,
      about: current.about,
      voiceTags: [...current.voiceTags],
      defaultSizeRange: [...current.defaultSizeRange],
      ...texts,
    });
    await saveProfile(admin, payer, body);

    if (input.colours.length > 0) {
      // The page gave no name and no Pantone code, so neither is invented: a person names them.
      await savePalette(admin, payer, paletteSchema.parse({ paletteId: null, name: IMPORTED_PALETTE_NAME, colours: input.colours.map((hex) => ({ name: "", hex, pantoneTcx: "" })) }));
    }
    if (fonts.length > 0) await saveFonts(admin, payer, fontsSchema.parse({ fonts }));

    revalidatePath(BRAND_STUDIO_PATH);
    revalidatePath(IMPORT_PATH);
    revalidatePath("/", "layout");
    return { profile: input.style !== null, palette: input.colours.length > 0, fonts: fonts.length };
  },
});
