/**
 * The shapes every screen in F-G1 shares (decision 0073). A screen returns reasons; the result is the worst severity among them.
 * "note" records something a reviewer may want to know (a check that could not run) without holding anything back.
 */

export const RESULTS = ["clear", "flagged", "blocked"] as const;
export type ModerationResult = (typeof RESULTS)[number];

export type Severity = "note" | "flag" | "block";

export const TARGET_KINDS = ["asset", "text", "version", "generation"] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];

export type Hook = "upload" | "text" | "generation" | "order" | "review";

/**
 * The rulebook has no moderation entries yet (wave 1, X2). Every reason carries the gap id until it does, as the plan says;
 * the PR lists them.
 */
export const MODERATION_RULE_ID = "R-GAP-000";

export type ReasonCode =
  | "profanity"
  | "brand_term"
  | "dupe_title"
  | "inspired_by"
  | "mark_image_match"
  | "mark_image_near"
  | "hash_too_plain"
  | "vision_mark"
  | "vision_offensive"
  | "vision_unavailable"
  | "vision_not_configured"
  | "not_screened"
  | "awaiting_review"
  | "blocked_by_review"
  | "human_review_required";

export type Reason = Readonly<{
  code: ReasonCode;
  severity: Severity;
  /** Plain words a member or a reviewer reads. */
  message: string;
  ruleId: string;
  /** The word or mark that matched, when there is one. */
  term?: string;
}>;

export type Verdict = Readonly<{ result: ModerationResult; reasons: readonly Reason[] }>;

const RANK: Readonly<Record<Severity, number>> = { note: 0, flag: 1, block: 2 };

/** The verdict for a list of reasons: blocked if any reason blocks, flagged if any flags, else clear. */
export function verdictOf(reasons: readonly Reason[]): Verdict {
  const worst = reasons.reduce((max, r) => Math.max(max, RANK[r.severity]), 0);
  return { result: worst === 2 ? "blocked" : worst === 1 ? "flagged" : "clear", reasons };
}

export const reason = (code: ReasonCode, severity: Severity, message: string, term?: string): Reason =>
  term === undefined ? { code, severity, message, ruleId: MODERATION_RULE_ID } : { code, severity, message, ruleId: MODERATION_RULE_ID, term };

/** A protected mark as the screens read it. */
export type Mark = Readonly<{ id: string; holder: string; markText: string | null; imageHash: string | null }>;
