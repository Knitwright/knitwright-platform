import type { LaunchCostSource } from "@/lib/launch";
import { PLACEHOLDER_MODEL_CONFIG, videoModelsFrom, type VideoModel } from "@/lib/media/video/models";

/**
 * THE MODEL PICKER'S CARDS (decision 0149; `08` v3.2 "Model picker", v3.4 "Video model picker").
 *
 * **Video:** L5's model list, exactly as the AI video board panel reads it (`AiVideoPanel`:
 * `videoModelsFrom(PLACEHOLDER_MODEL_CONFIG)`), with its credits per second and its waiting estimate.
 * The bar's choice is written to the board's `modelKey`, which is what the run reads.
 *
 * **Image:** one card. An AI image board has no model setting -- the run uses the picture service the
 * platform is configured with (`chooseShootProvider`) -- so the bar offers that one and no more.
 * Kittl's 4K / Fast / Pro cards would be choices the run ignores, so they are not shown.
 */

export interface ModelCard {
  readonly key: string;
  readonly label: string;
  readonly lead: string;
  /** "≈ 12 s a second", or null when there is no estimate. */
  readonly wait: string | null;
  /** "1 credit a second", "20 credits a picture", or the reason it cannot run. */
  readonly price: string;
  readonly priced: boolean;
  readonly premium: boolean;
}

export const IMAGE_MODEL_KEY = "standard";

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

export function imageModelCards(costs: LaunchCostSource): readonly ModelCard[] {
  return [
    {
      key: IMAGE_MODEL_KEY,
      label: "Standard",
      lead: "The picture service this platform runs. Your garment stays the picture the platform drew.",
      wait: null,
      price: `${plural(Math.max(0, Math.round(costs.perGeneratedBoard)), "credit")} a picture`,
      priced: true,
      premium: false,
    },
  ];
}

const videoCard = (model: VideoModel): ModelCard => ({
  key: model.key,
  label: model.label,
  lead: model.lead,
  wait: `≈ ${model.estimatedWaitPerSecond} s a second`,
  price: model.creditsPerSecond === null ? "No price set yet" : `${plural(model.creditsPerSecond, "credit")} a second`,
  priced: model.creditsPerSecond !== null,
  premium: false,
});

/** The video models as the AI video board offers them, in the admin's order. */
export const videoModelCards = (models: readonly VideoModel[] = videoModelsFrom(PLACEHOLDER_MODEL_CONFIG)): readonly ModelCard[] => models.map(videoCard);

/** The card a key names, else the first offered: the bar always shows a model. */
export const cardOf = (cards: readonly ModelCard[], key: string | null): ModelCard | null => cards.find((one) => one.key === key) ?? cards[0] ?? null;

/** The search field over the cards. */
export const searchCards = (cards: readonly ModelCard[], query: string): readonly ModelCard[] => {
  const words = query.trim().toLowerCase();
  return words === "" ? cards : cards.filter((card) => `${card.label} ${card.lead}`.toLowerCase().includes(words));
};
