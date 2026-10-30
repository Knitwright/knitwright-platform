import { z } from "zod";
import { MAX_VERSION } from "@/lib/projects/schemas";
import { tagText } from "./context-query";
import { referenceUrlSchema } from "./moodboard";
import { CARD_SOURCES, MAX_TAGS, TAG_STATES } from "./vocabulary";

/**
 * What the panel may send (decision 0082). Every card the browser names is looked up on a board the server builds
 * again, so a card the board never showed can never be saved: the browser's words are a key, never the content.
 */

const projectId = z.uuid("That is not a design.");

/** A link the person added, which becomes a link-preview card. The page is fetched once and nothing is stored. */
const productLinks = z.array(referenceUrlSchema).max(5).default([]);

export const boardSchema = z.object({
  projectId,
  productLinks,
  /** True only when the person pressed the button for a mood image, so no refresh spends money by itself. */
  withMoodImage: z.boolean().default(false),
});

export const steerSchema = z.object({
  projectId,
  tag: z.string().min(1).max(40).transform(tagText),
  state: z.enum(TAG_STATES).nullable(),
});

export const saveItemSchema = z.object({
  projectId,
  productLinks,
  /** The card's id, as the board gave it. */
  cardId: z.string().min(1).max(300),
});

export const removeItemSchema = z.object({ projectId, itemId: z.uuid() });

export const suggestSchema = z.object({
  projectId,
  productLinks,
  cardId: z.string().min(1).max(300),
});

export const applySchema = z.object({
  projectId,
  expectedVersion: z.number().int().min(1).max(MAX_VERSION),
  /** The suggestion's id, as the suggestion answer gave it. The patch itself is worked out again on the server. */
  suggestionId: z.string().min(1).max(600),
  cardId: z.string().min(1).max(300),
  productLinks,
});

/** The sources a person can be shown, for a test that the panel and the database agree on the list. */
export const sourceSchema = z.enum(CARD_SOURCES);

/** The most tags a steer may hold before the board stops reading more. Mirrors the database's own limit. */
export const MAX_STEERED_TAGS = MAX_TAGS * 4;
