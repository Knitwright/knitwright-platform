import type { ImageProvider } from "@/lib/providers/image-provider";
import { microdollars } from "@/lib/usage/cost";
import type { UsageMeter } from "@/lib/usage/meter";
import type { ContextQuery, InspirationCard } from "../types";
import { AI_MOOD_LABEL, AI_MOOD_NOTE } from "../vocabulary";
import { card, type CardProvider } from "./source";

/**
 * AI mood images (spec F-S1, last row): a picture made from the context query through the **existing** image provider
 * interface (`lib/providers`), marked "AI mood image" wherever it is shown. It is inspiration only.
 *
 * Three things hold here and are tested:
 *  * the model is never asked to draw the garment: the prompt asks for a mood photograph of colour and texture, and
 *    the request carries no flat drawing of the design, unlike every garment render in the product;
 *  * the picture is never stored and can never be saved to a moodboard, so no generated pixel is ever placed;
 *  * the call is paid, so it goes through the usage meter first and the cost is given back when it fails.
 */

/** A mood image is one call to an image model. The estimate is a labelled default, not a measured price. */
export const MOOD_IMAGE_COST_MICRODOLLARS = microdollars(0.04);

/** How many mood images one refresh asks for. One: the dearest source is the smallest. */
export const MOOD_IMAGES_PER_REFRESH = 1;

/** Said when the brand's AI allowance is used up. The rest of the board still works. */
export const ALLOWANCE_USED_UP = "The AI allowance for this month is used up, so no mood image was made.";

/**
 * The prompt. It asks for a mood board photograph, never a garment: a model that drew a garment here would still never
 * reach a panel (the picture is not storable), but asking for one at all would be against spec decision 13.
 */
export const moodPrompt = (query: ContextQuery): string =>
  [
    "A mood board photograph: colour, light and texture only.",
    `The mood: ${query.text.trim() === "" ? "sport, movement, daylight" : query.text.trim()}.`,
    "No garment, no clothing, no person, no logo and no text in the picture.",
  ].join(" ");

type Who = Readonly<{ brandId: string; userId: string }>;

const dataUrl = (bytes: Uint8Array, contentType: string): string => `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;

/**
 * The AI mood source, built only when an image provider is configured. The bytes come back as a data address inside
 * the one answer: nothing is written to storage, so the picture lives for as long as the panel is open and no longer.
 */
export function aiMoodProvider(provider: ImageProvider, meter: UsageMeter, who: Who, route = "inspiration/mood"): CardProvider {
  return {
    source: "ai-mood",
    name: provider.name,
    async search(query, signal) {
      const reservation = await meter.reserve({
        userId: who.userId,
        brandId: who.brandId,
        cost: { feature: "photoreal", microdollars: MOOD_IMAGE_COST_MICRODOLLARS },
        route,
      });
      if (!reservation.ok) throw new Error(ALLOWANCE_USED_UP);
      try {
        const made = await provider.generate({ prompt: moodPrompt(query), reference: new Uint8Array() }, signal);
        return [moodCard(query, dataUrl(made.bytes, made.contentType))];
      } catch (error) {
        await meter.refund(reservation.eventId).catch(() => false);
        throw error;
      }
    },
  };
}

/** The card a mood image becomes: labelled, owned by nobody else, and plainly not saveable. */
export function moodCard(query: ContextQuery, previewUrl: string): InspirationCard {
  return card("ai-mood", {
    id: `ai-mood:${query.text}`,
    title: `${AI_MOOD_LABEL}: ${query.text.trim() === "" ? "your design" : query.text.trim()}`,
    // There is no page behind a picture nobody stored, so the card opens nothing but itself.
    openUrl: previewUrl,
    previewUrl,
    aiLabel: AI_MOOD_LABEL,
    owned: false,
    unsaveable: "An AI mood image is not stored, so it cannot be saved to a moodboard. Make it again from the same tags.",
    attribution: { creator: null, creatorUrl: null, provider: AI_MOOD_LABEL, providerUrl: null, notice: AI_MOOD_NOTE },
  });
}
