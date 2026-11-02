import { COMMITTEE_SLOTS, slotLabel, type CommitteeSlot } from "./fields";

/**
 * What a committee said, counted for the club's own screen (spec F-T3, plan v5 Z7).
 *
 * A vote is one browser's choice and a browser may change it, exactly as a share answer may be
 * changed (decision 0026). So the tally is a guide, never a ballot, and the words say so.
 */

export interface CommitteeVote {
  readonly slot: CommitteeSlot;
  readonly name: string;
  readonly updatedAt: string;
}

export interface CommitteePin {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly panelId: string;
  readonly xMm: number;
  readonly yMm: number;
  readonly body: string;
  readonly createdAt: string;
}

export interface CommitteeApproval {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly email: string | null;
  readonly approvedAt: string;
}

export interface SlotCount {
  readonly slot: CommitteeSlot;
  readonly label: string;
  readonly version: number;
  readonly votes: number;
  readonly approvals: number;
}

/** The versions a link shows, slot by slot. */
export type SlotVersions = readonly Readonly<{ slot: CommitteeSlot; version: number }>[];

/** One count per slot the link shows, in slot order, with the votes and approvals against it. */
export function countBySlot(
  slots: SlotVersions,
  votes: readonly CommitteeVote[],
  approvals: readonly CommitteeApproval[],
): readonly SlotCount[] {
  const inOrder = COMMITTEE_SLOTS.flatMap((slot) => {
    const found = slots.find((entry) => entry.slot === slot);
    return found ? [found] : [];
  });
  return inOrder.map((entry) => ({
    slot: entry.slot,
    label: slotLabel(entry.slot),
    version: entry.version,
    votes: votes.filter((vote) => vote.slot === entry.slot).length,
    approvals: approvals.filter((approval) => approval.version === entry.version).length,
  }));
}

/** One line a club reads at a glance. It never calls a count a decision. */
export function tallyLine(counts: readonly SlotCount[]): string {
  const votes = counts.reduce((total, count) => total + count.votes, 0);
  if (votes === 0) return "No votes yet.";
  const parts = counts.map((count) => `${count.label}: ${count.votes}`);
  return `${parts.join(", ")}. One vote per browser, so this is a guide, not a ballot.`;
}

/** The slot with the most votes, or null where nothing leads on its own (no votes, or a tie). */
export function leadingSlot(counts: readonly SlotCount[]): CommitteeSlot | null {
  const most = counts.reduce((top, count) => Math.max(top, count.votes), 0);
  if (most === 0) return null;
  const leaders = counts.filter((count) => count.votes === most);
  return leaders.length === 1 && leaders[0] ? leaders[0].slot : null;
}

/** Approvals newest first, as a club reads them: who, under what name, when, against which version. */
export const approvalsNewestFirst = (approvals: readonly CommitteeApproval[]): readonly CommitteeApproval[] =>
  [...approvals].sort((left, right) => right.approvedAt.localeCompare(left.approvedAt) || right.id.localeCompare(left.id));

/** The pins left against one version, oldest first, as a thread reads (decision 0063). */
export const pinsOfVersion = (pins: readonly CommitteePin[], version: number): readonly CommitteePin[] =>
  pins.filter((pin) => pin.version === version).sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
