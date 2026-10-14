import { z } from "zod";
import { DRAFT_NOTICE } from "./dxf/write";

/**
 * A review is a named person's record against one pattern block version. Until there is one,
 * every file made from the pattern carries "Draft pattern, not reviewed." The library never
 * says "approved" or "verified": it says who reviewed it, in what role, and when.
 */

export const reviewInputSchema = z.object({
  reviewerName: z.string().trim().min(1, "Give the name of the person who reviewed the pattern.").max(120),
  reviewerRole: z.string().trim().max(60).default("technician"),
  note: z.string().trim().max(1000).default(""),
  reviewedOn: z.iso.date(),
});
export type ReviewInput = z.output<typeof reviewInputSchema>;

export type ReviewView = Readonly<{
  id: string;
  reviewerName: string;
  reviewerRole: string;
  note: string;
  reviewedOn: string;
}>;

/** The sentence a pattern file carries about its review: the latest one, or the draft notice. */
export function reviewLine(latest: Pick<ReviewView, "reviewerName" | "reviewerRole" | "reviewedOn"> | null): string {
  if (!latest) return DRAFT_NOTICE;
  return `Reviewed by ${latest.reviewerName} (${latest.reviewerRole || "technician"}) on ${latest.reviewedOn}.`;
}

/** The state of a block in words, for the library's list. */
export const reviewState = (latest: ReviewView | null): "reviewed" | "draft" => (latest ? "reviewed" : "draft");
