import { benchmarkCardSchema, emptyCard, type BenchmarkCard } from "../schema";
import type { StoredCard } from "../compare";

/**
 * Cards for the tests. The brand and product names here are invented ("Acme", "Zephyr"), so a test can prove that no
 * part of an "apply to my design" plan carries them.
 */

type Parts = Partial<Record<string, unknown>>;

export const card = (parts: Parts = {}): BenchmarkCard => benchmarkCardSchema.parse({ ...emptyCard(), ...parts });

/** A fully read page: a competitor's running short, with features, claims and complaint themes. */
export const runningShort = (): BenchmarkCard =>
  card({
    productName: { value: "Acme Speedshort 5in", provenance: "observed" },
    brandName: { value: "Acme", provenance: "observed" },
    price: { value: { minor: 4500, currency: "GBP" }, provenance: "observed" },
    gsm: { value: 140, provenance: "observed" },
    fabricComposition: { value: "88% polyester, 12% elastane", provenance: "observed" },
    fit: { value: "Slim", provenance: "observed" },
    sizeRange: { value: ["S", "M", "L", "XL"], provenance: "observed" },
    features: [
      { key: "zip_back_pocket", provenance: "observed" },
      { key: "bonded_hem", provenance: "inferred" },
      { key: "liner", provenance: "observed" },
      { key: "drawcord", provenance: "observed" },
      { key: "all_over_print", provenance: "inferred" },
    ],
    claims: [{ value: "Squat-proof", provenance: "observed" }],
    complaintThemes: [
      { theme: "The liner rides up", count: 31 },
      { theme: "The pocket bounces when running", count: 19 },
    ],
    surfaceLayout: [
      { zone: "left_chest", kind: "mark", provenance: "inferred" },
      { zone: "side_panel", kind: "block", provenance: "inferred" },
      { zone: "hem", kind: "stripe", provenance: "inferred" },
    ],
  });

/** A photo intake: nothing is stated, so nothing is observed and no measurement is known. */
export const fromPhoto = (): BenchmarkCard =>
  card({
    productName: { value: "Zephyr long-sleeve", provenance: "inferred" },
    features: [
      { key: "mock_neck", provenance: "inferred" },
      { key: "thumb_loops", provenance: "inferred" },
    ],
    surfaceLayout: [{ zone: "sleeve", kind: "stripe", provenance: "inferred" }],
  });

export const stored = (id: string, body: BenchmarkCard, parts: Partial<StoredCard> = {}): StoredCard => ({
  id,
  sourceKind: "url",
  sourceUrl: "https://example.test/product",
  sourceHost: "example.test",
  card: body,
  extractor: "stub",
  confirmedAt: null,
  ...parts,
});
