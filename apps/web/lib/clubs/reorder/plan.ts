import { createHash } from "node:crypto";
import type { RosterRow } from "@/lib/production/contract";
import type { Player } from "../roster";

/**
 * A reorder is planned from the club's saved player sizes (a season's roster) or from the earlier
 * order's own list. Nothing is dropped and nothing is guessed: whatever no longer fits becomes a line
 * with a reason, for a person to settle. Names are personal data (decision 0027): a plan lives for one
 * request, is never logged and is never stored.
 */

export type Reason = "size-removed" | "player-left" | "no-number";
export type Change = "same" | "size-changed" | "new-player";

/** A row that may still lack a valid number or size. A confirmed order holds only valid `RosterRow`s. */
export type LineRow = Readonly<{ name: string; number: string; sizeLabel: string; cut: RosterRow["cut"]; quantity: number }>;

export interface PlanLine {
  readonly index: number;
  readonly row: LineRow;
  readonly reasons: readonly Reason[];
  readonly messages: readonly string[];
  readonly change: Change;
  /** The size on the earlier order when the saved size is different, else null. */
  readonly previousSize: string | null;
}

export interface ReorderPlan {
  readonly lines: readonly PlanLine[];
  readonly run: readonly string[];
  readonly counts: Readonly<{ ready: number; fix: number; sizeChanged: number; newPlayers: number }>;
}

type PlanInput = Readonly<{
  /** The chosen season's players, or null to reorder the earlier order's own list. */
  players: readonly Player[] | null;
  /** The earlier order's rows, or null when its list is gone. */
  previous: readonly RosterRow[] | null;
  /** The design's sizes today. Empty when it has none, and sizes are then not compared. */
  run: readonly string[];
}>;

const NUMBER = /^[0-9]{1,3}$/;
const identity = (name: string, number: string): string => (name === "" ? `#${number}` : name.toLowerCase());
const label = (row: LineRow): string => (row.name === "" ? `Number ${row.number}` : row.name);

function reasonsOf(row: LineRow, run: readonly string[], left: boolean): Reason[] {
  const found: Reason[] = left ? ["player-left"] : [];
  if (run.length > 0 && !run.includes(row.sizeLabel)) found.push("size-removed");
  if (!NUMBER.test(row.number)) found.push("no-number");
  return found;
}

function messageFor(reason: Reason, row: LineRow, run: readonly string[]): string {
  if (reason === "size-removed") return `${label(row)} is saved in size ${row.sizeLabel}, which is not one of the sizes you make (${run.join(", ")}). Choose a size.`;
  if (reason === "no-number") return `${label(row)} has no number yet. Give a number of 1 to 3 digits.`;
  return `${label(row)} was on the earlier order and is not on the roster any more. Keep them or leave them out.`;
}

function line(index: number, row: LineRow, run: readonly string[], left: boolean, change: Change, previousSize: string | null): PlanLine {
  const reasons = reasonsOf(row, run, left);
  return { index, row, reasons, messages: reasons.map((r) => messageFor(r, row, run)), change, previousSize };
}

const fromPlayer = (p: Player): LineRow => ({ name: p.name, number: p.number, sizeLabel: p.sizeLabel, cut: p.wearerGroup, quantity: 1 });

function fromSeason(players: readonly Player[], previous: readonly RosterRow[] | null, run: readonly string[]): PlanLine[] {
  const earlier = new Map((previous ?? []).map((r) => [identity(r.name, r.number), r]));
  const lines = players.map((p, i) => {
    const before = earlier.get(identity(p.name, p.number));
    earlier.delete(identity(p.name, p.number));
    const change: Change = previous === null ? "same" : !before ? "new-player" : before.sizeLabel === p.sizeLabel ? "same" : "size-changed";
    return line(i, fromPlayer(p), run, false, change, change === "size-changed" ? (before?.sizeLabel ?? null) : null);
  });
  const left = [...earlier.values()].map((r, i) => line(players.length + i, r, run, true, "same", null));
  return [...lines, ...left];
}

export function planReorder(input: PlanInput): ReorderPlan {
  const { players, previous, run } = input;
  const lines = players === null ? (previous ?? []).map((r, i) => line(i, r, run, false, "same", null)) : fromSeason(players, previous, run);
  const fix = lines.filter((l) => l.reasons.length > 0).length;
  return {
    lines,
    run,
    counts: {
      ready: lines.length - fix,
      fix,
      sizeChanged: lines.filter((l) => l.change === "size-changed").length,
      newPlayers: lines.filter((l) => l.change === "new-player").length,
    },
  };
}

/** A fingerprint of the plan, so a confirmation can say which plan the person looked at. */
export const planFingerprint = (plan: ReorderPlan): string =>
  createHash("sha256")
    .update(JSON.stringify(plan.lines.map((l) => [l.row, l.reasons])), "utf8")
    .digest("hex");
