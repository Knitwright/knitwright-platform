import type { BaseArticle } from "@/lib/catalogue";
import type { Finding } from "@/lib/production/contract";
import { partsForSport, type ArticleBook } from "@/lib/teamwear/kit";
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
export function partInput(candidate: KitCandidate, partId: string, article: BaseArticle | null, typeId: string): DesignInput | null {
  const choice = candidate.kit.parts[partId];
  const part = partsForSport(sportById(candidate.sportId)).find((one) => one.id === partId);
  if (choice === undefined || part === undefined) return null;
  const spec = partSpec(candidate.kit, part, choice, candidate.kit.wearer);
  return {
    typeId,
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
  const results = parts.flatMap((part) => {
    const article = part.articleCode === null ? null : (articles.get(part.articleCode) ?? null);
    const input = partInput(candidate, part.id, article, part.typeId);
    return input === null ? [] : [validateDesign(input, profile, registry)];
  });
  const findings = results.flatMap((result) => result.findings);
  const blockers = results.reduce((sum, result) => sum + result.blockers, 0);
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
  return {
    offered,
    setAside,
    setAsideNote:
      setAside.length === 0
        ? null
        : `${setAside.length} ${setAside.length === 1 ? "kit was" : "kits were"} set aside because ${setAside.length === 1 ? "it" : "they"} failed a manufacturing check. ${setAside[0]!.validation.findings[0]?.message ?? ""}`.trim(),
  };
}
