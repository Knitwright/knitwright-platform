import { SHOOT_STYLE_PROMPTS, type ShootStyle } from "@/lib/shoots/types";

/**
 * THE PROMPT BUILDER, PROMPTS AND ENHANCE (decision 0149; `08` v3.3 "+ menu", prototype e39–e40).
 *
 * These are words, not facts: each pick adds a phrase to the person's own prompt, which they can read
 * and change before anything is sent. Nothing here describes the garment -- the garment is not the
 * model's to change, and every board's run adds the lock sentence last (`lib/shoots/provider.ts`).
 * The words are Knitwright's own, written for sportswear; none is copied from Kittl.
 */

export const BUILDER_CATEGORIES = ["style", "perspective", "effects", "colors", "environment", "lighting"] as const;
export type BuilderCategory = (typeof BUILDER_CATEGORIES)[number];

export const BUILDER_LABELS: Readonly<Record<BuilderCategory, string>> = {
  style: "Style",
  perspective: "Perspective",
  effects: "Effects",
  colors: "Colors",
  environment: "Environment",
  lighting: "Lighting",
};

export interface BuilderPick {
  readonly id: string;
  readonly category: BuilderCategory;
  readonly label: string;
  /** The phrase added to the prompt. */
  readonly words: string;
}

const pick = (category: BuilderCategory, id: string, label: string, words: string): BuilderPick => ({ id: `${category}:${id}`, category, label, words });

export const BUILDER_PICKS: readonly BuilderPick[] = [
  pick("style", "photoreal", "Photoreal", "photorealistic sports photography"),
  pick("style", "editorial", "Editorial", "editorial magazine look"),
  pick("style", "flat-vector", "Flat Vector", "flat vector illustration background"),
  pick("style", "comic", "Comic", "bold comic-book backdrop"),
  pick("style", "retro-print", "Retro Print", "retro screen-print poster feel"),
  pick("style", "3d-render", "3D Render", "clean 3D-rendered set"),
  pick("perspective", "low-angle", "Low angle", "low-angle hero shot"),
  pick("perspective", "eye-level", "Eye level", "eye-level framing"),
  pick("perspective", "top-down", "Top-down", "top-down flat-lay view"),
  pick("perspective", "close-up", "Close-up", "tight close-up"),
  pick("perspective", "wide", "Wide", "wide establishing shot"),
  pick("perspective", "dutch", "Tilted", "slightly tilted dynamic angle"),
  pick("effects", "motion-blur", "Motion blur", "motion blur in the background"),
  pick("effects", "grain", "Film grain", "fine film grain"),
  pick("effects", "smoke", "Smoke", "drifting smoke"),
  pick("effects", "halftone", "Halftone", "halftone texture in the backdrop"),
  pick("effects", "bokeh", "Bokeh", "soft bokeh lights"),
  pick("effects", "flare", "Lens flare", "subtle lens flare"),
  pick("colors", "club", "Club colours", "backdrop in the club's colours"),
  pick("colors", "mono", "Monochrome", "monochrome backdrop"),
  pick("colors", "warm", "Warm", "warm colour grade"),
  pick("colors", "cool", "Cool", "cool colour grade"),
  pick("colors", "neon", "Neon", "neon accents"),
  pick("colors", "pastel", "Pastel", "soft pastel backdrop"),
  pick("environment", "stadium", "Stadium", "floodlit stadium"),
  pick("environment", "tunnel", "Tunnel", "players' tunnel"),
  pick("environment", "changing-room", "Changing room", "changing room"),
  pick("environment", "street", "Street", "city street"),
  pick("environment", "studio", "Studio", "seamless studio backdrop"),
  pick("environment", "training", "Training ground", "muddy training ground"),
  pick("lighting", "floodlit", "Floodlit", "floodlights at night"),
  pick("lighting", "golden", "Golden hour", "golden-hour sunlight"),
  pick("lighting", "overcast", "Overcast", "soft overcast daylight"),
  pick("lighting", "rim", "Rim light", "strong rim light"),
  pick("lighting", "softbox", "Softbox", "even softbox light"),
  pick("lighting", "flash", "Flash", "on-camera flash"),
];

export const picksIn = (category: BuilderCategory): readonly BuilderPick[] => BUILDER_PICKS.filter((one) => one.category === category);

/** One pick per category: picking another in the same category replaces it, picking it again removes it. */
export function togglePick(chosen: readonly BuilderPick[], next: BuilderPick): readonly BuilderPick[] {
  if (chosen.some((one) => one.id === next.id)) return chosen.filter((one) => one.id !== next.id);
  return [...chosen.filter((one) => one.category !== next.category), next];
}

/** "Surprise me": one pick in each category, chosen by `random` (0 ≤ r < 1), so a test can fix it. */
export function surprise(random: () => number): readonly BuilderPick[] {
  return BUILDER_CATEGORIES.map((category) => {
    const options = picksIn(category);
    return options[Math.min(options.length - 1, Math.floor(random() * options.length))]!;
  });
}

const join = (base: string, extra: string): string => {
  const head = base.trim().replace(/[.,;]+$/, "");
  return head === "" ? extra : `${head}, ${extra}`;
};

/** The prompt with the picks added after the person's own words. */
export const withPicks = (prompt: string, picks: readonly BuilderPick[]): string =>
  picks.length === 0 ? prompt : join(prompt, picks.map((one) => one.words).join(", "));

/**
 * The wand ("Enhance prompt"). There is no model behind it: it adds the chosen style's own light and
 * camera words (`SHOOT_STYLE_PROMPTS`, the words the shoot sends anyway), so the person sees them and
 * can edit them. A prompt that already holds them is left as it is.
 */
export function enhance(prompt: string, style: ShootStyle): string {
  const words = SHOOT_STYLE_PROMPTS[style].replace(/\.$/, "");
  if (prompt.toLowerCase().includes(words.toLowerCase())) return prompt;
  return join(prompt, words);
}
