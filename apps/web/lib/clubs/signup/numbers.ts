/**
 * The shirt numbers a sport allows (spec F-T4 "numbers are 0-99 by default; configurable per
 * sport", plan v5 Z7, decision 0086).
 *
 * Every number here is a row of `sport_number_rules`, read by `service.ts` and passed in. Nothing
 * in this file decides a range, and there is no fallback that invents one: a sport with no row is a
 * sport the club cannot choose. Each rule carries the rule id that explains it, which is
 * `R-GAP-000` for every seeded row because the rulebook has no entry for a number range yet
 * (decision 0067); `R-PER-002` gives a back number's height, not the numbers it may be.
 */

export interface NumberRule {
  readonly sport: string;
  readonly label: string;
  readonly lowest: number;
  readonly highest: number;
  /** Whether "07" is kept as typed rather than read as 7. Some codes print a leading zero. */
  readonly leadingZeroAllowed: boolean;
  readonly ruleId: string;
  /** Says plainly where the range came from, so nobody reads a placeholder as a decision. */
  readonly note: string;
}

export type NumberCheck =
  | Readonly<{ ok: true; number: string }>
  | Readonly<{ ok: false; message: string; ruleId: string }>;

/** The sentence the form shows under the field, which quotes the rule rather than restating it. */
export const numberHint = (rule: NumberRule): string =>
  rule.leadingZeroAllowed
    ? `${rule.lowest} to ${rule.highest}. A leading zero is kept, so 07 is printed as 07.`
    : `${rule.lowest} to ${rule.highest}.`;

const DIGITS = /^[0-9]{1,3}$/;

/**
 * Whether a number as typed is one this sport allows. The digits are kept exactly as typed, so "07"
 * and "7" stay different numbers on a shirt, as the roster already keeps them (decision 0042).
 */
export function checkNumber(rule: NumberRule, typed: string): NumberCheck {
  const number = typed.trim();
  if (!DIGITS.test(number)) {
    return { ok: false, message: "A number is 1 to 3 digits, nothing else.", ruleId: rule.ruleId };
  }
  const value = Number(number);
  if (value < rule.lowest || value > rule.highest) {
    return { ok: false, message: `A ${rule.label.toLowerCase()} number is ${rule.lowest} to ${rule.highest}.`, ruleId: rule.ruleId };
  }
  if (!rule.leadingZeroAllowed && number.length > 1 && number.startsWith("0")) {
    return { ok: false, message: `A ${rule.label.toLowerCase()} number does not start with a zero.`, ruleId: rule.ruleId };
  }
  return { ok: true, number };
}

/** The numbers of this sport, in order, so a form can offer a list rather than a free field. */
export function numbersOf(rule: NumberRule): readonly string[] {
  const all: string[] = [];
  for (let value = rule.lowest; value <= rule.highest; value += 1) all.push(String(value));
  return all;
}
