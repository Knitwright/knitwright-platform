import { z } from "zod";
import { benchmarkCardSchema, emptyCard, MAX_CLAIMS, MAX_FEATURES, MAX_LAYOUT, MAX_THEMES, type BenchmarkCard } from "./schema";
import { isParaphrase, plain } from "./scrub";
import { FEATURE_KEYS, featureOf, LAYOUT_KINDS, LAYOUT_ZONES, type LayoutKind, type LayoutZone, type Provenance, type SourceKind } from "./vocabulary";

/**
 * A model's answer, made safe (plan rule: the parser decides, never the provider). Anything the schema refuses
 * becomes "unknown" rather than failing the whole card, and three rules are applied here, not trusted to the model:
 *
 *  1. a photo shows nothing in words, so nothing read from one is `observed`;
 *  2. a measurement is never `inferred` — an inferred price or GSM would be an invented measurement, so it is dropped;
 *  3. a complaint theme that copies the reviewer's words is dropped, because only a paraphrase may be kept.
 */

const field = z.object({ value: z.unknown().optional(), provenance: z.string().optional() }).passthrough();

const looseSchema = z
  .object({
    productName: field.optional(),
    brandName: field.optional(),
    price: field.optional(),
    gsm: field.optional(),
    fabricComposition: field.optional(),
    fit: field.optional(),
    sizeRange: field.optional(),
    features: z.array(z.object({ key: z.string(), provenance: z.string().optional() }).passthrough()).optional(),
    claims: z.array(field).optional(),
    complaintThemes: z.array(z.object({ theme: z.string(), count: z.unknown().optional() }).passthrough()).optional(),
    surfaceLayout: z.array(z.object({ zone: z.string(), kind: z.string(), provenance: z.string().optional() }).passthrough()).optional(),
  })
  .passthrough();

const UNKNOWN = { value: null, provenance: "unknown", corrected: false } as const;

const how = (raw: unknown, kind: SourceKind): Provenance => {
  const said = typeof raw === "string" ? raw.toLowerCase() : "unknown";
  const seen: Provenance = said === "observed" ? "observed" : said === "inferred" ? "inferred" : "unknown";
  // Rule 1: a photo is a picture, not a statement.
  return kind === "photo" && seen === "observed" ? "inferred" : seen;
};

const text = (raw: z.infer<typeof field> | undefined, kind: SourceKind, max: number) => {
  const provenance = how(raw?.provenance, kind);
  const value = typeof raw?.value === "string" ? plain(raw.value).slice(0, max) : "";
  return value === "" || provenance === "unknown" ? UNKNOWN : { value, provenance, corrected: false };
};

/** Rule 2: stated, or not known. Nothing in between. */
const measured = <T>(raw: z.infer<typeof field> | undefined, kind: SourceKind, read: (value: unknown) => T | null) => {
  const value = how(raw?.provenance, kind) === "observed" ? read(raw?.value) : null;
  return value === null ? UNKNOWN : { value, provenance: "observed" as const, corrected: false };
};

const priceOf = (value: unknown): { minor: number; currency: string } | null => {
  const parsed = z.object({ minor: z.number().int().min(0), currency: z.string().regex(/^[A-Za-z]{3}$/) }).safeParse(value);
  return parsed.success ? { minor: parsed.data.minor, currency: parsed.data.currency.toUpperCase() } : null;
};

const gsmOf = (value: unknown): number | null => {
  const parsed = z.number().int().min(20).max(1200).safeParse(value);
  return parsed.success ? parsed.data : null;
};

const sizesOf = (raw: z.infer<typeof field> | undefined, kind: SourceKind) => {
  const provenance = how(raw?.provenance, kind);
  const parsed = z.array(z.string()).max(64).safeParse(raw?.value);
  const sizes = parsed.success ? parsed.data.map((size) => plain(size).slice(0, 16)).filter(Boolean).slice(0, 24) : [];
  return sizes.length === 0 || provenance === "unknown" ? UNKNOWN : { value: sizes, provenance, corrected: false };
};

const featuresOf = (raw: z.infer<typeof looseSchema>["features"], kind: SourceKind) => {
  const seen = new Map<string, "observed" | "inferred">();
  for (const item of raw ?? []) {
    const provenance = how(item.provenance, kind);
    if (!FEATURE_KEYS.includes(item.key) || provenance === "unknown" || seen.has(item.key)) continue;
    seen.set(item.key, provenance);
  }
  return [...seen].slice(0, MAX_FEATURES).map(([key, provenance]) => ({ key, provenance, corrected: false }));
};

/** Rule 3: a theme that runs on word for word with the words it came from is a copy, and is dropped. */
const themesOf = (raw: z.infer<typeof looseSchema>["complaintThemes"], source: string) =>
  (raw ?? [])
    .map((item) => ({ theme: plain(item.theme).slice(0, 160), count: z.number().int().min(1).max(100_000).safeParse(item.count).data ?? 1 }))
    .filter((item) => item.theme !== "" && isParaphrase(item.theme, source))
    .sort((a, b) => b.count - a.count || a.theme.localeCompare(b.theme))
    .slice(0, MAX_THEMES);

/** That something of a kind sits in a zone: the words must be ones we know, or the item is dropped. */
const layoutOf = (raw: z.infer<typeof looseSchema>["surfaceLayout"], kind: SourceKind) => {
  const seen = new Map<string, { zone: LayoutZone; kind: LayoutKind; provenance: "observed" | "inferred" }>();
  for (const item of raw ?? []) {
    const provenance = how(item.provenance, kind);
    const zone = LAYOUT_ZONES.find((known) => known === item.zone);
    const shape = LAYOUT_KINDS.find((known) => known === item.kind);
    if (zone === undefined || shape === undefined || provenance === "unknown") continue;
    seen.set(`${zone}:${shape}`, { zone, kind: shape, provenance });
  }
  return [...seen.values()].slice(0, MAX_LAYOUT);
};

/** Builds the card from whatever the model said. The source words are passed in only to catch copied reviews. */
export function cardFrom(raw: unknown, kind: SourceKind, source = ""): BenchmarkCard {
  const loose = looseSchema.safeParse(raw);
  if (!loose.success) return emptyCard();
  const said = loose.data;
  const card = {
    productName: text(said.productName, kind, 120),
    brandName: text(said.brandName, kind, 120),
    price: measured(said.price, kind, priceOf),
    gsm: measured(said.gsm, kind, gsmOf),
    fabricComposition: text(said.fabricComposition, kind, 120),
    fit: text(said.fit, kind, 120),
    sizeRange: sizesOf(said.sizeRange, kind),
    features: featuresOf(said.features, kind),
    // A claim is the seller's own words on their own page, so it is kept only where it is stated.
    claims: (said.claims ?? []).map((claim) => text(claim, kind, 80)).filter((claim) => claim.provenance === "observed").slice(0, MAX_CLAIMS),
    complaintThemes: themesOf(said.complaintThemes, source),
    surfaceLayout: layoutOf(said.surfaceLayout, kind),
  };
  const parsed = benchmarkCardSchema.safeParse(card);
  return parsed.success ? parsed.data : emptyCard();
}

/**
 * Rule 3 again, on a whole card, wherever the card did not come from `cardFrom` (a stub extractor in a test, a card a
 * person corrected by hand). A theme that runs on word for word with the words it came from is dropped.
 */
export const withoutCopies = (card: BenchmarkCard, source: string): BenchmarkCard =>
  source.trim() === "" ? card : { ...card, complaintThemes: card.complaintThemes.filter((theme) => isParaphrase(theme.theme, source)) };

/** The features of a card that may be carried onto a design: the functional ones, and nothing else. */
export const functionalFeatures = (card: BenchmarkCard) => card.features.filter((f) => featureOf(f.key)?.kind === "functional");
