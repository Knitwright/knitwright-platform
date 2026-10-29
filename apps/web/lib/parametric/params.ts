import type { ArticleDefinition, ArticleParameter } from "./article";
import type { DraftInput, Finding, ResolvedInput } from "./types";

/** The rule for a check that has no rulebook entry yet (plan v5, "Every rule explains itself"). */
export const GAP_RULE = "R-GAP-000";

export type Resolution =
  | Readonly<{ ok: true; input: ResolvedInput; warnings: readonly Finding[] }>
  | Readonly<{ ok: false; findings: readonly Finding[] }>;

/** Whole steps from the minimum, allowing for the rounding of a decimal step. */
const onStep = (p: ArticleParameter, v: number): boolean => {
  const steps = (v - p.min) / p.step;
  return Math.abs(steps - Math.round(steps)) < 1e-9;
};

function parameterFinding(p: ArticleParameter, v: unknown): Finding | null {
  const field = `parameters.${p.key}`;
  if (typeof v !== "number" || !Number.isFinite(v)) {
    return { ruleId: p.rule, field, message: `${p.key} must be a number of millimetres.` };
  }
  if (v < p.min || v > p.max) {
    return { ruleId: p.rule, field, message: `${p.key} must be between ${p.min} and ${p.max} mm; ${v} is outside the range.` };
  }
  if (!onStep(p, v)) {
    return { ruleId: p.rule, field, message: `${p.key} moves in steps of ${p.step} mm from ${p.min}; ${v} is between steps.` };
  }
  return null;
}

function resolveParameters(article: ArticleDefinition, given: Readonly<Record<string, number>>) {
  const findings: Finding[] = [];
  const warnings: Finding[] = [];
  const known = new Set(article.parameters.map((p) => p.key));
  for (const key of Object.keys(given).sort()) {
    if (!known.has(key)) findings.push({ ruleId: GAP_RULE, field: `parameters.${key}`, message: `${article.code} has no parameter ${key}.` });
  }
  const values: Record<string, number> = {};
  for (const p of article.parameters) {
    const v = Object.hasOwn(given, p.key) ? given[p.key] : p.default;
    const problem = parameterFinding(p, v);
    if (problem) findings.push(problem);
    values[p.key] = v;
    if (!problem && !p.approved && v !== p.default) {
      warnings.push({ ruleId: p.rule, field: `parameters.${p.key}`, message: `No sample has signed off the ${p.key} range yet.` });
    }
  }
  return { values, findings, warnings };
}

function resolveOptions(article: ArticleDefinition, given: Readonly<Record<string, string>>) {
  const findings: Finding[] = [];
  for (const group of Object.keys(given).sort()) {
    if (!Object.hasOwn(article.options, group)) {
      findings.push({ ruleId: GAP_RULE, field: `options.${group}`, message: `${article.code} has no option group ${group}.` });
    }
  }
  const values: Record<string, string> = {};
  for (const [group, choices] of Object.entries(article.options)) {
    const fallback = choices.find((c) => c.default)?.code ?? choices[0]?.code;
    const code = Object.hasOwn(given, group) ? given[group] : fallback;
    if (code === undefined) continue;
    if (!choices.some((c) => c.code === code)) {
      findings.push({ ruleId: GAP_RULE, field: `options.${group}`, message: `${String(code)} is not one of the ${group} options of ${article.code}.` });
    }
    values[group] = code;
  }
  return { values, findings };
}

/** Fills defaults and refuses anything the article does not offer. Nothing is clamped or rounded. */
export function resolveInput(article: ArticleDefinition, size: string, input: DraftInput): Resolution {
  const sizeFindings: Finding[] = article.sizes.includes(size)
    ? []
    : [{ ruleId: GAP_RULE, field: "size", message: `${article.code} is not graded to size ${size}. Sizes: ${article.sizes.join(", ")}.` }];
  const parameters = resolveParameters(article, input.parameters ?? {});
  const options = resolveOptions(article, input.options ?? {});
  const findings = [...sizeFindings, ...parameters.findings, ...options.findings];
  if (findings.length > 0) return { ok: false, findings };
  return { ok: true, input: { parameters: parameters.values, options: options.values }, warnings: parameters.warnings };
}
