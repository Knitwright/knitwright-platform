import type { DesignStatus, Finding } from "@/lib/production/contract";
import { findingsHash } from "./hash";

/** What a status row holds. A draft holds no profile. */
export interface StatusRecord {
  readonly status: DesignStatus;
  readonly profileId: string | null;
  readonly findingsHash: string | null;
  /** ISO date and time of the last move. */
  readonly at: string | null;
}

export const DRAFT: StatusRecord = { status: "draft", profileId: null, findingsHash: null, at: null };

/** The only moves. A design that is changed goes back to draft; an ordered version never moves. */
const MOVES: Readonly<Record<DesignStatus, readonly DesignStatus[]>> = {
  draft: ["validated"],
  validated: ["draft", "ordered"],
  ordered: [],
};

export const canMove = (from: DesignStatus, to: DesignStatus): boolean => MOVES[from].includes(to);

export type Transition = { readonly ok: true; readonly record: StatusRecord } | { readonly ok: false; readonly reason: string };

export interface TransitionContext {
  readonly profileId: string;
  readonly findings: readonly Finding[];
  readonly at: Date;
}

/** Returns the new record, or the reason the move is refused. Never changes `from`. */
export function transition(from: StatusRecord, to: DesignStatus, context: TransitionContext): Transition {
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
  return record.status === "ordered" ? `Ordered. ${base}` : base;
}
