import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/config/env";
import type { GarmentSpec } from "@/lib/garment";
import { chooseModels } from "@/lib/providers/select";
import { MODEL_IMAGE_TYPES, type ModelImage } from "@/lib/providers/text-model";
import { adminClient, imageProvider, productionDeps } from "@/lib/server/deps";
import { standardRegistry, specInput } from "@/lib/validation/spec-input";
import { UNWIRED_PORTS } from "@/lib/validation/ports";
import { validateDesign } from "@/lib/validation/validate";
import { loadFactoryProfile } from "@/lib/validation/service";
import { buildBoard, type BoardDeps } from "./board";
import { buildContextQuery, designContext } from "./context-query";
import { UNWIRED_INSPIRATION_PORTS, type DesignChecker, type InspirationPorts } from "./ports";
import { aiMoodProvider } from "./sources/ai-mood";
import { pinterestOn, pinterestProvider, type PinterestAccess } from "./sources/external";
import { libraryProvider } from "./sources/library";
import { linkPreviewProvider } from "./sources/link-preview";
import { pexelsProvider, unsplashProvider } from "./sources/stock";
import type { MaybeProvider } from "./sources/source";
import { readSteer } from "./store";
import { modelElementReader, stubElementReader, type ElementReader, type PictureReader } from "./suggest/elements";
import type { Board, ContextQuery } from "./types";
import { noKeySentence } from "./vocabulary";

/**
 * Joins the inspiration board to the environment, the session and validation. Nothing here holds logic of its own:
 * every decision is in the pure files beside it, which the unit tests cover.
 */

type Env = Readonly<Record<string, string | undefined>>;

type Who = Readonly<{ brandId: string; userId: string }>;

/** Every source, in the spec's order, each built only when its key is set. A missing key is a sentence, not a fault. */
export function inspirationSources(
  env: Env,
  deps: Readonly<{ who: Who; ports: InspirationPorts; productLinks: readonly string[]; withMoodImage: boolean; pinterest?: PinterestAccess | null }>,
): readonly MaybeProvider[] {
  const image = imageProvider();
  const unsplashKey = env["UNSPLASH_ACCESS_KEY"] ?? "";
  const pexelsKey = env["PEXELS_API_KEY"] ?? "";
  return [
    libraryProvider(deps.ports.library, deps.who.brandId),
    deps.pinterest && pinterestOn(env)
      ? pinterestProvider(deps.pinterest, fetch)
      : { source: "pinterest-board" as const, unavailable: noKeySentence("Your Pinterest boards", "PINTEREST_APP_ID") },
    unsplashKey === "" ? { source: "unsplash" as const, unavailable: noKeySentence("Unsplash", "UNSPLASH_ACCESS_KEY") } : unsplashProvider(unsplashKey, fetch),
    pexelsKey === "" ? { source: "pexels" as const, unavailable: noKeySentence("Pexels", "PEXELS_API_KEY") } : pexelsProvider(pexelsKey, fetch),
    linkPreviewProvider(deps.productLinks, fetch),
    deps.withMoodImage && image !== null
      ? aiMoodProvider(image, productionDeps.usage, deps.who)
      : { source: "ai-mood" as const, unavailable: noKeySentence("AI mood images", "GEMINI_API_KEY or FAL_KEY") },
  ];
}

/** The context query of one design: the design object, the article's sport tags and the brand's mood words. */
export async function queryFor(client: SupabaseClient, who: Who, projectId: string, spec: GarmentSpec, ports: InspirationPorts): Promise<ContextQuery> {
  const [article, moodWords, steer] = await Promise.all([
    ports.articles.articleFor(spec.typeId),
    ports.mood.moodWordsFor(who.brandId),
    readSteer(client, who.brandId, projectId),
  ]);
  return buildContextQuery(designContext(spec, { sports: article?.sportTags ?? [], articleName: article?.name ?? null, moodWords }), steer);
}

/** Validation (X4) over the design as it would be after a patch. Every suggestion goes through this before it is shown. */
export const designChecker =
  (client: SupabaseClient, brandId: string, profileId?: string): DesignChecker =>
  async (after) => {
    const [profile, extra] = await Promise.all([loadFactoryProfile(client, profileId), specInput(after, brandId, UNWIRED_PORTS)]);
    return validateDesign({ typeId: after.typeId, readiness: null, ...extra }, profile, standardRegistry());
  };

/** The whole board for one design. */
export async function boardFor(
  client: SupabaseClient,
  who: Who,
  projectId: string,
  spec: GarmentSpec,
  options: Readonly<{ productLinks: readonly string[]; withMoodImage: boolean; ports?: InspirationPorts; env?: Env; screen?: BoardDeps["screen"] }>,
): Promise<Board> {
  const ports = options.ports ?? UNWIRED_INSPIRATION_PORTS;
  const query = await queryFor(client, who, projectId, spec, ports);
  const sources = inspirationSources(options.env ?? process.env, {
    who,
    ports,
    productLinks: options.productLinks,
    withMoodImage: options.withMoodImage,
    pinterest: null,
  });
  return buildBoard(query, { sources, screen: options.screen ?? ports.screen.screen });
}

/** The most of a card's picture the model is shown. Bigger pictures cost more and say no more. */
const MAX_PICTURE_BYTES = 4 * 1024 * 1024;

/**
 * Fetches a card's picture once so the vision model can look at it, and keeps nothing: the bytes go into the one
 * request and are dropped with it. A picture that is not a plain photograph type is not read at all.
 */
export const cardPicture: PictureReader = async (card, signal) => {
  if (!card.previewUrl.startsWith("https://")) return null;
  const answer = await fetch(card.previewUrl, { ...(signal ? { signal } : {}), redirect: "follow" }).catch(() => null);
  if (answer === null || !answer.ok) return null;
  const type = (answer.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
  if (!(MODEL_IMAGE_TYPES as readonly string[]).includes(type)) return null;
  const bytes = new Uint8Array(await answer.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PICTURE_BYTES) return null;
  return { mediaType: type as ModelImage["mediaType"], base64: Buffer.from(bytes).toString("base64") };
};

/**
 * The reader that looks at a card. The browser tests' stand-in (AI_PROVIDER_STUB) gets a reader that never calls a
 * model; without a model key there is no reader at all and the panel says so.
 */
export function elementReader(): ElementReader | null {
  const env = getEnv();
  if (env.AI_PROVIDER_STUB === "on") return stubElementReader([{ patternFamily: "fade", colourRoles: [], options: [], notTransferable: [] }]);
  const primary = chooseModels(env).primary;
  return primary ? modelElementReader(primary.provider, cardPicture) : null;
}

/** The server's own client, for the writes. */
export const inspirationAdmin = (): SupabaseClient => adminClient();
