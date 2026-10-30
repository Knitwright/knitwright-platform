"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { LIMITS } from "@/lib/server/limits";
import { applyCorrection } from "./corrections";
import { addPhotoSchema, addReviewTextSchema, addUrlSchema, confirmCardSchema, newBenchmarkSchema, removeCardSchema } from "./inputs";
import { imageForCard } from "./photo";
import { addCardFromPhoto, addCardFromReviewText, addCardFromUrl, type IntakeResult } from "./service";
import { benchmarkDeps, benchmarkStore } from "./server";

/**
 * The benchmark actions (spec F-S2, decision 0084). Every one takes its brand from the session, so a body can never
 * name another brand's benchmark, and every refusal comes back as words a person can act on rather than a code.
 */

const PATH = "/studio/benchmarks";

const refreshed = (benchmarkId: string): void => {
  revalidatePath(PATH);
  revalidatePath(`${PATH}/${benchmarkId}`);
};

/** An intake that was refused comes back as an error with the reason in words, so the screen says what happened. */
const settle = (outcome: IntakeResult, benchmarkId: string): Readonly<{ cardId: string }> => {
  if (!outcome.ok) {
    throw new AppError(outcome.reason === "rate_limited" ? "rate_limited" : "invalid_input", outcome.message);
  }
  refreshed(benchmarkId);
  return { cardId: outcome.cardId };
};

export const createBenchmarkAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.benchmarkWrite,
  schema: newBenchmarkSchema,
  handler: async ({ input, session }) => {
    const store = await benchmarkStore();
    const id = await store.create(
      { brandId: session.brand.id, userId: session.userId },
      { title: input.title, projectId: input.projectId === "" ? null : (input.projectId ?? null) },
    );
    revalidatePath(PATH);
    return { benchmarkId: id };
  },
});

/** One URL, fetched once, logged out, robots.txt honoured, within this brand's own allowance (spec F-S2 step 2). */
export const addBenchmarkUrlAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.benchmarkIntake,
  schema: addUrlSchema,
  handler: async ({ input, session }) => {
    const who = { brandId: session.brand.id, userId: session.userId };
    const deps = await benchmarkDeps(who, "benchmark-url");
    return settle(await addCardFromUrl(deps, who, input), input.benchmarkId);
  },
});

/** The person's own photograph, already in their brand's files. Nothing is fetched from anybody. */
export const addBenchmarkPhotoAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.benchmarkIntake,
  schema: addPhotoSchema,
  handler: async ({ input, session }) => {
    const who = { brandId: session.brand.id, userId: session.userId };
    const deps = await benchmarkDeps(who, "benchmark-photo");
    const image = await imageForCard(who, input.fileId);
    return settle(await addCardFromPhoto(deps, who, { ...input, image }), input.benchmarkId);
  },
});

/** Review text a person pasted. Read once; only short paraphrases of the themes are kept. */
export const addBenchmarkReviewTextAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.benchmarkIntake,
  schema: addReviewTextSchema,
  handler: async ({ input, session }) => {
    const who = { brandId: session.brand.id, userId: session.userId };
    const deps = await benchmarkDeps(who, "benchmark-reviews");
    return settle(await addCardFromReviewText(deps, who, input), input.benchmarkId);
  },
});

/** A person confirms the card as it stands, or corrects any field of it (spec F-S2 step 4). */
export const confirmBenchmarkCardAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.benchmarkWrite,
  schema: confirmCardSchema,
  handler: async ({ input, session }) => {
    const who = { brandId: session.brand.id, userId: session.userId };
    const store = await benchmarkStore();
    const held = await store.read(who, input.benchmarkId);
    const card = held?.cards.find((candidate) => candidate.id === input.cardId);
    if (card === undefined) throw new AppError("not_found", "That card could not be found.");
    await store.confirmCard(who, { cardId: input.cardId, card: applyCorrection(card.card, input) });
    refreshed(input.benchmarkId);
    return { cardId: input.cardId };
  },
});

export const removeBenchmarkCardAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.benchmarkWrite,
  schema: removeCardSchema,
  handler: async ({ input, session }) => {
    const store = await benchmarkStore();
    await store.removeCard({ brandId: session.brand.id, userId: session.userId }, input.cardId);
    refreshed(input.benchmarkId);
    return { cardId: input.cardId };
  },
});
