import { z } from "zod";
import type { SettingDef } from "@/lib/settings/types";
import { NO_LICENCES, type ModelLicenceConfig } from "./models";

/**
 * THE MODEL PRESETS' LICENCE REFS AS PLATFORM SETTINGS (spec F-L1: "licensed AI presets"; `07`: "all
 * AI-generated and licensed; no real people").
 *
 * Whether a likeness may be generated is a fact about a licence somebody holds, not a default a
 * workstream may choose. So it is a setting a platform admin sets at /admin/settings, with a history
 * of who changed it, exactly as L5 made a video model's credits a second and its commercial licence
 * settings rather than literals (`lib/media/video/model-settings.ts`).
 *
 * Both settings start **empty**, which means no preset can be used, which is the only safe state
 * before anybody has read a licence. The panel says so on each card and offers the other road: the
 * brand's own model, with their consent recorded.
 *
 * **No secret is here**, and none may be added: settings are shown on screen and kept in a history.
 */

export const MODEL_LICENCE_REFS_KEY = "media.shoot_model_licence_refs";
export const MODEL_LICENCE_HOLDERS_KEY = "media.shoot_model_licence_holders";

const presetKey = z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, "Use preset keys such as athletic-26-40-deep.").max(64);
const reference = z.string().min(1, "Give the reference you hold.").max(200);

export const SHOOT_SETTINGS: readonly SettingDef[] = [
  {
    key: MODEL_LICENCE_REFS_KEY,
    group: "media",
    label: "Licence reference for each AI model preset",
    help:
      'One line per preset, written "preset key = licence reference". A preset with no line cannot be used: the shoot panel says nobody has a licence on file for that likeness rather than generating a person we have no right to. Empty until someone has read the terms.',
    // The nearest question the owner has been asked is 35 (the wording and caps for pictures of
    // people). The licence behind a model preset is not covered by it, and the pull request asks for
    // a question of its own.
    question: 35,
    input: "lines",
    lines: "text",
    schema: z.record(presetKey, reference),
    fallback: {},
  },
  {
    key: MODEL_LICENCE_HOLDERS_KEY,
    group: "media",
    label: "Who holds each AI model preset's licence",
    help:
      'One line per preset, written "preset key = who holds it". Shown beside the reference so a reader can go and look it up. A preset with a reference and no holder still works: the reference is the fact and the holder is a courtesy.',
    question: 35,
    input: "lines",
    lines: "text",
    schema: z.record(presetKey, reference),
    fallback: {},
  },
];

const readRecord = (value: unknown): Readonly<Record<string, string>> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((pair): pair is [string, string] => typeof pair[1] === "string"));
};

/** Reads a setting store (`lib/settings`) into the shape the model picker takes. */
export function modelLicenceConfig(read: (key: string) => unknown): ModelLicenceConfig {
  return { refs: readRecord(read(MODEL_LICENCE_REFS_KEY)), holders: readRecord(read(MODEL_LICENCE_HOLDERS_KEY)) };
}

/** What `modelLicenceConfig` reads out of the definitions' own fallbacks: nothing licensed. */
export const configFromFallbacks = (): ModelLicenceConfig =>
  modelLicenceConfig((key) => SHOOT_SETTINGS.find((def) => def.key === key)?.fallback);

/** The state before an admin has visited the console: no licence anywhere. */
export const NO_LICENCE_CONFIG: ModelLicenceConfig = NO_LICENCES;
