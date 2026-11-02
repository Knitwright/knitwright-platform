import type { BaseArticle } from "@/lib/catalogue";
import type { Finding } from "@/lib/production/contract";
import { finding } from "@/lib/validation/finding";
import { partsForSport, type ArticleBook, type KitPart } from "@/lib/teamwear/kit";
import { partSpec } from "@/lib/teamwear/preview";
import { sportById } from "@/lib/teamwear/vocabulary";
import { toValidationParameter } from "@/lib/validation/live-ports";
import { defaultFactoryProfile, type FactoryProfile } from "@/lib/validation/profile";
import type { CheckRegistry, DesignInput } from "@/lib/validation/registry";
import { guardrailInputOf, standardRegistry } from "@/lib/validation/spec-input";
import { validateDesign } from "@/lib/validation/validate";
import type { KitCandidate } from "./engine";

/**
 * F-0 validation of every candidate BEFORE it is shown (spec F-T2 step 4, acceptance "no candidate
 * fails validation").
 *
 * Each part of a candidate kit is turned into a design in memory — through Z5's own `partSpec`, the
 * same function the 3D stage draws from, so what is validated is what the club will see — and run
 * through X4's `validateDesign` with the standard registry: the five guardrails, parameters in
 * range and the moderation gate. A candidate with one blocker anywhere is NOT OFFERED. Its reason
 * is kept, so the screen can say how many were set aside and why, rather than quietly showing
 * fewer cards.
 *
 * The parameters come from the candidate's own form, which `defaultsOver` already held to the
 * article's approved ranges, and the ranges come from the same article row. So this is a second,
 * independent check of the engine's first promise, which is the point of running it.
 */

/** What one candidate's checks found. */
export interface CandidateValidation {
  readonly candidateId: string;
  readonly findings: readonly Finding[];
  readonly blockers: number;
  readonly warnings: number;
  /** True only when no part of the kit has a blocker. A false here keeps the card off the screen. */
  readonly offerable: boolean;
  /** Every rule id the checks answered to, each once, in order. */
  readonly ruleIds: readonly string[];
}

/** A candidate and its checks, kept together so no screen can show one without the other. */
export interface ValidatedCandidate {
  readonly candidate: KitCandidate;
  readonly validation: CandidateValidation;
}

/** The article parameters of one part's form, which is what the parameter check judges. */
const parametersOf = (parameters: Readonly<Record<string, number>>): Readonly<Record<string, number>> => ({ ...parameters });

/** What the checks read about one part of a candidate kit. */
export function partInput(candidate: KitCandidate, part: KitPart, article: BaseArticle | null): DesignInput | null {
  const choice = candidate.kit.parts[part.id];
  if (choice === undefined) return null;
  const spec = partSpec(candidate.kit, part, choice, candidate.kit.wearer);
  return {
    typeId: part.typeId,
    readiness: null,
    article: article === null ? null : { baseArticleCode: article.code, productionClass: article.productionClass, parameters: parametersOf(choice.form.parameters) },
    parameterDefs: article === null ? null : article.parameters.flatMap((def) => toValidationParameter(def) ?? []),
    // A kit this screen proposes places no uploaded picture on a panel: the crest goes into a fixed
    // slot in the configurator, and moderation screens it there. So there is nothing to screen yet.
    moderation: [],
    guardrails: spec.ok ? guardrailInputOf(spec.spec) : undefined,
  };
}

const unique = (ids: readonly (string | undefined)[]): readonly string[] => [...new Set(ids.filter((id): id is string => id !== undefined))];

/**
 * A part whose base article could not be read is a blocker, not a warning: the kit was built from
 * that article's own options, so without the row nothing holds it to a range the factory approved.
 * It is X4's own code and X4's own rule, so the screen reads it exactly as the editor would.
 */
export const articleUnreadable = (part: KitPart): Finding => ({
  ...finding({
    code: "article-not-offered",
    severity: "blocker",
    article: part.typeId,
    message: `Base article ${part.articleCode ?? ""} is not in the catalogue, so this kit cannot be held to a range the factory approved.`,
    action: "Try again in a moment. If it keeps failing, tell Knitwright.",
    whoActs: "owner",
  }),
});

/**
 * One candidate's checks: every part of the kit, checked against the factory profile. A part with
 * no base article is still checked — the profile decides whether the factory makes that garment at
 * all — and its parameters are simply not judged, because it has none.
 */
export function validateCandidate(
  candidate: KitCandidate,
  articles: ArticleBook,
  profile: FactoryProfile = defaultFactoryProfile(),
  registry: CheckRegistry = standardRegistry(),
): CandidateValidation {
  const parts = partsForSport(sportById(candidate.sportId));
  const unreadable = parts.flatMap((part) => (part.articleCode !== null && !articles.has(part.articleCode) ? [articleUnreadable(part)] : []));
  const results = parts.flatMap((part) => {
    const article = part.articleCode === null ? null : (articles.get(part.articleCode) ?? null);
    const input = partInput(candidate, part, article);
    return input === null ? [] : [validateDesign(input, profile, registry)];
  });
  const findings = [...unreadable, ...results.flatMap((result) => result.findings)];
  const blockers = unreadable.length + results.reduce((sum, result) => sum + result.blockers, 0);
  return {
    candidateId: candidate.id,
    findings,
    blockers,
    warnings: findings.length - blockers,
    offerable: blockers === 0,
    ruleIds: unique(results.flatMap((result) => result.checks.map((check) => check.ruleId))),
  };
}

/** Said where every candidate was set aside: the club sees the reason, never an empty grid. */
export const ALL_SET_ASIDE =
  "Every kit Knitwright built failed a manufacturing check, so none is offered. The checks below say what stopped each one.";

export interface ValidatedKits {
  /** Only the candidates that passed. These are the only ones a card is ever drawn for. */
  readonly offered: readonly ValidatedCandidate[];
  /** The candidates that were set aside, with what stopped them. Shown as a count and a reason. */
  readonly setAside: readonly ValidatedCandidate[];
  /** One line naming how many were set aside, or null when none was. */
  readonly setAsideNote: string | null;
}

/** The candidates that may be shown, and the ones that may not, each with its checks. */
export function validatedKits(
  candidates: readonly KitCandidate[],
  articles: ArticleBook,
  profile: FactoryProfile = defaultFactoryProfile(),
  registry: CheckRegistry = standardRegistry(),
): ValidatedKits {
  const checked = candidates.map((candidate) => ({ candidate, validation: validateCandidate(candidate, articles, profile, registry) }));
  const offered = checked.filter((one) => one.validation.offerable);
  const setAside = checked.filter((one) => !one.validation.offerable);
  return { offered, setAside, setAsideNote: setAsideNote(setAside) };
}

/** The first thing that stopped a candidate, or an empty string when nothing was recorded. */
export const firstStopper = (one: ValidatedCandidate | undefined): string => one?.validation.findings[0]?.message ?? "";

/** One line naming how many kits were set aside and what stopped the first of them. */
export function setAsideNote(setAside: readonly ValidatedCandidate[]): string | null {
  if (setAside.length === 0) return null;
  const many = setAside.length !== 1;
  return `${setAside.length} ${many ? "kits were" : "kit was"} set aside because ${many ? "they" : "it"} failed a manufacturing check. ${firstStopper(setAside[0])}`.trim();
}
