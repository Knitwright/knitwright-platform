import { GAP_RULE_ID, type RulebookEntry } from "./constants";
import { latestOf } from "./select";

/**
 * The rulebook's sign-off (owner decisions 11 and 14; owner question F3).
 *
 * A rule's words are shown to a member only once somebody has confirmed the version, by name and role. Every one
 * of the seeded rules is a draft, so the Studio's "Why?" and best-practice cards say "nothing confirmed yet" for
 * all of them -- and confirming them one form at a time is 45 forms with the same two names typed into each.
 *
 * This splits the drafts into the two piles the rulebook's own Source column already draws, so a sign-off session
 * is one name, one role and one press:
 *
 *  * **Knitwright's own.** The note cites a published standard, a settled practice, or says "Knitwright draft"
 *    and nothing more. Nobody outside Knitwright is owed a say, so these are offered ticked.
 *  * **Waiting for somebody.** The note defers: "Factory to confirm their RIP settings", "replace with factory
 *    block values", "supplier declaration", "Confirm with legal consult", "approved only after a sample at each
 *    end". Confirming one of these in a Knitwright person's name would credit a sign-off nobody gave, which is
 *    the same mistake owner decision 13 took out of the `source` column. They are offered **unticked**, with the
 *    note and who it waits for shown, because the factory person who DID review one may still confirm it.
 *
 * The reading is deliberately a wide net over the note's words: a note that merely mentions a factory is held
 * back even when it is the factory's own statement. Holding a rule back costs a tick; letting one through puts a
 * name against words that person never read.
 */

/** A clause that defers to somebody who has not spoken yet, and who that is, in the words a person would use. */
const WAITS: readonly Readonly<{ pattern: RegExp; who: string }>[] = [
  { pattern: /\bfactor(?:y|ies)\b/i, who: "a factory" },
  { pattern: /\bsupplier\b/i, who: "a supplier" },
  { pattern: /\bpartner\b/i, who: "the production partner" },
  { pattern: /\blegal consult\b|\blawyer\b/i, who: "a lawyer" },
  { pattern: /\bafter a sample\b/i, who: "a sample" },
];

/** Who a source note is still waiting for, or null when the note rests on nobody outside Knitwright. */
export function waitsFor(sourceNote: string): string | null {
  const note = sourceNote.trim();
  return WAITS.find((wait) => wait.pattern.test(note))?.who ?? null;
}

/** One draft a person may sign off, with the reason it is or is not offered ticked. */
export type SignOffRule = Readonly<{
  ruleId: string;
  version: number;
  /** The rulebook's "Applies to" column: what the rule is about, in a line. */
  title: string;
  /** The rulebook's "Source" column, word for word. Shown beside a rule that waits, so the reason is visible. */
  sourceNote: string;
  /** Who the note still waits for, or null. Null means the rule is offered ticked. */
  waitsFor: string | null;
}>;

/**
 * The two piles. Only the newest version of each rule, only drafts, and never `R-GAP-000`: that row stands in for
 * a check with no rule behind it, its best practice is empty on purpose, and confirming "No rule written yet" as
 * reviewed by a person would be a sign-off on nothing.
 */
export type SignOffPlan = Readonly<{ owned: readonly SignOffRule[]; waiting: readonly SignOffRule[] }>;

export function signOffPlan(entries: readonly RulebookEntry[]): SignOffPlan {
  const drafts = latestOf(entries).filter((entry) => entry.status === "draft" && entry.ruleId !== GAP_RULE_ID);
  const rules = drafts.map(
    (entry): SignOffRule => ({
      ruleId: entry.ruleId,
      version: entry.version,
      title: entry.title,
      sourceNote: entry.sourceNote,
      waitsFor: waitsFor(entry.sourceNote),
    }),
  );
  return { owned: rules.filter((rule) => rule.waitsFor === null), waiting: rules.filter((rule) => rule.waitsFor !== null) };
}

/**
 * How one rule travels in the form: `R-SUB-004@1`. The version is part of it because a confirmation is of one
 * version and the page may have been open while somebody saved the next one -- the confirmation then misses and
 * the rule stays a draft, rather than confirming words nobody read.
 */
export const CHOICE = /^R-[A-Z]{2,8}-\d{3}@\d{1,6}$/;

export const choiceOf = (rule: Pick<SignOffRule, "ruleId" | "version">): string => `${rule.ruleId}@${rule.version}`;

/** Reads a choice back. Null for anything that is not one, so a hand-made form cannot reach the database. */
export function parseChoice(raw: string): Readonly<{ ruleId: string; version: number }> | null {
  const text = raw.trim();
  if (!CHOICE.test(text)) return null;
  const [ruleId = "", version = ""] = text.split("@");
  return { ruleId, version: Number(version) };
}

const count = (many: number, one: string): string => `${many} ${many === 1 ? one : `${one}s`}`;

/** The submit button says what it will do, and why it cannot when nothing is ticked. */
export const signOffLabel = (ticked: number): string =>
  ticked === 0 ? "Tick a rule to confirm" : `Confirm ${count(ticked, "rule")}`;

/**
 * What a finished session says. A press that signed off nothing cannot happen: the button is off at zero.
 *
 * "Signed off", not "confirmed", because `lib/techpack/wording.test.ts` keeps the settled-sounding words out of
 * every sentence the product shows unless that sentence is named in its allow list, and this one does not need
 * to be: it is the act in the page's own heading, said back.
 */
export const signOffDone = (confirmed: number): string =>
  `${count(confirmed, "rule")} signed off. Those are the words members see from now on.`;

/** The sentence over the list: what is offered, what is held back, and who it is held back for. */
export function signOffLead(plan: SignOffPlan): string {
  const held = [...new Set(plan.waiting.map((rule) => rule.waitsFor))].filter((who): who is string => who !== null);
  if (plan.waiting.length === 0) return `${count(plan.owned.length, "draft")} to sign off. Every one of them is Knitwright's own words or a published standard.`;
  if (plan.owned.length === 0) return `${count(plan.waiting.length, "draft")}, and every one of them is waiting for ${held.join(" or ")}. Tick one only if that person has read it.`;
  return `${count(plan.owned.length, "draft")} rest on Knitwright's own words or a published standard, and are ticked. ${count(plan.waiting.length, "other")} wait for ${held.join(", ")}, and are not.`;
}
