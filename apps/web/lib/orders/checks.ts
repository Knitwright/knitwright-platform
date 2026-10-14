import type { RosterRow } from "@/lib/production/contract";

export interface RosterIssue {
  /** 1-based position in the roster. 0 means the roster as a whole. */
  readonly row: number;
  readonly severity: "error" | "warning";
  readonly code:
    | "empty"
    | "no-size-run"
    | "size-not-in-run"
    | "duplicate-number"
    | "missing-name"
    | "name-not-printed"
    | "several-shirts-one-number";
  readonly message: string;
}

export interface RosterContext {
  /** The sizes the design is made in. Empty when it has none yet. */
  readonly run: readonly string[];
  /** True when the design puts a name on the shirt. */
  readonly hasNamePlace: boolean;
}

const issue = (row: number, severity: RosterIssue["severity"], code: RosterIssue["code"], message: string): RosterIssue => ({ row, severity, code, message });

function rowIssues(entry: RosterRow, at: number, context: RosterContext): RosterIssue[] {
  const found: RosterIssue[] = [];
  if (context.run.length > 0 && !context.run.includes(entry.sizeLabel)) {
    found.push(issue(at, "error", "size-not-in-run", `Size ${entry.sizeLabel} is not one of the sizes you make (${context.run.join(", ")}).`));
  }
  if (context.hasNamePlace && entry.name === "") {
    found.push(issue(at, "error", "missing-name", `Number ${entry.number} has no name, and this design prints a name.`));
  }
  if (!context.hasNamePlace && entry.name !== "") {
    found.push(issue(at, "warning", "name-not-printed", `${entry.name} will not be printed: this design has no place for a name.`));
  }
  if (entry.quantity > 1) {
    found.push(issue(at, "warning", "several-shirts-one-number", `Number ${entry.number} has ${entry.quantity} shirts. Each will carry the same number.`));
  }
  return found;
}

function duplicateNumbers(rows: readonly RosterRow[]): RosterIssue[] {
  const positions = new Map<number, number[]>();
  rows.forEach((entry, index) => {
    const key = Number(entry.number);
    positions.set(key, [...(positions.get(key) ?? []), index + 1]);
  });
  return [...positions.values()]
    .filter((at) => at.length > 1)
    .flatMap((at) => at.map((row) => issue(row, "error", "duplicate-number", `Number ${Number(rows[row - 1]?.number)} is used by rows ${at.join(", ")}. A number can go to one player.`)));
}

/** Everything a person should look at before the roster is used. Errors block; warnings inform. */
export function checkRoster(rows: readonly RosterRow[], context: RosterContext): readonly RosterIssue[] {
  if (rows.length === 0) return [issue(0, "error", "empty", "Add at least one player.")];
  const whole =
    context.run.length === 0
      ? [issue(0, "warning", "no-size-run", "This design has no sizes yet, so sizes could not be compared with what you make.")]
      : [];
  return [...whole, ...rows.flatMap((entry, index) => rowIssues(entry, index + 1, context)), ...duplicateNumbers(rows)].sort(
    (a, b) => a.row - b.row,
  );
}

export const hasErrors = (issues: readonly RosterIssue[]): boolean => issues.some((i) => i.severity === "error");
