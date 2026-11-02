import { citationsIn, measurementsIn, measurementsOfRule, sentencesOf } from "./sentences";
import type { AskDefect, AskGrade, AskSentence, RetrievedRule } from "./types";

/**
 * The grader (spec F-S5 v2 acceptance: "in a 50-question test set, 0 answers state a fact not in the rulebook").
 * It is the thing that stops this feature inventing garment facts, so it is mechanical and it is strict, and the
 * answer is only shown when it finds nothing.
 *
 * Four readings of every sentence an answer holds:
 *
 *  1. **Every sentence names a rule.** A sentence with no rule id in it is a defect. A sentence nobody can trace
 *     to a rule is exactly the settled-sounding claim the wording rules exist to stop, however true it sounds.
 *  2. **Every id was retrieved.** An id the search did not return is a defect, whether it is a real rule the
 *     question did not reach or an id the model made up.
 *  3. **The structured answer says the same as its words.** The ids a sentence carries as data must be the ids
 *     written in it, so neither reading can be the one that quietly drops a citation.
 *  4. **Every measurement is in the rules the sentence cites.** A number with a unit that none of the cited
 *     versions states is an invented measurement, which no part of this platform is allowed to produce.
 *
 * It does not read the sentence for meaning: it cannot, and a grader that claimed to would be the weakest part
 * of the feature. What it guarantees is that every sentence is traceable to one rule and adds no measurement to
 * it. Phrasing that restates a rule wrongly without numbers is caught by the rulebook's own words being shown
 * beside the answer, and by the team's review of the gap list.
 */

/** A sentence of an answer that may carry no citation: the fixed words for a question nothing covers. */
export const NOT_COVERED =
  "Knitwright's rulebook has no rule about that yet. The team has been told, so it can be written with the factory.";

/** What the Ask box says when the model wrote something the rulebook does not hold. */
export const UNGROUNDED =
  "That answer could not be traced to the rulebook, so it is not shown. The rules the search found are below, in the rulebook's own words.";

/** What the Ask box says when no model is switched on. */
export const NO_MODEL =
  "Asking a question in your own words is not switched on yet. The rules the search found are below, in the rulebook's own words.";

/** What the Ask box says when this month's allowance for asking is used up. */
export const OVER_ALLOWANCE =
  "Your allowance for asking questions is used up for now. The rules the search found are below, in the rulebook's own words.";

const defect = (kind: AskDefect["kind"], sentence: string, detail: string): AskDefect => ({ kind, sentence, detail });

type Lookup = Readonly<{ ids: ReadonlySet<string>; measurements: Readonly<Record<string, ReadonlySet<string>>> }>;

/** What each retrieved rule states, by id: the measurements of the version this reader is being shown. */
export function lookupOf(rules: readonly RetrievedRule[]): Lookup {
  const measurements: Record<string, ReadonlySet<string>> = {};
  for (const rule of rules) {
    measurements[rule.ruleId] = new Set(
      [rule.title, rule.rule, rule.body, rule.bestPractice].flatMap((text) => measurementsOfRule(text)),
    );
  }
  return { ids: new Set(rules.map((rule) => rule.ruleId)), measurements };
}

/** Readings 1 and 2 of one sentence: it names a rule, and that rule is one the search found. */
function citationDefects(sentence: string, lookup: Lookup): AskDefect[] {
  const written = citationsIn(sentence);
  if (written.length === 0) {
    return [defect("uncited_sentence", sentence, "The sentence names no rule, so nothing in the rulebook stands behind it.")];
  }
  return written
    .filter((id) => !lookup.ids.has(id))
    .map((id) => defect("id_not_retrieved", sentence, `${id} was not one of the rules the search found.`));
}

/** Reading 3, over a whole part: the ids it records as data are the ids written in its words, and no others. */
function mismatchDefect(text: string, claimed: readonly string[]): AskDefect | null {
  const written = citationsIn(text);
  const same = written.length === claimed.length && written.every((id) => claimed.includes(id));
  return same
    ? null
    : defect(
        "citation_mismatch",
        text,
        `The words cite ${written.join(", ") || "nothing"} and the answer records ${[...claimed].join(", ") || "nothing"}.`,
      );
}

/** Reading 4: every measurement in the sentence is stated by one of the rules it cites. */
function measurementDefects(sentence: string, lookup: Lookup): AskDefect[] {
  const cited = citationsIn(sentence).filter((id) => lookup.ids.has(id));
  const stated = new Set(cited.flatMap((id) => [...(lookup.measurements[id] ?? [])]));
  return measurementsIn(sentence)
    .filter((measurement) => !stated.has(measurement))
    .map((measurement) =>
      defect("measurement_not_in_the_rule", sentence, `${measurement} is not a measurement ${cited.join(", ") || "any cited rule"} states.`),
    );
}

/**
 * Grades an answer against the rules the search retrieved. A sentence may be the fixed "not covered" words
 * without citing anything; every other sentence is read four ways.
 */
export function gradeAnswer(sentences: readonly AskSentence[], rules: readonly RetrievedRule[]): AskGrade {
  const lookup = lookupOf(rules);
  const defects: AskDefect[] = [];
  const cited: string[] = [];
  let said = 0;
  for (const part of sentences) {
    const parts = sentencesOf(part.text);
    said += parts.length;
    if (part.text.trim() === NOT_COVERED) continue;
    const mismatch = mismatchDefect(part.text, part.ruleIds);
    if (mismatch) defects.push(mismatch);
    for (const sentence of parts) {
      defects.push(...citationDefects(sentence, lookup), ...measurementDefects(sentence, lookup));
      for (const id of citationsIn(sentence)) if (!cited.includes(id)) cited.push(id);
    }
  }
  if (said === 0) defects.push(defect("no_sentences", "", "The answer holds no sentence."));
  return { ok: defects.length === 0, defects, cited };
}
