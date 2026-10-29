import { pomValue, type ArticleDefinition } from "../article";
import { len } from "../geometry";
import type { ArticleScript, Gate } from "../script";
import type { ArticleDraft, Finding, ResolvedInput } from "../types";
import { bodyCurves, solveCap, type SizeMeasures } from "./curves";
import { bodyPiece, ribPiece, sleevePiece } from "./pieces";

/**
 * JSY-SS-01, the short-sleeve set-in jersey: a port of the article's `tools/draft-pattern.ps1`.
 * The script drafts the defaults (C01 crew rib, K01 hem); this port adds the two length
 * parameters, each of which moves exactly the one POM that `article.json` names for it.
 */

/** The option codes this script draws. Any other code of these groups is not drafted yet. */
const DRAWN_OPTIONS: Readonly<Record<string, readonly string[]>> = { collar: ["C01"], sleeve_finish: ["K01"] };
/** Option groups that change the print, not the pieces. */
const PRINT_ONLY_GROUPS = new Set(["pattern_fill"]);
/** Parameters and the POM letter each one moves. */
const LENGTH_PARAMETERS: Readonly<Record<string, string>> = { body_length_offset: "B", sleeve_length_offset: "D" };

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;

function optionGate(article: ArticleDefinition, input: ResolvedInput): Gate | null {
  for (const [group, code] of Object.entries(input.options)) {
    if (PRINT_ONLY_GROUPS.has(group)) continue;
    if (DRAWN_OPTIONS[group]?.includes(code)) continue;
    const option = article.options[group]?.find((o) => o.code === code);
    return { reason: `${article.code} ${group} ${code} (${option?.name ?? code}) is not drafted yet.`, ruleId: option?.rule ?? null };
  }
  return null;
}

/** Stops on any option or parameter whose geometry the article does not define. */
export function gate(article: ArticleDefinition, input: ResolvedInput): Gate | null {
  const option = optionGate(article, input);
  if (option) return option;
  for (const p of article.parameters) {
    if (Object.hasOwn(LENGTH_PARAMETERS, p.key) || input.parameters[p.key] === p.default) continue;
    return {
      reason: `${article.code} ${p.key} = ${input.parameters[p.key]} mm is not drafted yet: the article does not define its shape.`,
      ruleId: p.rule,
    };
  }
  return null;
}

/** The size's POMs with the length parameters applied, or the letters the article lacks. */
function measures(article: ArticleDefinition, size: string, input: ResolvedInput): SizeMeasures | string[] {
  const values: Record<string, number> = {};
  const missing: string[] = [];
  for (const letter of LETTERS) {
    const v = pomValue(article, letter, size);
    if (v === null) missing.push(letter);
    else values[letter] = v;
  }
  if (missing.length > 0) return missing;
  for (const [key, letter] of Object.entries(LENGTH_PARAMETERS)) values[letter] += input.parameters[key] ?? 0;
  const { A, B, C, D, E, F, G, H, I, J, K, L } = values;
  return { A, B, C, D, E, F, G, H, I, J, K, L, slope: article.draft_constants.shoulder_slope };
}

function draftSize(article: ArticleDefinition, size: string, input: ResolvedInput, m: SizeMeasures, warnings: readonly Finding[]): ArticleDraft {
  const k = article.draft_constants;
  const c = bodyCurves(m);
  const lfArm = len(c.fArm);
  const lbArm = len(c.bArm);
  const { capH, cap } = solveCap(m.E, lfArm, lbArm);
  const lCap = len(cap);
  const neckLen = 2 * (len(c.fNeck) + len(c.bNeck));
  const ribLen = Math.round(neckLen * k.rib_ratio);
  return {
    articleCode: article.code,
    articleVersion: article.version,
    size,
    input,
    pieces: [bodyPiece(c, m, article, false), bodyPiece(c, m, article, true), sleevePiece(cap, capH, m, article), ribPiece(ribLen, m, article)],
    checks: [
      { label: "A chest half (front panel width at underarm)", target: m.A, actual: 2 * c.cx },
      { label: "C across shoulder", target: m.C, actual: 2 * c.sx },
      { label: "H neck width", target: m.H, actual: 2 * c.hx },
      { label: "I front neck drop", target: m.I, actual: c.fNeck[c.fNeck.length - 1][1] },
      { label: "G armhole depth", target: m.G, actual: c.fArm[c.fArm.length - 1][1] },
      { label: "B body length", target: m.B, actual: m.B },
      { label: "D sleeve length", target: m.D, actual: m.D },
      { label: "E bicep half (sleeve width / 2)", target: m.E, actual: m.E },
      { label: "F sleeve opening half", target: m.F, actual: m.F },
      { label: "K hem width half", target: m.K, actual: 2 * c.cx },
    ],
    lengths: [
      { label: "Front armhole (one side)", mm: lfArm },
      { label: "Back armhole (one side)", mm: lbArm },
      { label: "Sleeve cap, front half", mm: lCap },
      { label: "Sleeve cap, back half", mm: lCap },
      { label: "Total ease, cap vs armhole", mm: 2 * lCap - lfArm - lbArm },
      { label: "Sleeve cap height", mm: capH },
      { label: "Neckline seam (full)", mm: neckLen },
      { label: "Rib length (finished seam line)", mm: ribLen },
    ],
    warnings,
  };
}

export const JSY_SS_01: ArticleScript = {
  code: "JSY-SS-01",
  gate,
  draft(article, size, input, warnings) {
    const m = measures(article, size, input);
    if (Array.isArray(m)) {
      return { kind: "not-drafted-yet", articleCode: article.code, reason: `${article.code} has no POM ${m.join(", ")} for size ${size}.`, ruleId: null };
    }
    return { kind: "drafted", draft: draftSize(article, size, input, m, warnings) };
  },
};
