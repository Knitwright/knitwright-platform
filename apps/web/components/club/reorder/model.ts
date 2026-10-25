/** The shapes the reorder routes answer with, and the one rule the screen needs: is every line answered. */

export type Reason = "size-removed" | "player-left" | "no-number";

export interface LineView {
  readonly index: number;
  readonly row: Readonly<{ name: string; number: string; sizeLabel: string; cut: string; quantity: number }>;
  readonly reasons: readonly Reason[];
  readonly messages: readonly string[];
  readonly change: "same" | "size-changed" | "new-player";
  readonly previousSize: string | null;
}

export interface PreviewView {
  readonly releaseId: string;
  readonly releaseLabel: string;
  readonly projectId: string;
  readonly designName: string;
  readonly source: "season" | "order";
  readonly plan: Readonly<{ lines: readonly LineView[]; run: readonly string[]; counts: Readonly<{ ready: number; fix: number; sizeChanged: number; newPlayers: number }> }>;
  readonly fingerprint: string;
  readonly nothingChanged: boolean;
  readonly report: Readonly<{ identical: boolean; differences: readonly { code: string; message: string }[]; notCompared: readonly string[] }>;
  readonly validation: Readonly<{ profileName: string; profileLabel: string; blockers: number; warnings: number; blockerMessages: readonly string[] }>;
  readonly issues: readonly { row: number; severity: "error" | "warning"; message: string }[];
  readonly notes: readonly string[];
}

/** What a person has chosen for one line. Empty strings mean nothing chosen yet. */
export type Answer = Readonly<{ action?: "keep" | "leave-out"; sizeLabel?: string; number?: string }>;
export type Answers = Readonly<Record<number, Answer>>;

const NUMBER = /^[0-9]{1,3}$/;

export function isSettled(line: LineView, run: readonly string[], answer: Answer | undefined): boolean {
  if (answer?.action === "leave-out") return true;
  if (line.reasons.includes("size-removed") && !(answer?.sizeLabel && run.includes(answer.sizeLabel))) return false;
  if (line.reasons.includes("no-number") && !(answer?.number && NUMBER.test(answer.number))) return false;
  return !line.reasons.includes("player-left") || answer?.action === "keep";
}

export const allSettled = (plan: PreviewView["plan"], answers: Answers): boolean => plan.lines.every((l) => isSettled(l, plan.run, answers[l.index]));

/** The answers as the confirm route takes them, only for lines that needed one. */
export function resolutionsOf(plan: PreviewView["plan"], answers: Answers): readonly Readonly<Record<string, unknown>>[] {
  return plan.lines
    .filter((l) => l.reasons.length > 0)
    .map((l) => {
      const a = answers[l.index] ?? {};
      return { index: l.index, ...(a.action ? { action: a.action } : {}), ...(a.sizeLabel ? { sizeLabel: a.sizeLabel } : {}), ...(a.number ? { number: a.number } : {}) };
    });
}
