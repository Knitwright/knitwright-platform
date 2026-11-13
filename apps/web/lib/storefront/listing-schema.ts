import { z } from "zod";
import { CHANNELS, CURRENCIES, DESCRIPTION_MAX, LISTING_MODES, MAX_MEDIA, MAX_TAG_LENGTH, MAX_TAGS, TITLE_MAX } from "./listing";

/**
 * The listing's checks on the server (plan v6 C3, decision 0154), apart from `listing.ts` so the editor's client code
 * carries no zod.
 */

export const mediaItem = z.object({
  id: z.string().min(1).max(80),
  source: z.enum(["render", "flow"]),
  /** For a render, the view ("front"); for a flow item, the file id. */
  ref: z.string().min(1).max(80),
  label: z.string().max(120),
  aiLabel: z.string().max(40).nullable(),
});

const minor = z.number().int().min(0).max(10_000_000);
const tag = z.string().trim().min(1).max(MAX_TAG_LENGTH);

/** What the editor saves. The brand and the product come from the server, never from the body. */
export const listingDraftBody = z.object({
  productId: z.uuid(),
  title: z.string().trim().max(TITLE_MAX),
  description: z.string().max(DESCRIPTION_MAX),
  tags: z.array(tag).max(MAX_TAGS),
  showSizeTable: z.boolean(),
  media: z.array(mediaItem).max(MAX_MEDIA),
  personalisation: z
    .object({
      enabled: z.boolean(),
      nameMax: z.number().int().min(1).max(20),
      numberMin: z.number().int().min(0).max(999),
      numberMax: z.number().int().min(0).max(999),
      extraMinor: z.number().int().min(0).max(100_000),
    })
    .refine((p) => p.numberMax >= p.numberMin, { message: "The highest number must not be below the lowest.", path: ["numberMax"] }),
  currency: z.enum(CURRENCIES),
  prices: z.record(z.string().min(1).max(16), minor).refine((p) => Object.keys(p).length <= 40, "At most 40 sizes."),
  mode: z.enum(LISTING_MODES),
  channel: z.enum(CHANNELS),
  hideUntilReady: z.boolean(),
  syncMockups: z.boolean(),
  fabricKey: z.string().trim().min(1).max(120).nullable(),
});
