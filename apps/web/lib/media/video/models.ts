import { VIDEO_GAP_RULE } from "./formats";

/**
 * The AI video models the board offers (spec F-L3: "Model picker: cards with description, estimated
 * time and credits per second. Commercial-licence models only; the list is configured in admin").
 *
 * **The list is data, never a literal in this file's behaviour.** `videoModelsFrom` builds it from
 * three platform settings a platform admin sets at /admin/settings (`model-settings.ts`): which
 * models are offered, the credits a second of each, and which of them hold a commercial licence.
 * This file's catalogue is only the labelled placeholder that stands in until the owner answers, and
 * every entry says so.
 *
 * Two rules the type system carries rather than a reviewer:
 *
 *   * **credits a second may be unknown.** It is `number | null`, and a model whose price nobody has
 *     set cannot be run (`videoCost` says so in words). Charging against a price nobody set is worse
 *     than asking again.
 *   * **a commercial licence is a fact about the model, not an assumption.** `commercialLicence` is
 *     false until an admin lists the model as holding one, and `licenceLabel` puts that on the
 *     button, so nobody can read a clip as safe to sell a kit with.
 */

export interface VideoModel {
  readonly key: string;
  readonly label: string;
  /** The description on the card: what the model is good at, in plain words. */
  readonly lead: string;
  /** Roughly how many seconds of waiting one second of video takes. An estimate, for the card. */
  readonly estimatedWaitPerSecond: number;
  /** Credits one second of video costs, or null while nobody has set it. */
  readonly creditsPerSecond: number | null;
  /** True only when an admin has listed this model as holding a commercial licence. */
  readonly commercialLicence: boolean;
  /** True when the model can make a soundtrack of its own, so the Audio switch does something. */
  readonly audio: boolean;
  readonly ruleId: string;
  /** Where the row came from. Every seeded row says it was not reviewed by anyone. */
  readonly note: string;
}

/** What the placeholder catalogue says about itself. Shown above the picker. */
export const CATALOGUE_NOTE =
  "Knitwright placeholder: these models are the candidates the spec names. No licence, price or waiting time here has been reviewed by anyone.";

const placeholder = (
  key: string,
  label: string,
  lead: string,
  estimatedWaitPerSecond: number,
  audio: boolean,
): VideoModel => ({
  key,
  label,
  lead,
  estimatedWaitPerSecond,
  creditsPerSecond: null,
  commercialLicence: false,
  audio,
  ruleId: VIDEO_GAP_RULE,
  note: CATALOGUE_NOTE,
});

/**
 * The candidates `docs/spec/05-architecture.md` lists for the AI video board ("Kling, Veo, Wan,
 * Seedance via commercial providers; confirm licences"). Nothing is chosen here and nothing is
 * called from here: `board-provider.ts` decides what a run actually talks to, and with no key it is
 * the stub.
 */
export const MODEL_CATALOGUE: readonly VideoModel[] = [
  placeholder("kling-2.1-standard", "Kling 2.1 standard", "Image-to-video. The clip the existing studio clip already uses.", 12, false),
  placeholder("veo-3", "Veo 3", "Image-to-video with a soundtrack of its own.", 20, true),
  placeholder("wan-2.2", "Wan 2.2", "Image-to-video. Steady camera moves.", 10, false),
  placeholder("seedance-1", "Seedance 1", "Image-to-video. First and end frame together.", 14, false),
];

/** What an admin has set. Every field is a platform setting (`model-settings.ts`), never a literal. */
export interface VideoModelConfig {
  /** The keys offered in the picker, in the order they are shown. */
  readonly offered: readonly string[];
  /** Credits a second, by model key. A key with no entry is a model nobody has priced. */
  readonly creditsPerSecond: Readonly<Record<string, number>>;
  /** The keys an admin has listed as holding a commercial licence. */
  readonly commercialLicence: readonly string[];
}

/**
 * The models to show, in the admin's own order, with the admin's prices and licence flags on them.
 * A key the catalogue has no description for is left out rather than shown as a blank card:
 * `unknownModelKeys` names those, so the settings page can say the key was not recognised.
 */
export function videoModelsFrom(config: VideoModelConfig, catalogue: readonly VideoModel[] = MODEL_CATALOGUE): readonly VideoModel[] {
  return config.offered.flatMap((key) => {
    const row = catalogue.find((model) => model.key === key);
    if (!row) return [];
    const price = config.creditsPerSecond[key];
    return [
      {
        ...row,
        creditsPerSecond: typeof price === "number" && Number.isFinite(price) && price >= 0 ? price : null,
        commercialLicence: config.commercialLicence.includes(key),
      },
    ];
  });
}

/** The offered keys this catalogue cannot describe. Listed so a mistyped key is visible, not silent. */
export const unknownModelKeys = (config: VideoModelConfig, catalogue: readonly VideoModel[] = MODEL_CATALOGUE): readonly string[] =>
  config.offered.filter((key) => !catalogue.some((model) => model.key === key));

export const findModel = (models: readonly VideoModel[], key: unknown): VideoModel | null =>
  (typeof key === "string" ? models.find((model) => model.key === key) : undefined) ?? null;

export type VideoCost =
  | Readonly<{ priced: true; credits: number; perSecond: number; label: string; ruleId: string }>
  | Readonly<{ priced: false; reason: string; label: string; ruleId: string }>;

const credits = (count: number): string => `${count} ${count === 1 ? "credit" : "credits"}`;

/**
 * What a run of this model for this many seconds costs, as the words that go on the Generate button
 * (spec F-L3: "Generate shows the cost first"). A model nobody has priced cannot be run, and the
 * button says that instead of a number.
 */
export function videoCost(model: VideoModel, seconds: number): VideoCost {
  const perSecond = model.creditsPerSecond;
  if (perSecond === null) {
    return {
      priced: false,
      reason: `Nobody has set what a second of ${model.label} costs, so it cannot be run yet.`,
      label: "Credits a second not set",
      ruleId: model.ruleId,
    };
  }
  const total = Math.ceil(perSecond * Math.max(0, seconds));
  return { priced: true, credits: total, perSecond, label: `Generate (${credits(total)})`, ruleId: model.ruleId };
}

/** The licence words on the model's card and on the button. A model with no commercial licence says so. */
export const licenceLabel = (model: VideoModel): string =>
  model.commercialLicence ? "Commercial licence" : "Commercial licence not confirmed";

/** True when the Audio switch does anything for this model, so the panel can say why it is off. */
export const audioAvailable = (model: VideoModel): boolean => model.audio;

/** Roughly how long a run will take, in seconds, for the "Generating mm:ss" placeholder. */
export const estimatedWait = (model: VideoModel, seconds: number): number =>
  Math.max(1, Math.round(model.estimatedWaitPerSecond * Math.max(0, seconds)));
