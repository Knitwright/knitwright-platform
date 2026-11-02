import { VIDEO_GAP_RULE } from "./formats";

/**
 * The eight sportswear prompt presets of the spec's AI video board (F-L3), as rows.
 *
 * Every preset is **the camera and the scene only**. The garment, its colours, its crest, its
 * sponsors and its names and numbers are the picture the platform drew, and the sentence that says
 * so is appended to every prompt from one place (`GARMENT_LOCK_SENTENCE`), so no preset can be
 * written that lets a model redraw the kit (spec decision 13, and F-L3's own rule that the first
 * frame is always a garment-locked image). The existing clip prompt (`provider.ts`, decision 0058)
 * says the same thing in the same words; this file is that idea with the spec's eight presets
 * behind it.
 *
 * A person's own words are added **after** the preset and before the lock sentence, so the lock is
 * always the last thing the model reads.
 */

/** The one sentence that locks the garment. Never edited per preset. */
export const GARMENT_LOCK_SENTENCE =
  "Keep the garment exactly as in the picture: its colours, panels, stripes, crest, sponsor logos, names and numbers must not change. Do not add or redraw any text or logo.";

export const PRESET_KEYS = [
  "walk_out",
  "slow_orbit",
  "sprint_past",
  "ball_juggle",
  "fabric_macro",
  "flag_wave",
  "dolly_back",
  "smooth_track",
] as const;

export type PresetKey = (typeof PRESET_KEYS)[number];

export interface PromptPreset {
  readonly key: PresetKey;
  readonly label: string;
  /** What the camera does, in plain words, for the card under the name. */
  readonly lead: string;
  /** The words sent to the model, before the person's own and before the lock sentence. */
  readonly prompt: string;
  readonly ruleId: string;
}

const preset = (key: PresetKey, label: string, lead: string, prompt: string): PromptPreset => ({ key, label, lead, prompt, ruleId: VIDEO_GAP_RULE });

export const PROMPT_PRESETS: Readonly<Record<PresetKey, PromptPreset>> = {
  walk_out: preset(
    "walk_out",
    "Walk-out from tunnel",
    "The player walks out of the tunnel towards the pitch.",
    "The player walks forward out of a stadium tunnel towards the pitch, floodlights ahead, crowd noise out of focus behind.",
  ),
  slow_orbit: preset(
    "slow_orbit",
    "Slow orbit",
    "The camera circles slowly, once, around the player.",
    "The camera orbits slowly and steadily around the standing player, one smooth revolution, even light, shallow depth of field.",
  ),
  sprint_past: preset(
    "sprint_past",
    "Sprint past camera",
    "The player runs past the camera at speed.",
    "The player sprints past the camera from left to right, the background blurring with the motion, the player sharp.",
  ),
  ball_juggle: preset(
    "ball_juggle",
    "Ball juggle",
    "The player keeps a ball up, feet and knees.",
    "The player juggles a football with feet and knees on a training pitch, the camera steady at chest height.",
  ),
  fabric_macro: preset(
    "fabric_macro",
    "Fabric macro push-in",
    "A slow push in to the weave of the fabric.",
    "A very slow macro push-in towards the fabric surface, showing weave and texture, soft studio light, nothing else in frame.",
  ),
  flag_wave: preset(
    "flag_wave",
    "Flag wave in wind",
    "The kit held up and moving in the wind.",
    "The garment is held up and moves gently in the wind like a flag, open sky behind it, late afternoon light.",
  ),
  dolly_back: preset(
    "dolly_back",
    "Dolly backward",
    "The camera pulls back to show the whole scene.",
    "The camera dollies steadily backwards away from the player, revealing the pitch and the empty stand behind.",
  ),
  smooth_track: preset(
    "smooth_track",
    "Smooth tracking",
    "The camera travels alongside the player.",
    "The camera tracks smoothly alongside the walking player at a constant distance, the background sliding past evenly.",
  ),
};

/** The presets in the order the spec lists them. */
export const PRESETS: readonly PromptPreset[] = PRESET_KEYS.map((key) => PROMPT_PRESETS[key]);

export const isPresetKey = (value: unknown): value is PresetKey => (PRESET_KEYS as readonly unknown[]).includes(value);

export const promptPreset = (key: unknown): PromptPreset | null => (isPresetKey(key) ? PROMPT_PRESETS[key] : null);

/** The most of a person's own words that are passed on. Longer is cut, and the panel says the limit. */
export const MAX_OWN_WORDS = 400;

/**
 * The words the model is sent: the preset, then the person's own, then the lock sentence last. A
 * request with no preset still carries the lock sentence, so there is no way to ask a model for a
 * clip without it.
 */
export function buildPrompt(preset: PromptPreset | null, own: string): string {
  const mine = own.trim().slice(0, MAX_OWN_WORDS);
  return [preset?.prompt ?? "", mine, GARMENT_LOCK_SENTENCE].filter((part) => part !== "").join(" ");
}
