import type { BaseArticle, OptionDef } from "@/lib/catalogue";
import { defaultsOver } from "@/lib/editor";
import { partsForSport, startingKit, type ArticleBook, type KitPart, type TeamwearKit } from "@/lib/teamwear/kit";
import { sportById } from "@/lib/teamwear/vocabulary";
import { arrangementsFor, unarrangedRoles, type Arrangement } from "./arrange";
import { familiesFor, familiesWithoutCode, FILL_GROUP, type OfferedFamily, type TemplateFamily } from "./families";
import type { CrestFile } from "./crest";
import { primaryDrift, type CrestColour } from "./palette";
import { CREST_LIMITS, feelById, GAP_RULE_ID, RULES, rolesOf, type FeelId, type KitRoleId, type RoleChoice } from "./settings";

/**
 * The rules engine (spec F-T2 step 3): palette × template family × feel → complete kits.
 *
 * IT IS DETERMINISTIC AND IT HOLDS NO MODEL. The same crest, feel and roles give the same kits in
 * the same order every run; the only thing a model ever does to them is put them in another order
 * and write one line per card (`rank.ts`), and it cannot change a single value.
 *
 * EVERY STRUCTURAL VALUE COMES FROM THE BASE ARTICLE. A candidate's kit is built by Z5's own
 * `startingKit`, which resolves each part's form through the editor's `defaultForm`, and every code
 * this file then sets goes through `defaultsOver`, which drops a code the article does not offer
 * and a value outside the range the factory approved. So the engine cannot express a kit that
 * cannot be made, and X4 validates each one again before a person sees it (`validate.ts`).
 *
 * THE CREST IS CARRIED, NEVER CHANGED. A candidate holds the very `CrestFile` that came in.
 */

/** The three axes a candidate varies along, for the card's own words and for a stable id. */
export interface CandidateChoice {
  readonly role: KitRoleId;
  readonly family: OfferedFamily;
  /** The option code chosen in each of the article's groups, by group name. Catalogue codes only. */
  readonly codes: Readonly<Record<string, string>>;
}

export interface KitCandidate {
  /** Stable and deterministic: the role, the fill code and the finish codes. A card's test id too. */
  readonly id: string;
  readonly sportId: string;
  readonly roleLabel: string;
  readonly familyLabel: string;
  readonly choice: CandidateChoice;
  /** The kit itself, in Z5's own shape, so a card opens straight into the configurator. */
  readonly kit: TeamwearKit;
  /** The crest as it came in, byte for byte, or null when the club picked colours instead. */
  readonly crest: CrestFile | null;
  /** CIEDE2000 between the crest's dominant colour and this kit's body colour, or null. */
  readonly primaryDeltaE00: number | null;
  /** One line Knitwright wrote, with no model involved. A ranker may replace it with its own. */
  readonly note: string;
  /** Every rulebook entry behind this candidate. */
  readonly ruleIds: readonly string[];
}

export interface EngineInput {
  readonly sportId: string;
  readonly feel: FeelId;
  readonly roles: RoleChoice;
  readonly palette: readonly CrestColour[];
  readonly articles: ArticleBook;
  readonly crest: CrestFile | null;
}

export type EngineOutcome =
  | Readonly<{ status: "kits"; candidates: readonly KitCandidate[]; notes: readonly string[] }>
  | Readonly<{ status: "none"; reason: string; notes: readonly string[] }>;

/** Said where the sport's shirt has no base article, so no code and no price exist for it. */
export const NO_SHIRT_ARTICLE =
  "No base article covers this sport's shirt yet, so Knitwright has no print fills or finishes to build kits from. Pick another sport, or design the shirt in the Studio.";

/** Said where the article offers no print fill at all. */
export const NO_FILLS =
  "The base article for this shirt lists no print fills yet, so Knitwright cannot offer a plain kit and a patterned one as different kits.";

/** The shirt of a sport: the part a fill and a finish belong to. */
const shirtOf = (sportId: string): KitPart | undefined => partsForSport(sportById(sportId)).find((part) => part.id === "shirt");

/** The option groups of an article other than the fill group, in catalogue order. */
export function finishGroupsOf(article: BaseArticle): readonly Readonly<{ group: string; options: readonly OptionDef[] }>[] {
  const groups: string[] = [];
  for (const option of article.options) if (option.group !== FILL_GROUP && !groups.includes(option.group)) groups.push(option.group);
  return groups.map((group) => ({ group, options: article.options.filter((option) => option.group === group) }));
}

/** The most finish combinations one feel uses. A limit on the engine, not on the factory. */
export const MAX_FINISH_VARIANTS = 6;

/**
 * The finish combinations a feel offers, the feel's own preferred code first in each group. Every
 * code is one the article lists, so no combination here can be one the factory does not make.
 */
export function finishVariantsFor(feel: FeelId, article: BaseArticle): readonly Readonly<Record<string, string>>[] {
  const wanted = feelById(feel).finish;
  const groups = finishGroupsOf(article).map(({ group, options }) => {
    const codes = options.map((option) => option.code);
    const first = wanted[group];
    const ordered = first !== undefined && codes.includes(first) ? [first, ...codes.filter((code) => code !== first)] : codes;
    return { group, codes: ordered };
  });
  let variants: Readonly<Record<string, string>>[] = [{}];
  for (const { group, codes } of groups) {
    variants = codes.flatMap((code) => variants.map((variant) => ({ ...variant, [group]: code })));
  }
  // The product above varies the last group fastest, which puts the feel's own preference second.
  // Sorting by how many groups hold the preferred code puts the feel's own combination first.
  const score = (variant: Readonly<Record<string, string>>): number =>
    Object.entries(variant).filter(([group, code]) => wanted[group] === code).length;
  return [...variants].sort((a, b) => score(b) - score(a)).slice(0, MAX_FINISH_VARIANTS);
}

export const idOf = (choice: CandidateChoice): string =>
  [choice.role, choice.family.code, ...Object.entries(choice.codes).sort(([a], [b]) => a.localeCompare(b)).map(([group, code]) => `${group}-${code}`)].join("_");

export const noteFor = (arrangement: Arrangement, family: OfferedFamily, codes: Readonly<Record<string, string>>, articleCode: string): string => {
  const finish = Object.values(codes).join(" · ");
  return `${arrangement.roleLabel} kit: ${family.label} · ${family.code}${finish === "" ? "" : `, ${finish}`} on ${articleCode}. ${arrangement.note}`;
};

/**
 * The kit of one candidate: Z5's starting kit in the arrangement's colours, with the fill and the
 * finish codes set. The shirt's part is always there, because `startingKit` builds one for every
 * part the sport offers and the shirt is one of them.
 */
function kitFor(
  input: EngineInput,
  arrangement: Arrangement,
  family: OfferedFamily,
  codes: Readonly<Record<string, string>>,
  shirt: KitPart,
  article: BaseArticle,
): TeamwearKit {
  const started = startingKit(input.sportId, input.articles, arrangement.colours);
  const choice = started.parts[shirt.id]!;
  const wanted = { ...codes, [FILL_GROUP]: family.code };
  return {
    ...started,
    parts: {
      ...started.parts,
      [shirt.id]: {
        ...choice,
        // Every code goes through the editor's own resolver, which drops anything the article does
        // not offer and anything outside the range the factory approved.
        form: defaultsOver(article, { options: { ...choice.form.options, ...wanted }, parameters: choice.form.parameters }),
      },
    },
    socksColour: arrangement.socksColour,
    bundleId: arrangement.role,
    elements: input.crest === null ? [] : ["crest"],
  };
}

/** One candidate per role, family and finish, interleaved by role so every role asked for appears. */
function candidatesFor(
  input: EngineInput,
  arrangements: readonly Arrangement[],
  families: readonly OfferedFamily[],
  article: BaseArticle,
  shirt: KitPart,
  articleCode: string,
) {
  const finishes = finishVariantsFor(input.feel, article);
  const perRole = arrangements.map((arrangement) =>
    families.flatMap((family) =>
      finishes.map((codes) => {
        const choice: CandidateChoice = { role: arrangement.role, family, codes };
        const kit = kitFor(input, arrangement, family, codes, shirt, article);
        return {
          id: idOf(choice),
          sportId: input.sportId,
          roleLabel: arrangement.roleLabel,
          familyLabel: family.label,
          choice,
          kit,
          crest: input.crest,
          primaryDeltaE00: primaryDrift(input.palette, kit.colours.main),
          note: noteFor(arrangement, family, codes, articleCode),
          ruleIds: [RULES.patternCost, RULES.optionCost, RULES.crestPlacement, RULES.colourTolerance],
        } satisfies KitCandidate;
      }),
    ),
  );
  const woven: KitCandidate[] = [];
  const longest = Math.max(0, ...perRole.map((list) => list.length));
  for (let at = 0; at < longest; at += 1) for (const list of perRole) if (list[at]) woven.push(list[at]!);
  return woven.slice(0, CREST_LIMITS.maxKits);
}

/** The note naming the families no base article carries a fill code for, or no note at all. */
export const missingFamiliesNote = (missing: readonly TemplateFamily[]): readonly string[] =>
  missing.length === 0
    ? []
    : [`${missing.map((family) => family.label.toLowerCase()).join(", ")}: no base article carries a print fill for ${missing.length === 1 ? "this" : "these"} yet.`];

/** Said where the engine could build some kits but fewer than the specification's six. */
export const fewKitsNote = (count: number): string =>
  `Knitwright built ${count} ${count === 1 ? "kit" : "kits"} from your crest, fewer than the six it aims for: the base article lists ${count === 1 ? "only one print fill and finish" : "few print fills and finishes"} so far.`;

/**
 * The kits a crest yields, in a fixed order, or the reason there are none. The notes are the things
 * the club has to be told either way: a role that could not be arranged, a family the catalogue
 * has no code for, and a count under the specification's six.
 */
export function candidateKits(input: EngineInput): EngineOutcome {
  const asked = rolesOf(input.roles);
  const shirt = shirtOf(input.sportId);
  const code = shirt?.articleCode ?? null;
  const article = code === null ? null : (input.articles.get(code) ?? null);
  const arranged = arrangementsFor(input.palette, input.feel, asked);
  const missing = familiesWithoutCode(input.feel, article);
  const notes = [...unarrangedRoles(input.palette, input.feel, asked), ...missingFamiliesNote(missing)];
  if (shirt === undefined || code === null || article === null) return { status: "none", reason: NO_SHIRT_ARTICLE, notes };
  if (!arranged.ok) return { status: "none", reason: arranged.reason, notes };
  const families = familiesFor(input.feel, article);
  if (families.length === 0) return { status: "none", reason: NO_FILLS, notes };
  const candidates = candidatesFor(input, arranged.arrangements, families, article, shirt, code);
  return {
    status: "kits",
    candidates,
    notes: candidates.length < CREST_LIMITS.minKits ? [...notes, fewKitsNote(candidates.length)] : notes,
  };
}

/** No rulebook entry explains how many kits a crest should yield. Listed on the pull request. */
export const KIT_COUNT_RULE = GAP_RULE_ID;
