import { z } from "zod";
import { reviewReady } from "@/lib/intent/image-input";

/**
 * The review screen for a sketch or photo, as a pure reducer (plan step 13, task 3). The
 * picture is shown beside the design it was read as. Nothing is applied until the person
 * has confirmed the garment type and every construction choice, and presses apply.
 */

const flatView = z.object({ view: z.string(), label: z.string(), src: z.string(), alt: z.string() });

const proposalSchema = z.object({
  kind: z.literal("proposal"),
  explanations: z.array(z.string()),
  notes: z.array(z.string()),
  confirmations: z.array(z.object({ id: z.string(), label: z.string() })),
  token: z.string(),
  flat: z.object({ views: z.array(flatView), notice: z.string().nullable().optional() }).passthrough().nullable(),
});
const rejectionSchema = z.object({ kind: z.literal("rejection"), reason: z.string() });

export type ImageAnswer = z.output<typeof proposalSchema> | z.output<typeof rejectionSchema>;

const answerSchema = z.union([
  z.object({ success: z.literal(true), data: z.union([proposalSchema, rejectionSchema]) }),
  z.object({ success: z.literal(false), error: z.object({ message: z.string() }) }),
]);

const UNREADABLE_ANSWER = "The answer could not be read. Nothing was changed. Try again.";

/** The route's answer, or its refusal, as one of two kinds. */
export function parseImageAnswer(body: unknown): ImageAnswer {
  const parsed = answerSchema.safeParse(body);
  if (!parsed.success) return { kind: "rejection", reason: UNREADABLE_ANSWER };
  return parsed.data.success ? parsed.data.data : { kind: "rejection", reason: parsed.data.error.message };
}

export type ReviewStage = "idle" | "uploading" | "reading" | "review" | "applying" | "done" | "failed";

export interface ReviewState {
  readonly stage: ReviewStage;
  /** A local address for the chosen picture, shown beside the proposal. */
  readonly previewUrl: string | null;
  readonly proposal: Extract<ImageAnswer, { kind: "proposal" }> | null;
  readonly ticked: readonly string[];
  readonly message: string | null;
}

export type ReviewEvent =
  | { readonly type: "chosen"; readonly previewUrl: string }
  | { readonly type: "uploaded" }
  | { readonly type: "read"; readonly answer: ImageAnswer }
  | { readonly type: "tick"; readonly id: string; readonly on: boolean }
  | { readonly type: "applying" }
  | { readonly type: "applied" }
  | { readonly type: "failed"; readonly message: string }
  | { readonly type: "discard" };

export const initialReview: ReviewState = { stage: "idle", previewUrl: null, proposal: null, ticked: [], message: null };

function tick(state: ReviewState, id: string, on: boolean): ReviewState {
  if (!state.proposal?.confirmations.some((entry) => entry.id === id)) return state;
  const rest = state.ticked.filter((entry) => entry !== id);
  return { ...state, ticked: on ? [...rest, id] : rest };
}

export function imageReviewReducer(state: ReviewState, event: ReviewEvent): ReviewState {
  switch (event.type) {
    case "chosen":
      return { ...initialReview, stage: "uploading", previewUrl: event.previewUrl };
    case "uploaded":
      return { ...state, stage: "reading" };
    case "read":
      return event.answer.kind === "proposal"
        ? { ...state, stage: "review", proposal: event.answer, ticked: [], message: null }
        : { ...state, stage: "failed", proposal: null, message: event.answer.reason };
    case "tick":
      return tick(state, event.id, event.on);
    case "applying":
      return canApply(state) ? { ...state, stage: "applying" } : state;
    case "applied":
      return { ...state, stage: "done", message: null };
    case "failed":
      return { ...state, stage: "failed", message: event.message };
    case "discard":
      return initialReview;
  }
}

/** True only on the review, once every confirmation is ticked. */
export const canApply = (state: ReviewState): boolean =>
  state.stage === "review" && state.proposal !== null && reviewReady(state.proposal.confirmations, new Set(state.ticked));
