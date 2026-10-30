import { RULE_GAP } from "@/lib/catalogue";
import type { ValidationCheck } from "@/lib/validation/check";
import type { EditorDraft, FormValues } from "./slots";
import type { BaseArticle } from "@/lib/catalogue";
import { notSampled } from "./form";

/**
 * The Validate chip in the top bar and the list it opens (spec F-S4, F-S5). Every line carries a
 * rulebook id, so every one of them has a Why? link: a finding the platform cannot explain is a
 * finding it should not show. A check with no entry yet uses `R-GAP-000`, which the rulebook seeds
 * as "No rule written yet; the team has been told".
 *
 * The findings are the stored ones of the last save (X4, `validation_results`), plus what the
 * drafter said about the form on this page (X3) and the options and ranges no sample has signed
 * off. Nothing is counted twice: each line is keyed by its code and target.
 */

export type ChipTone = "clear" | "warning" | "blocked" | "unchecked";

export interface ValidateChip {
  readonly label: string;
  readonly tone: ChipTone;
  /** How many findings the list holds. */
  readonly count: number;
  /** What a screen reader hears, which says the count in words rather than in a tick. */
  readonly description: string;
}

export interface FindingLine {
  readonly key: string;
  readonly severity: "blocker" | "warning";
  readonly message: string;
  /** The panel or article the finding is about, or null for the whole design. */
  readonly target: string | null;
  readonly ruleId: string;
}

const CLEAR = "Validate ✓";

const lineOf = (check: ValidationCheck): FindingLine => ({
  key: `${check.code}:${check.target.panel ?? check.target.article ?? ""}`,
  severity: check.severity ?? "warning",
  message: check.message,
  target: check.target.panel ?? check.target.article ?? null,
  ruleId: check.ruleId,
});

/** The findings the drafter raised about the form on this page: a value the article does not offer, or no script yet. */
function draftLines(draft: EditorDraft | null): readonly FindingLine[] {
  if (!draft) return [];
  if (draft.kind === "invalid") {
    return draft.findings.map((found) => ({ key: `draft:${found.field}`, severity: "blocker" as const, message: found.message, target: found.field, ruleId: found.ruleId }));
  }
  if (draft.kind === "not-drafted-yet") {
    return [{ key: "draft:not-drafted-yet", severity: "warning", message: draft.reason, target: null, ruleId: draft.ruleId ?? RULE_GAP }];
  }
  return draft.draft.warnings.map((found) => ({ key: `draft:${found.field}`, severity: "warning" as const, message: found.message, target: found.field, ruleId: found.ruleId }));
}

/** An option or range the design leans on that no golden sample has signed off yet (spec F-S7). */
const sampleLines = (article: BaseArticle | null, form: FormValues): readonly FindingLine[] =>
  notSampled(article, form).map((entry) => ({
    key: `not-sampled:${entry.label}`,
    severity: "warning" as const,
    message: `${entry.label} has no golden sample behind it yet.`,
    target: null,
    ruleId: entry.ruleId,
  }));

export interface ValidateInput {
  /** The checks stored for this version, newest first. Empty when the version has not been checked. */
  readonly checks: readonly ValidationCheck[];
  readonly draft: EditorDraft | null;
  readonly article: BaseArticle | null;
  readonly form: FormValues;
}

const BLOCKER_FIRST = { blocker: 0, warning: 1 } as const;

/** Every finding to show, blockers first, each one explained by a rule. */
export function findingLines(input: ValidateInput): readonly FindingLine[] {
  const lines = [...input.checks.filter((check) => !check.passed).map(lineOf), ...draftLines(input.draft), ...sampleLines(input.article, input.form)];
  const seen = new Map<string, FindingLine>();
  for (const line of lines) if (!seen.has(line.key)) seen.set(line.key, line);
  return [...seen.values()].sort((a, b) => BLOCKER_FIRST[a.severity] - BLOCKER_FIRST[b.severity]);
}

const counted = (count: number): string => `${count} ${count === 1 ? "thing" : "things"} to look at`;

/** The chip itself. A version nothing has checked says so rather than showing a tick it has not earned. */
export function validateChip(input: ValidateInput): ValidateChip {
  const lines = findingLines(input);
  const blockers = lines.filter((line) => line.severity === "blocker").length;
  if (input.checks.length === 0 && lines.length === 0) {
    return { label: "Not checked yet", tone: "unchecked", count: 0, description: "This design has not been checked yet." };
  }
  if (blockers > 0) return { label: `${blockers} to fix`, tone: "blocked", count: lines.length, description: `${counted(lines.length)}, ${blockers} of them blocking.` };
  if (lines.length > 0) return { label: counted(lines.length), tone: "warning", count: lines.length, description: counted(lines.length) };
  return { label: CLEAR, tone: "clear", count: 0, description: "Everything the platform checks is clear." };
}
