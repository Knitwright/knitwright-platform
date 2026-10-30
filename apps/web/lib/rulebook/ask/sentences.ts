import { RULE_ID } from "../constants";

/**
 * Reading an answer as sentences, citations and measurements (decision 0083). The grader works on these three
 * readings, so they are kept apart from it and tested on their own.
 *
 * A citation is a rule id written in the sentence, as the spec's examples write it: "...a slight offset is fine
 * (R-SUB-004)." A measurement is a number with a unit. Both are read mechanically: nothing here understands the
 * sentence, and nothing has to.
 */

/** A rule id anywhere in a sentence. The same shape as `RULE_ID`, without the anchors. */
const CITATION = /R-[A-Z]{2,8}-\d{3}/g;

/**
 * The sentences of a piece of text. A sentence ends at a full stop, question mark or exclamation mark followed
 * by a space and something that starts a new sentence, so "1.5%", "R-SUB-004." and "ISO 514.504" stay whole.
 */
export function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.?!])["')\]]?\s+(?=[A-Z("'“])/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== "");
}

/** The rule ids a sentence cites, in the order they appear, without repeats. */
export const citationsIn = (text: string): string[] => [
  ...new Set((text.match(CITATION) ?? []).filter((id) => RULE_ID.test(id))),
];

/** The sentence without its citations, so a citation's own digits are never read as a measurement. */
export const withoutCitations = (text: string): string => text.replace(CITATION, " ");

/**
 * The units a rulebook rule states a number in. Nothing outside this list is read as a measurement, so an
 * ordinary number in a sentence ("one continuous seam") is not treated as one.
 */
export const UNITS = [
  "mm",
  "cm",
  "m",
  "in",
  "pt",
  "%",
  "dpi",
  "spi",
  "tex",
  "g",
  "kg",
  "gsm",
  "mpa",
] as const;

const UNIT_WORDS = UNITS.join("|");

/** A number and its unit: "3 mm", "1.5%", "12-14 stitches per inch" reads as "12" then "14" with no unit. */
const MEASUREMENT = new RegExp(String.raw`(\d+(?:[.,]\d+)?)\s*(${UNIT_WORDS})(?!\w)`, "gi");

/** A measurement as it will be compared: the number with its unit, lower case, no space. */
export const normaliseMeasurement = (value: string, unit: string): string =>
  `${value.replace(",", ".").replace(/\.0+$/, "")}${unit.toLowerCase()}`;

/** Every measurement in a piece of text, normalised. Citations are taken out first. */
export function measurementsIn(text: string): string[] {
  const found = new Set<string>();
  for (const match of withoutCitations(text).matchAll(MEASUREMENT)) {
    found.add(normaliseMeasurement(match[1], match[2]));
  }
  return [...found];
}

/**
 * The measurements a set of rules states, as the same normalised strings. A percentage written "1.5 %" and one
 * written "1.5%" are the same measurement, and a rule that states a range states both of its ends.
 */
export const measurementsOf = (texts: readonly string[]): Set<string> =>
  new Set(texts.flatMap((text) => measurementsIn(text)));

/**
 * The measurements of a rule, including the ones a range writes once: "12–14 stitches per inch" has no unit, but
 * "85–100% polyester" states 85% and 100%, and "0 to 6 mm" states 0 mm and 6 mm. Each number before a dash, a
 * slash, "to" or "and" takes the unit of the number that ends the range.
 */
export function measurementsOfRule(text: string): string[] {
  const plain = withoutCitations(text);
  const ranges = plain.matchAll(
    new RegExp(String.raw`(\d+(?:[.,]\d+)?)\s*(?:[-–—/]|to|and)\s*(\d+(?:[.,]\d+)?)\s*(${UNIT_WORDS})(?!\w)`, "gi"),
  );
  const ends = [...ranges].map((match) => normaliseMeasurement(match[1], match[3]));
  return [...new Set([...measurementsIn(plain), ...ends])];
}
