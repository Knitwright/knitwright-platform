import type { LaunchCostSource } from "@/lib/launch";
import type { MockupScene } from "@/lib/mockups";
import { shootCost, type ShootCost } from "./cost";
import { findPreset, NO_LICENCE_LINE, presetUsable } from "./models";
import type { ShootBoardSettings } from "./board";
import { SHOOT_GAP_RULE, type ModelPreset } from "./types";

/**
 * WHETHER A SHOOT MAY RUN, AND WHY NOT (spec F-L1; plan v5 wave 4 preamble: "the garment is always
 * locked"; `07`: model presets are "all AI-generated and licensed").
 *
 * One function, and it is the only thing in this directory that may say yes to spending money. It
 * refuses in the order a person would fix things, and every refusal is a sentence they can act on.
 * The order is not arbitrary: the two refusals that protect somebody else -- the garment lock and a
 * person's likeness -- come before the ones that protect the brand's wallet.
 *
 * Nothing here spends, meters, charges or calls anything. It answers a question.
 */

export interface RunFacts {
  /** False when no Design board can be reached backwards from this board (`garmentSource`, L1). */
  readonly garmentLocked: boolean;
  /** The scene this board shoots, or null when nobody has chosen one. */
  readonly scene: MockupScene | null;
  /** The model presets as they stand, with whatever licence refs an admin has set. */
  readonly presets: readonly ModelPreset[];
  /** The brand's credit balance, or null when it could not be read. */
  readonly balance: number | null;
  /** True when charging is on (`CREDITS_ENFORCED`). Off today, and the panel says so. */
  readonly creditsEnforced: boolean;
  /** The platform's own credit prices, through L1's cost source. */
  readonly source: LaunchCostSource;
}

export type RunVerdict =
  | Readonly<{ canRun: true; cost: ShootCost }>
  | Readonly<{ canRun: false; reason: string; ruleId: string }>;

const no = (reason: string): RunVerdict => ({ canRun: false, reason, ruleId: SHOOT_GAP_RULE });

export const LOCK_REASON =
  "This board has no design behind it yet, so there is no garment to keep. Join a Design board to it first.";
export const SCENE_REASON = "Pick a shoot idea or a scene first: the scene is the place the garment is photographed in.";
export const MODEL_NEEDED_REASON =
  "This scene has a person in it, so it needs a model: choose a preset, or upload your own model and record their consent.";
export const PRESET_UNKNOWN_REASON = "That model preset is no longer offered. Choose another one.";
export const UPLOAD_FILE_REASON = "Upload the photograph of your model, and record their consent beside it.";
export const UPLOAD_CONSENT_REASON =
  "Record that this person agreed to their likeness being used, and what you hold as proof. Nothing is generated from an upload without it.";
export const BACKGROUND_FILE_REASON = "Upload the background picture, or choose a preset instead.";
export const BACKGROUND_TEXT_REASON = "Describe the background you want, or choose a preset instead.";
export const BALANCE_UNKNOWN_REASON = "Your credit balance could not be read just now. Open the credits page and try again.";

/** Whether the person in the picture is accounted for: a licensed preset, or a recorded consent. */
function modelRefusal(settings: ShootBoardSettings, facts: RunFacts): string | null {
  const needsPerson = facts.scene !== null && facts.scene.people !== "none";
  if (settings.modelSource === "none") return needsPerson ? MODEL_NEEDED_REASON : null;
  if (settings.modelSource === "preset") {
    const preset = findPreset(facts.presets, settings.modelPresetKey);
    if (preset === null) return PRESET_UNKNOWN_REASON;
    return presetUsable(preset) ? null : NO_LICENCE_LINE;
  }
  if (settings.modelFileId === null) return UPLOAD_FILE_REASON;
  return settings.consent === null ? UPLOAD_CONSENT_REASON : null;
}

/** Whether the background a person asked for is actually there. */
function backgroundRefusal(settings: ShootBoardSettings): string | null {
  if (settings.backgroundSource === "upload" && settings.backgroundFileId === null) return BACKGROUND_FILE_REASON;
  if (settings.backgroundSource === "text" && settings.backgroundText.trim() === "") return BACKGROUND_TEXT_REASON;
  return null;
}

/** Whether this board may be run now, and what it will cost if it may. */
export function runVerdict(settings: ShootBoardSettings, facts: RunFacts): RunVerdict {
  if (!facts.garmentLocked) return no(LOCK_REASON);
  if (facts.scene === null) return no(SCENE_REASON);
  const model = modelRefusal(settings, facts);
  if (model !== null) return no(model);
  const background = backgroundRefusal(settings);
  if (background !== null) return no(background);
  const cost = shootCost(settings.count, facts.source);
  if (!facts.creditsEnforced) return { canRun: true, cost };
  if (facts.balance === null) return no(BALANCE_UNKNOWN_REASON);
  if (facts.balance < cost.credits) return no(`This shoot costs ${cost.credits} credits and you have ${facts.balance}.`);
  return { canRun: true, cost };
}

/** The words on the Generate button: the cost when it can run, a plain word when it cannot. */
export const runButtonLabel = (verdict: RunVerdict): string => (verdict.canRun ? verdict.cost.label : "Generate");

/**
 * True when a picture of this shoot will have a person in it, which decides the label the spec puts
 * on the result ("AI-generated model", F-L1). A scene with a team in it counts even when the person
 * chose no preset, because the model will draw the team the scene asks for.
 */
export const showsPerson = (settings: ShootBoardSettings, scene: MockupScene | null): boolean =>
  settings.modelSource !== "none" || (scene !== null && scene.people !== "none");
