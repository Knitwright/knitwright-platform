import type { GenerationGate, HumanReviewGate, OrderGate, UploadGate } from "../gate";
import { AppError } from "@/lib/server/core/errors";
import { reason, verdictOf, type Verdict } from "../types";

/**
 * The screening gates as test doubles (H3 of the v5 security review, decision 0116).
 *
 * Every generation path, every order path and the Class B hand-off now takes one of these gates, so
 * every test of those paths needs one. These say "clear" and record what they were asked, which is
 * what a test asserts on; `blockingGate` and its siblings are the refusing versions.
 *
 * None of them screens anything: the screens themselves are tested against the real rules in
 * `lib/moderation/hooks.test.ts` and `lib/moderation/text.test.ts`.
 */

const CLEAR: Verdict = { result: "clear", reasons: [] };

const BLOCKED: Verdict = verdictOf([reason("blocked_by_review", "block", "This contains a word we do not print.")]);

const FLAGGED: Verdict = verdictOf([reason("awaiting_review", "flag", "A person will look at this before it is made.")]);

export type UploadAsk = Readonly<{ label: string; sourceSha256: string; bytes: number }>;

/**
 * An upload gate that clears everything, with the asks it was given and the asset ids it was told
 * about afterwards. `screen` is required on `uploadArtwork` now (H3), so every test of an upload
 * path passes one of these.
 */
export function clearUploads(): UploadGate & { readonly asks: UploadAsk[]; readonly kept: string[] } {
  const asks: UploadAsk[] = [];
  const kept: string[] = [];
  const gate = async (input: Parameters<UploadGate>[0]) => {
    asks.push({ label: input.label, sourceSha256: input.sourceSha256, bytes: input.image.byteLength });
    return async (assetId: string) => void kept.push(assetId);
  };
  return Object.assign(gate, { asks, kept });
}

/** An upload gate that refuses, the way `screenUpload` refuses a blocked upload: before anything is stored. */
export function blockUploads(): UploadGate & { readonly asks: UploadAsk[] } {
  const asks: UploadAsk[] = [];
  const gate = async (input: Parameters<UploadGate>[0]) => {
    asks.push({ label: input.label, sourceSha256: input.sourceSha256, bytes: input.image.byteLength });
    throw new AppError("invalid_input", "This contains a word we do not print.", { file: ["This contains a word we do not print."] });
  };
  return Object.assign(gate, { asks });
}

export type GenerationAsk = Readonly<{ generationId: string; prompt: string; bytes: number }>;

/** A generation gate that clears everything, with the asks it was given. */
export function clearGenerations(): GenerationGate & { readonly asks: GenerationAsk[] } {
  const asks: GenerationAsk[] = [];
  const gate = async (input: Parameters<GenerationGate>[0]): Promise<Verdict> => {
    asks.push({ generationId: input.generationId, prompt: input.prompt, bytes: input.image.byteLength });
    return CLEAR;
  };
  return Object.assign(gate, { asks });
}

/** A generation gate that blocks everything, for the tests that watch a picture not be kept. */
export function blockGenerations(): GenerationGate & { readonly asks: GenerationAsk[] } {
  const asks: GenerationAsk[] = [];
  const gate = async (input: Parameters<GenerationGate>[0]): Promise<Verdict> => {
    asks.push({ generationId: input.generationId, prompt: input.prompt, bytes: input.image.byteLength });
    return BLOCKED;
  };
  return Object.assign(gate, { asks });
}

export type OrderAsk = Parameters<OrderGate>[0];

/** An order gate with the verdict to give back, and the asks it was given. */
export function orderGateOf(verdict: Verdict = CLEAR): OrderGate & { readonly asks: OrderAsk[] } {
  const asks: OrderAsk[] = [];
  const gate = async (input: OrderAsk): Promise<Verdict> => {
    asks.push(input);
    return verdict;
  };
  return Object.assign(gate, { asks });
}

export const clearOrders = (): ReturnType<typeof orderGateOf> => orderGateOf(CLEAR);
export const blockOrders = (): ReturnType<typeof orderGateOf> => orderGateOf(BLOCKED);
export const flagOrders = (): ReturnType<typeof orderGateOf> => orderGateOf(FLAGGED);

/** A human-review gate that lets everything through, with the versions it was asked about. */
export function reviewedAlways(): HumanReviewGate & { readonly asked: string[] } {
  const asked: string[] = [];
  const gate = async (versionId: string): Promise<void> => void asked.push(versionId);
  return Object.assign(gate, { asked });
}

/** A human-review gate that refuses, the way `assertHumanReviewed` refuses. */
export function reviewedNever(): HumanReviewGate & { readonly asked: string[] } {
  const asked: string[] = [];
  const gate = async (versionId: string): Promise<void> => {
    asked.push(versionId);
    throw new AppError("conflict", "This design needs our review before a run can start. It is in the review queue.");
  };
  return Object.assign(gate, { asked });
}
