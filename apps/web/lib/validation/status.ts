import { z } from "zod";
import type { Finding } from "@/lib/production/contract";
import { findingsHash } from "./hash";

/**
 * The states of a design version (spec F-0): draft, validated, approved, ordered. "validated" only means no blockers
 * against one factory profile on one date; "approved" means a member of the brand accepted that version for ordering.
 * Editing any version stores a new version, which starts as a draft.
 */
export const VERSION_STATUSES = ["draft", "validated", "approved", "ordered"] as const;
export const versionStatusSchema = z.enum(VERSION_STATUSES);
export type VersionStatus = z.output<typeof versionStatusSchema>;

/** What a status row holds. A draft holds no profile. */
export interface StatusRecord {
  readonly status: VersionStatus;
  readonly profileId: string | null;
  readonly findingsHash: string | null;
  /** ISO date and time of the last move. */
  readonly at: string | null;
}

export const DRAFT: StatusRecord = { status: "draft", profileId: null, findingsHash: null, at: null };

/**
 * The only moves. A validated version may go back to draft; an approved one only goes on to ordered; an ordered one never
 * moves. Ordering straight from validated stays allowed until the owner says every order needs an approval (decision 0069).
 */
const MOVES: Readonly<Record<VersionStatus, readonly VersionStatus[]>> = {
  draft: ["validated"],
  validated: ["draft", "approved", "ordered"],
  approved: ["ordered"],
  ordered: [],
};

export const canMove = (from: VersionStatus, to: VersionStatus): boolean => MOVES[from].includes(to);

type Transition = { readonly ok: true; readonly record: StatusRecord } | { readonly ok: false; readonly reason: string };

interface TransitionContext {
  readonly profileId: string;
  readonly findings: readonly Finding[];
  readonly at: Date;
}

/** Returns the new record, or the reason the move is refused. Never changes `from`. */
export function transition(from: StatusRecord, to: VersionStatus, context: TransitionContext): Transition {
  if (!canMove(from.status, to)) return { ok: false, reason: `A design that is ${from.status} cannot move to ${to}.` };
  const blockers = context.findings.filter((f) => f.severity === "blocker");
  if (to !== "draft" && blockers.length > 0) {
    return { ok: false, reason: `${blockers.length} ${blockers.length === 1 ? "blocker is" : "blockers are"} still open.` };
  }
  if (to === "draft") return { ok: true, record: { ...DRAFT, at: context.at.toISOString() } };
  return {
    ok: true,
    record: { status: to, profileId: context.profileId, findingsHash: findingsHash(context.findings), at: context.at.toISOString() },
  };
}

/** "No blockers against profile X on date D": the one thing "validated" means. */
export function statusSentence(record: StatusRecord): string {
  if (record.status === "draft") return "Draft. Not yet looked at against a factory profile.";
  const day = record.at?.slice(0, 10) ?? "an unknown date";
  const base = `No blockers against profile ${record.profileId} on ${day}.`;
  if (record.status === "approved") return `Accepted for ordering by the brand. ${base}`;
  return record.status === "ordered" ? `Ordered. ${base}` : base;
}
