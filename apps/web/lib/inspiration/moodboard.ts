import { z } from "zod";
import type { InspirationCard, MoodboardItem } from "./types";
import { CARD_SOURCES } from "./vocabulary";

/**
 * The moodboard (spec F-S1, "Moodboard"). A saved item keeps **the address, the preview and the attribution, and
 * nothing else**: no third-party HTML, no copy of anyone's picture, and no bytes of any kind. The database column
 * checks say the same thing, so a row that broke this rule could not be stored even by the server.
 */

/** Said when a card cannot be saved because its picture is not somebody's served address. */
export const NOT_A_REFERENCE = "Only a picture a provider serves can be saved to a moodboard; nothing is copied here.";

/** Said when a moodboard is full. A labelled limit, not a measured one. */
export const MOODBOARD_LIMIT = 60;
export const FULL_SENTENCE = `A moodboard holds ${MOODBOARD_LIMIT} items. Remove one to save another.`;

/**
 * The only address a saved item may hold: an https address of a page or a picture. A `data:`, `blob:` or `file:`
 * address carries the picture itself, which is exactly what must never be stored, so each is refused by name.
 */
export const referenceUrlSchema = z
  .string()
  .max(2048)
  .refine((value) => value.startsWith("https://"), NOT_A_REFERENCE);

const attributionSchema = z.strictObject({
  creator: z.string().max(120).nullable(),
  creatorUrl: referenceUrlSchema.nullable(),
  provider: z.string().min(1).max(120),
  providerUrl: referenceUrlSchema.nullable(),
  notice: z.string().min(1).max(300),
});

/** What is stored for one item. Every field is words or an address; there is no field a picture could hide in. */
export const moodboardItemSchema = z.strictObject({
  source: z.enum(CARD_SOURCES),
  title: z.string().min(1).max(200),
  openUrl: referenceUrlSchema,
  previewUrl: referenceUrlSchema,
  attribution: attributionSchema,
});
export type MoodboardItemInput = z.output<typeof moodboardItemSchema>;

export type Saveable = { readonly ok: true; readonly item: MoodboardItemInput } | { readonly ok: false; readonly reason: string };

/**
 * The item a card would be saved as, or why it cannot be. An AI mood image says so itself: it is never stored, so
 * there is no address to keep, and the person is told to make it again from the same tags.
 */
export function itemFor(card: InspirationCard): Saveable {
  if (card.unsaveable !== undefined) return { ok: false, reason: card.unsaveable };
  const parsed = moodboardItemSchema.safeParse({
    source: card.source,
    title: card.title,
    openUrl: card.openUrl,
    previewUrl: card.previewUrl,
    attribution: card.attribution,
  });
  return parsed.success ? { ok: true, item: parsed.data } : { ok: false, reason: parsed.error.issues[0]?.message ?? NOT_A_REFERENCE };
}

/** Reads a stored row back as an item. A row that no longer reads is left out rather than shown half-broken. */
export function itemsFrom(rows: readonly unknown[]): readonly MoodboardItem[] {
  const schema = moodboardItemSchema.extend({ id: z.uuid(), addedAt: z.string() });
  return rows.flatMap((row) => {
    const parsed = schema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}
