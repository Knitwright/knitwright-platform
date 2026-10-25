import type { RosterRow } from "@/lib/production/contract";
import type { PlanLine, ReorderPlan } from "./plan";

/** What a person decided for one line that needed fixing. Any field may be left out. */
export type Resolution = Readonly<{ index: number; action?: "keep" | "leave-out"; sizeLabel?: string; number?: string }>;

export type Resolved =
  | Readonly<{ ok: true; rows: readonly RosterRow[]; leftOut: number }>
  | Readonly<{ ok: false; unresolved: readonly number[] }>;

const NUMBER = /^[0-9]{1,3}$/;

function settle(line: PlanLine, answer: Resolution | undefined, run: readonly string[]): LineRow | "left-out" | "open" {
  if (answer?.action === "leave-out") return "left-out";
  const row = { ...line.row, ...(answer?.sizeLabel ? { sizeLabel: answer.sizeLabel } : {}), ...(answer?.number ? { number: answer.number } : {}) };
  const sizeFixed = !line.reasons.includes("size-removed") || (answer?.sizeLabel !== undefined && run.includes(answer.sizeLabel));
  const numberFixed = !line.reasons.includes("no-number") || NUMBER.test(row.number);
  const staysFixed = !line.reasons.includes("player-left") || answer?.action === "keep";
  return sizeFixed && numberFixed && staysFixed ? row : "open";
}

/**
 * Turns the plan into the rows of a new team order using the person's answers. Lines that were
 * ready need no answer. A line that still has a problem stays open: nothing is dropped for them.
 */
export function resolveLines(plan: ReorderPlan, answers: readonly Resolution[]): Resolved {
  const byIndex = new Map(answers.map((a) => [a.index, a]));
  const settled = plan.lines.map((line) => settle(line, byIndex.get(line.index), plan.run));
  const unresolved = plan.lines.filter((_, i) => settled[i] === "open").map((l) => l.index);
  if (unresolved.length > 0) return { ok: false, unresolved };
  const rows = settled.filter((s): s is LineRow => s !== "left-out" && s !== "open").map((r): RosterRow => r);
  return { ok: true, rows, leftOut: settled.length - rows.length };
}

type LineRow = PlanLine["row"];
