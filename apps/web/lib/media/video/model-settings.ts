import { z } from "zod";
import type { SettingDef } from "@/lib/settings/types";
import { MODEL_CATALOGUE, type VideoModelConfig } from "./models";

/**
 * The AI video board's model list as platform settings (spec F-L3: "the list is configured in
 * admin"), registered through `lib/settings/extensions.ts` like the factory's and the pattern
 * service's own settings. A platform admin sets them at /admin/settings, with a history of who
 * changed what.
 *
 * Three settings, because the spec names three facts about a model that are not ours to decide:
 * which models are offered, what a second of each costs, and which of them hold a commercial
 * licence. A fourth sets how many frames of a finished clip the checker samples.
 *
 * **No secret is here**, and none may be added: settings are shown on screen and kept in a history.
 * `FAL_KEY` and `MEDIA_VIDEO_LIVE` stay environment variables, as `select.ts` has them.
 */

export const MODELS_OFFERED_KEY = "media.video_models_offered";
export const CREDITS_PER_SECOND_KEY = "media.video_credits_per_second";
export const COMMERCIAL_LICENCE_KEY = "media.video_commercial_licence_models";
export const CHECK_FRAMES_KEY = "media.video_check_frames";

/**
 * One credit a second while the owner has not answered question 1. It is the same placeholder as
 * every other credit price (`lib/credits/settings.ts`, all 1) and it is not a price.
 */
export const PLACEHOLDER_CREDITS_PER_SECOND = 1;

/**
 * Frames of a finished clip the checker measures against the first frame. Five is a Knitwright
 * default: enough to catch a garment that drifts part way through, cheap enough to run on every
 * result. Nothing has been measured.
 */
export const DEFAULT_CHECK_FRAMES = 5;

const modelKey = z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, "Use model keys such as kling-2.1-standard.").max(64);

const catalogueKeys: readonly string[] = MODEL_CATALOGUE.map((model) => model.key);

export const VIDEO_SETTINGS: readonly SettingDef[] = [
  {
    key: MODELS_OFFERED_KEY,
    group: "media",
    label: "AI video models offered, in order",
    help: "The model keys the AI video board offers, separated by commas. A key nothing describes is ignored and named on this page. Knitwright placeholder: the four candidates the spec lists.",
    question: 1,
    input: "list",
    schema: z.array(modelKey).max(24),
    fallback: catalogueKeys,
  },
  {
    key: CREDITS_PER_SECOND_KEY,
    group: "media",
    label: "Credits a second, by AI video model",
    help: 'One line per model, written "model key = credits". A model with no line cannot be run: the board says nobody has set its price rather than charging a number nobody chose. Knitwright placeholder: 1 a second, which is not a price.',
    question: 1,
    input: "lines",
    lines: "numbers",
    schema: z.record(modelKey, z.number({ error: "Give a number." }).min(0, "Use 0 or more.").max(10_000, "Use 10000 or less.")),
    fallback: Object.fromEntries(catalogueKeys.map((key) => [key, PLACEHOLDER_CREDITS_PER_SECOND])),
  },
  {
    key: COMMERCIAL_LICENCE_KEY,
    group: "media",
    label: "AI video models holding a commercial licence",
    help: "The model keys whose licence allows a brand to use the clip commercially, separated by commas. Empty until someone has read the terms: every other model is labelled on its own button as not holding one.",
    question: 1,
    input: "list",
    schema: z.array(modelKey).max(24),
    fallback: [],
  },
  {
    key: CHECK_FRAMES_KEY,
    group: "media",
    label: "Frames of a clip the picture checker samples",
    help: "A clip is checked by sampling frames across its whole length, not just the first one, so a garment that drifts half way through is caught. Knitwright default: 5.",
    question: 35,
    input: "number",
    schema: z.number({ error: "Give a number." }).int("Whole numbers only.").min(1, "Use 1 or more.").max(60, "Use 60 or less."),
    fallback: DEFAULT_CHECK_FRAMES,
  },
];

const readList = (value: unknown): readonly string[] => (Array.isArray(value) ? value.filter((part): part is string => typeof part === "string") : []);

const readPrices = (value: unknown): Readonly<Record<string, number>> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((pair): pair is [string, number] => typeof pair[1] === "number"));
};

/** Reads a setting store (`lib/settings`) into the shape the model picker takes. */
export function videoModelConfig(read: (key: string) => unknown): VideoModelConfig {
  return {
    offered: readList(read(MODELS_OFFERED_KEY)),
    creditsPerSecond: readPrices(read(CREDITS_PER_SECOND_KEY)),
    commercialLicence: readList(read(COMMERCIAL_LICENCE_KEY)),
  };
}

/** How many frames to sample, from the same store. Out of range or missing: the default. */
export function checkFrameCount(read: (key: string) => unknown): number {
  const value = read(CHECK_FRAMES_KEY);
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 60 ? value : DEFAULT_CHECK_FRAMES;
}

/** The settings as they stand with nothing stored, so the board works before an admin visits. */
export const PLACEHOLDER_MODEL_CONFIG: VideoModelConfig = videoModelConfig((key) => VIDEO_SETTINGS.find((def) => def.key === key)?.fallback);
