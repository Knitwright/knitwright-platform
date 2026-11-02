import "server-only";
import { getEnv } from "@/lib/config/env";
import { chooseModels } from "@/lib/providers/select";
import { adminClient, productionDeps } from "@/lib/server/deps";
import { log } from "@/lib/server/log";
import type { GenerationGate, HumanReviewGate, OrderGate } from "./gate";
import { assertHumanReviewed, screenBeforeOrder, screenGeneration, screenUpload, type ModerationDeps, type UploadInput } from "./hooks";
import { meteredVision, visionCostMicrodollars } from "./metered";
import { DEFAULT_SETTINGS } from "./settings";
import { createSupabaseStore } from "./store";
import { createModelVisionCheck, createStubVisionCheck, type VisionCheck } from "./vision";

/**
 * Joins the screens to the database, the configured model and the usage meter. The browser tests' stand-in (AI_PROVIDER_STUB)
 * gets the stub vision check, which never calls a model. Without a model key the vision check is not configured and only the
 * registry is checked; the result says so.
 */
type Who = Readonly<{ brandId: string; userId: string }>;

function visionFor(who: Who | null, route: string): VisionCheck | null {
  const env = getEnv();
  if (env.AI_PROVIDER_STUB === "on") return createStubVisionCheck();
  const primary = chooseModels(env).primary;
  if (!primary || !who) return null;
  return meteredVision(createModelVisionCheck(primary.provider), productionDeps.usage, who, visionCostMicrodollars(primary.entry), route);
}

export function moderationDeps(who: Who | null, route: string): ModerationDeps {
  return {
    store: createSupabaseStore(adminClient()),
    vision: visionFor(who, route),
    settings: DEFAULT_SETTINGS,
    log: (message, error) => log({ level: "warn", where: "moderation", message, error }),
  };
}

/** The gate the artwork upload route hands to uploadArtwork. */
export const uploadGate = (route: string) => (input: UploadInput) =>
  screenUpload(moderationDeps(input.userId ? { brandId: input.brandId, userId: input.userId } : null, route), input);

/**
 * The gate every path that calls a model for a picture hands to its runner (H3, decision 0116).
 * The spec says "on every AI generation", and until this existed `screenGeneration` had no
 * production caller at all.
 */
export const generationGate =
  (who: Who, route: string): GenerationGate =>
  (input) =>
    screenGeneration(moderationDeps(who, route), { ...who, ...input });

/** The gate every path that hands work to a factory calls before it does (H3, decision 0116). */
export const orderGate =
  (who: Who, route: string): OrderGate =>
  (input) =>
    screenBeforeOrder(moderationDeps(who, route), { ...who, ...input });

/**
 * The Class B guard, over the store alone: it reads a person's decision and needs no model and no
 * meter, so it is cheap to call on the last line before a hand-off.
 */
export const humanReviewGate =
  (): HumanReviewGate =>
  (versionId) =>
    assertHumanReviewed(createSupabaseStore(adminClient()), versionId);
