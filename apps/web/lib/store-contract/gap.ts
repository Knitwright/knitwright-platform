/**
 * The gap. The one idea the whole contract rests on (plan v5 O2).
 *
 * Another product is written against this payload, and the two things it most wants — a delivery
 * date and an Australian dollar price — are exactly the two the platform does not hold. A null in
 * their place is worse than nothing: a Store that reads `promisedOn: null` can render today's date,
 * and a Store that reads `unitMinor: null` can render zero. So a value this platform does not hold
 * is never sent as a null and never sent as a field at all. It is sent as a `Gap`: a different
 * shape, with `status: "gap"`, the list of what is missing in the platform's own words, one
 * sentence a reader may show instead, and the rule that explains it.
 *
 * Every field of every payload that could be absent is a union of a held shape and a `Gap`, both
 * tagged `status`, so a reader that forgets to look is a type error rather than a wrong date on a
 * page. `gap.test.ts` holds a `Gap` to carrying no value-shaped field and no null at all.
 */

/** Used wherever no rulebook entry explains a gap yet (plan v5, "Every rule explains itself"). */
export const GAP_RULE_ID = "R-GAP-000";

export const RULE_SHAPE = /^R-[A-Z]+-[0-9]{3}$/;

/** What the platform does not hold, instead of the value. It carries no value, not even a null one. */
export interface Gap {
  readonly status: "gap";
  /** Each missing thing, in the words the platform already uses for it. Never empty. */
  readonly missing: readonly string[];
  /** One sentence a reader may show in place of the value. */
  readonly because: string;
  readonly ruleId: string;
}

/** Anything the platform does hold. Tagged the same way, so one check tells the two apart. */
export type Held<T> = Readonly<{ status: "held" }> & Readonly<T>;

/** A field that is either held or missing. */
export type Known<T> = Held<T> | Gap;

export const held = <T extends object>(value: T): Held<T> => ({ status: "held", ...value }) as Held<T>;

export function gap(missing: readonly string[], because: string, ruleId: string = GAP_RULE_ID): Gap {
  if (missing.length === 0) throw new RangeError("A gap names what is missing; an empty list says nothing.");
  if (!RULE_SHAPE.test(ruleId)) throw new RangeError(`A rule id looks like R-TOPIC-001, not ${ruleId}.`);
  return { status: "gap", missing: [...missing], because, ruleId };
}

export const isGap = (value: Readonly<{ status: string }>): value is Gap => value.status === "gap";

/** "the days for QC and the freight days". The same joining the rest of the platform uses. */
export const listOf = (words: readonly string[]): string =>
  words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

/**
 * "Knitwright holds no figure for the days for QC and the freight days, so no delivery date exists."
 * One sentence, built from the list, so every gap of a kind reads the same way.
 */
export const because = (missing: readonly string[], consequence: string): string =>
  `Knitwright holds no figure for ${listOf(missing)}, so ${consequence}`;
