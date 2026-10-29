import { pomValue, type ArticleDefinition } from "../article";
import { ruleOf, type DraftConstants } from "../constants";
import { len } from "../geometry";
import type { ArticleScript, Gate } from "../script";
import type { ArticleDraft, DraftPiece, Finding, ResolvedInput } from "../types";
import { CUFF_OPTION, draftChecks, draftLengths, sleeveFinish } from "./checks";
import { bodyCurves, solveCap, type SizeMeasures } from "./curves";
import { conventionProblem, hemLine } from "./drop-tail";
import { bodyPiece, cuffPiece, ribPiece, sleevePiece } from "./pieces";

/**
 * JSY-SS-01, the short-sleeve set-in jersey: a port of the article's `tools/draft-pattern.ps1`.
 * The script drafts the defaults (C01 crew rib, K01 hem); this port adds the two length
 * parameters, each of which moves exactly the one POM that `article.json` names for it, the drop
 * tail of owner decision 6 and the K02 cuff of owner decision 8. Every number it draws with comes
 * from the article's drafting constants.
 */

/** The option codes this script draws. Any other code of these groups is not drafted yet. */
const DRAWN_OPTIONS: Readonly<Record<string, readonly string[]>> = { collar: ["C01"], sleeve_finish: ["K01", CUFF_OPTION] };
/** Option groups that change the print, not the pieces. */
const PRINT_ONLY_GROUPS = new Set(["pattern_fill"]);
/** Parameters and the POM letter each one moves. */
const LENGTH_PARAMETERS: Readonly<Record<string, string>> = { body_length_offset: "B", sleeve_length_offset: "D" };
/** The parameter whose shape the drop-tail convention describes. */
const DROP_TAIL = "back_drop_tail";

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

/** The cap ease on file has to sit inside the window the article allows for it (R-PAT-007). */
function easeGate(article: ArticleDefinition, k: DraftConstants): Gate | null {
  const ease = k.values.curves.sleeve_cap.ease_mm;
  const [low, high] = article.draft_constants.sleeve_cap_ease_target;
  if (ease >= low && ease <= high) return null;
  return {
    reason: `${article.code} is drafted to ${ease} mm of sleeve-cap ease, outside the ${low} to ${high} mm the article allows.`,
    ruleId: ruleOf(k, "curves.sleeve_cap"),
  };
}

/** A drop tail is drawn only to the convention on file; another convention is not drafted yet. */
function dropTailGate(article: ArticleDefinition, input: ResolvedInput, k: DraftConstants): Gate | null {
  const drop = input.parameters[DROP_TAIL];
  if (drop === undefined || drop === 0) return null;
  const problem = conventionProblem(k.values.drop_tail.convention);
  if (!problem) return null;
  return {
    reason: `${article.code} ${DROP_TAIL} = ${drop} mm is not drafted yet: its convention on file says ${problem}.`,
    ruleId: ruleOf(k, "drop_tail.convention"),
  };
}

/** Stops on any option, parameter or constant whose geometry the article does not define. */
export function gate(article: ArticleDefinition, input: ResolvedInput, k: DraftConstants): Gate | null {
  const stop = optionGate(article, input) ?? easeGate(article, k) ?? dropTailGate(article, input, k);
  if (stop) return stop;
  for (const p of article.parameters) {
    if (p.key === DROP_TAIL || Object.hasOwn(LENGTH_PARAMETERS, p.key) || input.parameters[p.key] === p.default) continue;
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

function draftSize(article: ArticleDefinition, size: string, input: ResolvedInput, m: SizeMeasures, k: DraftConstants, warnings: readonly Finding[]): ArticleDraft {
  const kv = k.values;
  const c = bodyCurves(m, kv.curves);
  const frontArmhole = len(c.fArm);
  const backArmhole = len(c.bArm);
  const { capH, cap } = solveCap(m.E, frontArmhole, backArmhole, kv.curves.sleeve_cap);
  const finish = sleeveFinish(article, m, capH, input.options.sleeve_finish, kv);
  const front = hemLine(c.cx, m.B, 0, kv.drop_tail.convention);
  const back = hemLine(c.cx, m.B, input.parameters[DROP_TAIL] ?? 0, kv.drop_tail.convention);
  const neckLen = 2 * (len(c.fNeck) + len(c.bNeck));
  const ribLen = Math.round(neckLen * article.draft_constants.rib_ratio);
  const pieces: DraftPiece[] = [
    bodyPiece(c, m, article, kv.notches, front, false),
    bodyPiece(c, m, article, kv.notches, back, true),
    sleevePiece(cap, capH, m, article, kv.notches, finish.edge),
    ribPiece(ribLen, m, article, kv.notches),
  ];
  if (finish.cuff) pieces.push(cuffPiece(finish.cuff.cutLength, finish.cuff.finishedDepth, article, kv.notches));
  return {
    articleCode: article.code,
    articleVersion: article.version,
    size,
    input,
    pieces,
    checks: draftChecks(m, c, finish, back),
    lengths: draftLengths({ capH, capLength: len(cap), frontArmhole, backArmhole }, neckLen, ribLen, finish, back),
    warnings,
  };
}

export const JSY_SS_01: ArticleScript = {
  code: "JSY-SS-01",
  gate,
  draft(article, size, input, constants, warnings) {
    const m = measures(article, size, input);
    if (Array.isArray(m)) {
      return { kind: "not-drafted-yet", articleCode: article.code, reason: `${article.code} has no POM ${m.join(", ")} for size ${size}.`, ruleId: null };
    }
    return { kind: "drafted", draft: draftSize(article, size, input, m, constants, warnings) };
  },
};
