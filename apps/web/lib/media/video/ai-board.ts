import { GENERATED_LABEL, type SceneAsset } from "@/lib/launch/assets";
import { DURATION_BOUNDS, durationVerdict, isVideoAspect, VIDEO_GAP_RULE, type VideoAspect } from "./formats";
import { findModel, videoCost, type VideoCost, type VideoModel } from "./models";
import { buildPrompt, MAX_OWN_WORDS, promptPreset, type PresetKey } from "./prompt-presets";

/**
 * An AI video board's own settings, and whether it may be run (spec F-L3).
 *
 * The launch shell saves a board's settings as a plain record and hands them back exactly as they
 * were (`setBoardSettings`, decision 0091), so **everything here reads a record nobody has checked**:
 * a value of the wrong shape becomes the default rather than an error, and a value that cannot have a
 * default -- which model, which preset -- becomes null and the panel asks for it.
 *
 * No zod here on purpose: the panel is a client component, and a client component that imports a
 * module holding a zod schema ships all of zod to the browser (`tests/architecture/client-weight.test.ts`).
 *
 * `runVerdict` is the one place that decides whether a run may start, and it refuses in a sentence a
 * person can act on, in this order: no garment behind the board, no first frame, no model, a model
 * nobody priced, a length outside the spec's range, and a balance that does not cover it. Nothing is
 * spent by anything in this file.
 */

export interface AiVideoSettings {
  readonly modelKey: string | null;
  readonly presetKey: PresetKey | null;
  /** The person's own words, on top of the preset. Never the whole prompt: `promptFor` builds that. */
  readonly prompt: string;
  readonly aspect: VideoAspect;
  readonly seconds: number;
  readonly audio: boolean;
}

/** Five seconds and a 9:16 story: a Knitwright default inside the spec's 3 to 15, not a spec number. */
export const DEFAULT_SETTINGS: AiVideoSettings = {
  modelKey: null,
  presetKey: null,
  prompt: "",
  aspect: "9:16",
  seconds: 5,
  audio: false,
};

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed.slice(0, max);
};

const wholeSeconds = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_SETTINGS.seconds;
  const rounded = Math.round(value);
  return rounded >= DURATION_BOUNDS.minSeconds && rounded <= DURATION_BOUNDS.maxSeconds ? rounded : DEFAULT_SETTINGS.seconds;
};

/** A board's saved settings, read leniently, because the shell gives back whatever was stored. */
export function readBoardSettings(raw: Readonly<Record<string, unknown>> = {}): AiVideoSettings {
  const preset = promptPreset(raw["presetKey"]);
  return {
    modelKey: text(raw["modelKey"], 64),
    presetKey: preset?.key ?? null,
    prompt: text(raw["prompt"], MAX_OWN_WORDS) ?? "",
    aspect: isVideoAspect(raw["aspect"]) ? raw["aspect"] : DEFAULT_SETTINGS.aspect,
    seconds: wholeSeconds(raw["seconds"]),
    audio: raw["audio"] === true,
  };
}

/** The settings as a record to hand back to `setBoardSettings`, so Regenerate reruns it unchanged. */
export const writeBoardSettings = (settings: AiVideoSettings): Readonly<Record<string, unknown>> => ({ ...settings });

/** The whole prompt the model is sent: the preset, the person's words, then the garment lock last. */
export const promptFor = (settings: AiVideoSettings): string => buildPrompt(promptPreset(settings.presetKey), settings.prompt);

/** What the board has to work with. Every field is a fact the shell already knows. */
export interface RunFacts {
  /** False when no Design board can be reached backwards from this one (`garmentSource`, L1). */
  readonly garmentLocked: boolean;
  /** False while no board feeds this one a first frame. */
  readonly hasFirstFrame: boolean;
  /** The brand's credit balance, or null when it could not be read. */
  readonly balance: number | null;
  /** True when charging is on (`CREDITS_ENFORCED`). With it off nothing is charged, and the panel says so. */
  readonly creditsEnforced: boolean;
}

export type RunVerdict =
  | Readonly<{ canRun: true; cost: VideoCost; model: VideoModel }>
  | Readonly<{ canRun: false; reason: string; ruleId: string }>;

const no = (reason: string): RunVerdict => ({ canRun: false, reason, ruleId: VIDEO_GAP_RULE });

const LOCK_REASON =
  "This board has no design behind it yet, so there is no garment to keep. Join a Design board to it first.";
const FRAME_REASON = "A clip starts from a picture the platform drew. Feed this board a mockup or an AI image as its first frame.";
const MODEL_REASON = "Pick a model first: each one has its own credits a second and its own licence.";

/** Whether this board may be run now. Refusals come in the order a person would fix them. */
export function runVerdict(settings: AiVideoSettings, models: readonly VideoModel[], facts: RunFacts): RunVerdict {
  if (!facts.garmentLocked) return no(LOCK_REASON);
  if (!facts.hasFirstFrame) return no(FRAME_REASON);
  const model = findModel(models, settings.modelKey);
  if (!model) return no(MODEL_REASON);
  const length = durationVerdict(settings.seconds);
  if (!length.ok) return no(length.reason);
  const cost = videoCost(model, settings.seconds);
  if (!cost.priced) return no(cost.reason);
  if (!facts.creditsEnforced) return { canRun: true, cost, model };
  if (facts.balance === null) return no("Your credit balance could not be read just now. Open the credits page and try again.");
  if (facts.balance < cost.credits) return no(`This clip costs ${cost.credits} credits and you have ${facts.balance}.`);
  return { canRun: true, cost, model };
}

/** The words on the Generate button: the cost when it can run, the reason when it cannot. */
export const runButtonLabel = (verdict: RunVerdict): string => (verdict.canRun ? verdict.cost.label : "Generate");

/** What the person is told about charging while `CREDITS_ENFORCED` is off. Never a claim that it is on. */
export const CHARGING_OFF_NOTE = "Credits are not being charged on this platform yet, so this run spends nothing.";

/**
 * The finished clip as something the launch shell will take (`offerAsset`, decision 0091).
 *
 * This is the only way this workstream hands a generated video to the shell, and its return type is
 * `SceneAsset`, whose `role` is the literal `"scene"`. **A clip a model made therefore cannot be
 * written down as a panel layer or a print file**: spec decision 13 holds here by the type, not by a
 * reviewer remembering it, and `ai-board.test.ts` watches the door shut.
 */
export function videoSceneAsset(file: Readonly<{ fileId: string; contentType: string }>, showsPerson: boolean): SceneAsset {
  return { role: "scene", provenance: "generated", file, label: GENERATED_LABEL, showsPerson };
}
