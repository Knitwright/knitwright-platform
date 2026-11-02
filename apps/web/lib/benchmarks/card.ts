import { formatMoney } from "@/lib/factory/pricing";
import type { BenchmarkCard } from "./schema";
import { featureOf, type Provenance } from "./vocabulary";

/**
 * What a card looks like on the screen. The one rule this file exists for: a value is never shown without saying how
 * it is known, and an inferred value is never shown as a fact (spec F-S2 step 4, plan Z3). So a field view always
 * carries `how`, and `line()` puts those words next to the value wherever there is room for prose.
 */

export const PROVENANCE_LABELS: Readonly<Record<Provenance, string>> = {
  observed: "stated on the page",
  inferred: "read off the picture, not stated",
  unknown: "not known",
};

/** The legend of the compare view, as the spec draws it: "obs = stated · inf = inferred". */
export const PROVENANCE_MARKS: Readonly<Record<Provenance, string>> = { observed: "obs", inferred: "inf", unknown: "–" };

export const NOT_KNOWN = "Not known";

export type FieldView = Readonly<{
  name: string;
  label: string;
  /** The value in words, or "Not known". */
  value: string;
  provenance: Provenance;
  /** How it is known, always. */
  how: string;
  mark: string;
  corrected: boolean;
}>;

const view = (name: string, label: string, raw: { provenance: Provenance; corrected: boolean }, value: string | null): FieldView => ({
  name,
  label,
  value: raw.provenance === "unknown" || value === null ? NOT_KNOWN : value,
  provenance: raw.provenance,
  how: raw.corrected ? "corrected by your team" : PROVENANCE_LABELS[raw.provenance],
  mark: PROVENANCE_MARKS[raw.provenance],
  corrected: raw.corrected,
});

/** One line of prose: the value and, always, how it is known. */
export const line = (field: FieldView): string => `${field.label}: ${field.value} (${field.how})`;

export function cardFields(card: BenchmarkCard): readonly FieldView[] {
  return [
    view("productName", "Product", card.productName, card.productName.value),
    view("brandName", "Sold by", card.brandName, card.brandName.value),
    view("price", "Price", card.price, card.price.value === null ? null : formatMoney(card.price.value.minor, card.price.value.currency)),
    view("fabricComposition", "Fabric", card.fabricComposition, card.fabricComposition.value),
    view("gsm", "GSM", card.gsm, card.gsm.value === null ? null : `${card.gsm.value} g/m²`),
    view("fit", "Fit", card.fit, card.fit.value),
    view("sizeRange", "Sizes", card.sizeRange, card.sizeRange.value === null ? null : card.sizeRange.value.join(" · ")),
  ];
}

export type FeatureView = Readonly<{ key: string; label: string; purpose: string; kind: string; provenance: Provenance; how: string; mark: string }>;

export function cardFeatures(card: BenchmarkCard): readonly FeatureView[] {
  return card.features.flatMap((found) => {
    const feature = featureOf(found.key);
    if (feature === undefined) return [];
    return [
      {
        key: feature.key,
        label: feature.label,
        purpose: feature.purpose,
        kind: feature.kind,
        provenance: found.provenance,
        how: found.corrected ? "corrected by your team" : PROVENANCE_LABELS[found.provenance],
        mark: PROVENANCE_MARKS[found.provenance],
      },
    ];
  });
}

/** The claims, always as the seller's words rather than ours. */
export const cardClaims = (card: BenchmarkCard): readonly string[] =>
  card.claims.filter((claim) => claim.value !== null).map((claim) => `“${claim.value as string}”, says the seller`);

/** The complaint themes, ranked, each one a short paraphrase of what reviewers said. */
export const cardThemes = (card: BenchmarkCard): readonly Readonly<{ theme: string; count: number }>[] =>
  [...card.complaintThemes].sort((a, b) => b.count - a.count || a.theme.localeCompare(b.theme));

export const THEMES_NOTE = "Complaint themes are our own short summaries of what reviewers said, not their words.";
