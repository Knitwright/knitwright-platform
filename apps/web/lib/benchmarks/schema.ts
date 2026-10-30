import { z } from "zod";
import { hasMarkup, plain } from "./scrub";
import { FEATURE_KEYS, LAYOUT_KINDS, LAYOUT_ZONES, MAX_CARDS, MIN_COMPARE, PROVENANCES, type Provenance } from "./vocabulary";

/**
 * The fixed schema a benchmark card is extracted into (spec F-S2 step 3) and the provenance rules that go with it:
 *
 *  * every field says how it is known: observed, inferred or unknown;
 *  * a field that is not known holds no value, and a field that holds a value is never "unknown";
 *  * a measurement (a price, a GSM) may only be observed or unknown. A measurement read out of a picture would be an
 *    invented measurement, which the plan forbids outright, so `inferred` is not allowed on those fields;
 *  * no string holds markup, and every one is short. A review is never kept: only a short paraphrase of its theme.
 */

export const MAX_TEXT = 120;
export const MAX_CLAIM = 80;
export const MAX_THEME = 160;
export const MAX_SIZES = 24;
export const MAX_FEATURES = 24;
export const MAX_CLAIMS = 6;
export const MAX_THEMES = 8;
export const MAX_LAYOUT = 12;
/** 2 to 5 cards side by side (spec F-S2 step 5). Kept in the vocabulary, and passed on here for the callers it had. */
export { MAX_CARDS, MIN_COMPARE };

/** One line of plain words: trimmed, no markup, no control characters. */
const line = (max: number) =>
  z
    .string()
    .max(max)
    .transform(plain)
    .refine((text) => text.length > 0, "Say it in words.")
    .refine((text) => !hasMarkup(text), "A benchmark never keeps anything out of a page's source.");

const SEEN = ["observed", "inferred"] as const;
/** What a field may say about itself. */
const provenance = z.enum(PROVENANCES);
/** A measurement is stated or not known. It is never read off a picture (plan rule: no invented measurement). */
const statedOnly = z.enum(["observed", "unknown"]);

const provenanced = <T>(value: z.ZodType<T>, how: z.ZodType<Provenance> = provenance) =>
  z
    .strictObject({
      value: value.nullable(),
      provenance: how,
      /** True once a person has confirmed or corrected the field. A corrected field is theirs, not the model's. */
      corrected: z.boolean().default(false),
    })
    .refine((field) => (field.provenance === "unknown") === (field.value === null), {
      message: "A field that is not known holds no value, and a field with a value says how it is known.",
    });

const price = z.strictObject({ minor: z.number().int().min(0).max(100_000_000), currency: z.string().regex(/^[A-Z]{3}$/) });

export const benchmarkCardSchema = z.strictObject({
  productName: provenanced(line(MAX_TEXT)),
  /** Kept so the comparison can be read, and never carried onto a design (lib/benchmarks/apply.ts). */
  brandName: provenanced(line(MAX_TEXT)),
  price: provenanced(price, statedOnly),
  fabricComposition: provenanced(line(MAX_TEXT)),
  gsm: provenanced(z.number().int().min(20).max(1200), statedOnly),
  fit: provenanced(line(MAX_TEXT)),
  sizeRange: provenanced(z.array(line(16)).min(1).max(MAX_SIZES)),
  features: z
    .array(z.strictObject({ key: z.enum(FEATURE_KEYS as [string, ...string[]]), provenance: z.enum(SEEN), corrected: z.boolean().default(false) }))
    .max(MAX_FEATURES)
    .refine((list) => new Set(list.map((f) => f.key)).size === list.length, "A feature is listed once."),
  /** What the seller says about the product, e.g. "squat-proof". Their claim, marked as theirs, never ours. */
  claims: z.array(provenanced(line(MAX_CLAIM), statedOnly)).max(MAX_CLAIMS),
  /** Complaint themes as short paraphrases with how often they came up. Never a reviewer's own words. */
  complaintThemes: z
    .array(z.strictObject({ theme: line(MAX_THEME), count: z.number().int().min(1).max(100_000) }))
    .max(MAX_THEMES),
  /** That something of a kind sits in a zone, and nothing more. Read by the design-around check. */
  surfaceLayout: z
    .array(z.strictObject({ zone: z.enum(LAYOUT_ZONES), kind: z.enum(LAYOUT_KINDS), provenance: z.enum(SEEN) }))
    .max(MAX_LAYOUT)
    .refine((list) => new Set(list.map((item) => `${item.zone}:${item.kind}`)).size === list.length, "A zone holds each kind once."),
});

export type BenchmarkCard = z.output<typeof benchmarkCardSchema>;
export type CardField<T> = Readonly<{ value: T | null; provenance: Provenance; corrected: boolean }>;

/** An empty card: every field unknown. The card a photo with nothing readable in it comes back as. */
export const emptyCard = (): BenchmarkCard =>
  benchmarkCardSchema.parse({
    productName: { value: null, provenance: "unknown" },
    brandName: { value: null, provenance: "unknown" },
    price: { value: null, provenance: "unknown" },
    fabricComposition: { value: null, provenance: "unknown" },
    gsm: { value: null, provenance: "unknown" },
    fit: { value: null, provenance: "unknown" },
    sizeRange: { value: null, provenance: "unknown" },
    features: [],
    claims: [],
    complaintThemes: [],
    surfaceLayout: [],
  });

export const TEXT_FIELDS = ["productName", "brandName", "fabricComposition", "fit"] as const;
export type TextFieldName = (typeof TEXT_FIELDS)[number];

/** The fields a measurement lives in, which `inferred` may never reach. */
export const MEASURED_FIELDS = ["price", "gsm"] as const;
