"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getEnv } from "@/lib/config/env";
import { brandChartSet } from "@/lib/charts/service";
import { previewDiff } from "@/lib/design-diff/preview";
import { CONFLICT_MESSAGE, failureFromDatabase } from "@/lib/projects/database-errors";
import { flatPreview } from "@/lib/projects/flat-preview";
import { getProject } from "@/lib/projects/project-reads";
import { chooseModels } from "@/lib/providers/select";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, productionDeps, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { loadFactoryProfile } from "@/lib/validation/service";
import { cardById } from "./board";
import { applySchema, boardSchema, removeItemSchema, saveItemSchema, steerSchema, suggestSchema } from "./input";
import { itemFor } from "./moodboard";
import { pixelBreach } from "./no-pixels";
import { boardFor, designChecker, elementReader } from "./server";
import { readMoodboard, removeItem, saveItem, writeSteer } from "./store";
import { meteredReader, suggestCostMicrodollars } from "./suggest/metered";
import { suggestFromCard } from "./suggest/suggest";
import { boardView, moodboardView, suggestionsView } from "./view";

/**
 * The inspiration panel's actions (decision 0082). The brand and the person always come from the session. The board
 * is built again on the server for every call, so a card the browser names is only ever acted on when the board
 * really showed it; the browser's words are a key, never content.
 */

const NO_CARD = "That card is not on the board any more. Refresh the board and try again.";
const NO_MODEL = "Suggestions are not switched on here, so none was made. Nothing was changed.";
const NO_SUGGESTION = "That suggestion is not offered any more. Ask for suggestions again.";

/** The board of one design, with its moodboard. A read, so it is held to the read rate limit. */
export const inspirationBoardAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: boardSchema,
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const who = { brandId: session.brand.id, userId: session.userId };
    const project = await getProject(client, who.brandId, input.projectId);
    const [board, items] = await Promise.all([
      boardFor(client, who, input.projectId, project.spec, { productLinks: input.productLinks, withMoodImage: input.withMoodImage }),
      readMoodboard(client, who.brandId, input.projectId),
    ]);
    return { board: boardView(board), moodboard: moodboardView(items), version: project.currentVersion };
  },
});

/** Pins or removes one tag of the context query, or clears the steer. */
export const steerTagAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.editDesign,
  schema: steerSchema,
  handler: async ({ input, session }) => {
    await writeSteer(adminClient(), { brandId: session.brand.id, userId: session.userId }, input.projectId, input.tag, input.state);
    return { tag: input.tag, state: input.state };
  },
});

/** Saves one card to the design's moodboard: its address, its preview and its attribution, and nothing else. */
export const saveToMoodboardAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.editDesign,
  schema: saveItemSchema,
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const who = { brandId: session.brand.id, userId: session.userId };
    const project = await getProject(client, who.brandId, input.projectId);
    const board = await boardFor(client, who, input.projectId, project.spec, { productLinks: input.productLinks, withMoodImage: false });
    const card = cardById(board, input.cardId);
    if (card === null) throw new AppError("not_found", NO_CARD);
    const item = itemFor(card);
    if (!item.ok) throw new AppError("invalid_input", item.reason);
    const id = await saveItem(adminClient(), who, input.projectId, item.item);
    return { itemId: id };
  },
});

export const removeMoodboardItemAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.editDesign,
  schema: removeItemSchema,
  handler: async ({ input, session }) => {
    const gone = await removeItem(adminClient(), { brandId: session.brand.id, userId: session.userId }, input.itemId);
    return { removed: gone };
  },
});

/** The suggestions one card gives. Each patch goes through validation before it is in this answer. */
export const suggestFromCardAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.readImage,
  schema: suggestSchema,
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const who = { brandId: session.brand.id, userId: session.userId };
    const reader = elementReader();
    if (reader === null) throw new AppError("conflict", NO_MODEL);
    const project = await getProject(client, who.brandId, input.projectId);
    const board = await boardFor(client, who, input.projectId, project.spec, { productLinks: input.productLinks, withMoodImage: false });
    const card = cardById(board, input.cardId);
    if (card === null) throw new AppError("not_found", NO_CARD);
    const charts = await brandChartSet(client, who.brandId);
    const primary = chooseModels(getEnv()).primary;
    const metered = primary === null || primary === undefined ? reader : meteredReader(reader, productionDeps.usage, who, suggestCostMicrodollars(primary.entry), "inspiration/suggest");
    const made = await suggestFromCard(project.spec, card, {
      reader: metered,
      profile: await loadFactoryProfile(client),
      check: designChecker(client, who.brandId),
      draw: (design) => flatPreview(design, new Map(), charts)?.views[0]?.src ?? null,
    });
    return { ...suggestionsView(made), version: project.currentVersion };
  },
});

/** Applies one suggestion as the next version. The patch is worked out again and checked again before it is stored. */
export const applySuggestionAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.applyProposal,
  schema: applySchema,
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const who = { brandId: session.brand.id, userId: session.userId };
    const reader = elementReader();
    if (reader === null) throw new AppError("conflict", NO_MODEL);
    const project = await getProject(client, who.brandId, input.projectId);
    if (project.currentVersion !== input.expectedVersion) throw new AppError("conflict", CONFLICT_MESSAGE);
    const board = await boardFor(client, who, input.projectId, project.spec, { productLinks: input.productLinks, withMoodImage: false });
    const card = cardById(board, input.cardId);
    if (card === null) throw new AppError("not_found", NO_CARD);
    const profile = await loadFactoryProfile(client);
    const made = await suggestFromCard(project.spec, card, { reader, profile, check: designChecker(client, who.brandId) });
    const chosen = made.suggestions.find((entry) => entry.id === input.suggestionId);
    if (chosen === undefined) throw new AppError("conflict", NO_SUGGESTION);
    const preview = previewDiff(project.spec, chosen.diff, profile);
    if (!preview.ok) throw new AppError("conflict", preview.reason);
    // The last gate: a suggestion from an inspiration card can never change which pictures a design uses.
    const breach = pixelBreach(project.spec, preview.after, chosen.diff);
    if (breach !== null) throw new AppError("conflict", breach.reason);
    const { data, error } = await adminClient().rpc("append_spec_version", {
      p_project_id: input.projectId,
      p_user_id: who.userId,
      p_expected_version: input.expectedVersion,
      p_spec: preview.after,
      p_schema_version: preview.after.schemaVersion,
      p_note: `Applied an inspiration suggestion: ${chosen.line}`,
      p_restored_from: null,
    });
    if (error) throw failureFromDatabase(error);
    revalidatePath(`/studio/${input.projectId}`);
    return { version: z.number().int().min(1).parse(data) };
  },
});
