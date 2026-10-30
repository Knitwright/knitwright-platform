import { z } from "zod";
import { AppError } from "@/lib/server/core/errors";
import { benchmarkCardSchema, MAX_SIZES, MAX_TEXT, type BenchmarkCard } from "./schema";
import { plain } from "./scrub";
import { FEATURE_KEYS } from "./vocabulary";

/**
 * The confirm-and-correct step (spec F-S2 step 4). A person reads the card and either confirms it as it stands or
 * types what the model got wrong. Three rules live here:
 *
 *  1. **Their words are theirs.** A field they typed becomes `observed` and `corrected`, so the screen says "corrected
 *     by your team" rather than "stated on the page" (lib/benchmarks/card.ts). Nothing pretends a person's correction
 *     came off the page.
 *  2. **Clearing a field is a correction too.** An empty box means "not known": the value goes and the provenance
 *     becomes `unknown`, which is the honest answer and never a guess left in place.
 *  3. **Only these fields are a person's to correct.** The feature list, the claims and the complaint themes are
 *     corrected by ticking features and are not free text, so no pasted review or copied marketing line can arrive
 *     through this door.
 */

/** A price as a person types it: "45", "45.50", "£45.50". Minor units, because that is how money is kept. */
export function minorUnitsOf(typed: string): number | null {
  const digits = /^[^\d-]{0,3}(\d{1,8})(?:[.,](\d{1,2}))?$/.exec(plain(typed));
  if (digits === null) return null;
  const minor = (digits[2] ?? "").padEnd(2, "0");
  return Number(digits[1]) * 100 + Number(minor);
}

const words = z.string().max(MAX_TEXT).transform(plain);

export const correctionSchema = z.object({
  productName: words.optional(),
  brandName: words.optional(),
  price: z.string().max(24).optional(),
  currency: z.string().max(8).optional(),
  gsm: z.string().max(8).optional(),
  fabricComposition: words.optional(),
  fit: words.optional(),
  /** Sizes as a person types them: "S, M, L". */
  sizeRange: z.string().max(MAX_SIZES * 17).optional(),
  /**
   * The feature keys the card should hold after the correction. Ticked, never typed. A form with one box ticked sends
   * one value and a form with three sends three, so both shapes are read.
   */
  features: z
    .union([z.string().max(60), z.array(z.string().max(60)).max(40)])
    .transform((ticked) => (typeof ticked === "string" ? [ticked] : ticked))
    .optional(),
});

export type Correction = z.output<typeof correctionSchema>;

type Field<T> = Readonly<{ value: T | null; provenance: string; corrected: boolean }>;

/** Their words, or "not known" when the box is empty. Either way the field says a person settled it. */
const theirs = <T>(value: T | null): Field<T> =>
  value === null ? { value: null, provenance: "unknown", corrected: true } : { value, provenance: "observed", corrected: true };

const sizesOf = (typed: string): readonly string[] | null => {
  const sizes = typed
    .split(/[,/]/)
    .map((size) => plain(size).slice(0, 16))
    .filter(Boolean)
    .slice(0, MAX_SIZES);
  return sizes.length === 0 ? null : sizes;
};

const priceOf = (card: BenchmarkCard, typed: string, currency: string | undefined): Field<{ minor: number; currency: string }> => {
  const minor = minorUnitsOf(typed);
  const code = (currency ?? card.price.value?.currency ?? "GBP").toUpperCase();
  return minor === null || !/^[A-Z]{3}$/.test(code) ? theirs(null) : theirs({ minor, currency: code });
};

const gsmOf = (typed: string): Field<number> => {
  const read = z.coerce.number().int().min(20).max(1200).safeParse(plain(typed));
  return read.success ? theirs(read.data) : theirs(null);
};

const text = (typed: string): Field<string> => theirs(typed === "" ? null : typed.slice(0, MAX_TEXT));

/**
 * The card as the person settled it. A field they left out of the correction keeps exactly what it had, including how
 * it was known; a field they sent is theirs. The whole card goes through the schema again, so a correction can no more
 * put markup or a measurement with no source into a card than the model could.
 */
export function applyCorrection(card: BenchmarkCard, correction: Correction): BenchmarkCard {
  const next: Record<string, unknown> = { ...card };
  if (correction.productName !== undefined) next.productName = text(correction.productName);
  if (correction.brandName !== undefined) next.brandName = text(correction.brandName);
  if (correction.fabricComposition !== undefined) next.fabricComposition = text(correction.fabricComposition);
  if (correction.fit !== undefined) next.fit = text(correction.fit);
  if (correction.price !== undefined) next.price = priceOf(card, correction.price, correction.currency);
  if (correction.gsm !== undefined) next.gsm = gsmOf(correction.gsm);
  if (correction.sizeRange !== undefined) next.sizeRange = theirs(sizesOf(correction.sizeRange));
  if (correction.features !== undefined) next.features = featuresAfter(card, correction.features);
  const parsed = benchmarkCardSchema.safeParse(next);
  if (!parsed.success) throw new AppError("invalid_input", "That correction does not fit a benchmark card. Check the price and the fabric weight.");
  return parsed.data;
}

/**
 * The features the person ticked. One they ticked that the model did not find is `observed` and `corrected`: they are
 * telling us it is there. One they unticked goes, rather than staying in the card as a thing nobody believes.
 */
function featuresAfter(card: BenchmarkCard, ticked: readonly string[]): readonly BenchmarkCard["features"][number][] {
  const was = new Map(card.features.map((feature) => [feature.key, feature]));
  return [...new Set(ticked)]
    .filter((key) => FEATURE_KEYS.includes(key))
    .flatMap((key) => {
      const before = was.get(key);
      if (before !== undefined) return [before];
      return [{ key, provenance: "observed" as const, corrected: true }];
    });
}
