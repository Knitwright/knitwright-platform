import { cardFields, PROVENANCE_MARKS, type FieldView } from "./card";
import { MAX_CARDS, MIN_COMPARE, type BenchmarkCard } from "./schema";
import { featureOf, type Provenance, type SourceKind } from "./vocabulary";

/** A card as it comes back from the database, with the card itself already parsed. */
export type StoredCard = Readonly<{
  id: string;
  sourceKind: SourceKind;
  sourceUrl: string | null;
  sourceHost: string | null;
  card: BenchmarkCard;
  extractor: string;
  confirmedAt: string | null;
}>;

/**
 * The compare view (spec F-S2 step 5): 2 to 5 cards side by side, a feature matrix and complaint themes ranked by how
 * often they came up. Logos, brand names and prints are not compared, because nothing about them may be carried over.
 */

export const TOO_FEW = `Add at least ${MIN_COMPARE} cards to compare them.`;
export const TOO_MANY = `A comparison holds ${MAX_CARDS} cards at most.`;
export const GRAPHICS_NOTE = "Logos, brand names and prints are left out: they are never compared and never carried onto a design.";

export type CompareColumn = Readonly<{ id: string; heading: string; fields: readonly FieldView[]; source: string; confirmed: boolean }>;
export type MatrixCell = Readonly<{ mark: string; provenance: Provenance | null }>;
export type MatrixRow = Readonly<{ key: string; label: string; purpose: string; cells: readonly MatrixCell[] }>;
export type ThemeRow = Readonly<{ theme: string; count: number; cards: number }>;

export type CompareView = Readonly<{
  columns: readonly CompareColumn[];
  rows: readonly MatrixRow[];
  themes: readonly ThemeRow[];
  refused: string | null;
}>;

const sourceLine = (card: StoredCard): string =>
  card.sourceKind === "url" ? `From ${card.sourceHost ?? "a page"}` : card.sourceKind === "photo" ? "From your own photo" : "From review text you pasted";

const columnOf = (card: StoredCard): CompareColumn => {
  const fields = cardFields(card.card);
  return {
    id: card.id,
    heading: card.card.productName.value ?? "Not named",
    fields,
    source: sourceLine(card),
    confirmed: card.confirmedAt !== null,
  };
};

/** Every comparable feature any card shows, functional first, in taxonomy order. */
const rowsOf = (cards: readonly StoredCard[]): readonly MatrixRow[] => {
  const found = new Map<string, Map<string, Provenance>>();
  for (const stored of cards) {
    for (const feature of stored.card.features) {
      if (featureOf(feature.key)?.kind === "graphic") continue;
      const byCard = found.get(feature.key) ?? new Map<string, Provenance>();
      byCard.set(stored.id, feature.provenance);
      found.set(feature.key, byCard);
    }
  }
  return [...found]
    .flatMap(([key, byCard]) => {
      const feature = featureOf(key);
      if (feature === undefined) return [];
      const cells = cards.map((stored) => {
        const provenance = byCard.get(stored.id);
        return provenance === undefined ? { mark: PROVENANCE_MARKS.unknown, provenance: null } : { mark: PROVENANCE_MARKS[provenance], provenance };
      });
      return [{ key, label: feature.label, purpose: feature.purpose, cells, kind: feature.kind }];
    })
    .sort((a, b) => (a.kind === b.kind ? a.label.localeCompare(b.label) : a.kind === "functional" ? -1 : 1))
    .map(({ key, label, purpose, cells }) => ({ key, label, purpose, cells }));
};

/** The same theme from two cards is one row, with the counts added, ranked by how often it came up. */
const themesOf = (cards: readonly StoredCard[]): readonly ThemeRow[] => {
  const totals = new Map<string, { theme: string; count: number; cards: number }>();
  for (const stored of cards) {
    for (const theme of stored.card.complaintThemes) {
      const key = theme.theme.toLowerCase();
      const row = totals.get(key) ?? { theme: theme.theme, count: 0, cards: 0 };
      totals.set(key, { theme: row.theme, count: row.count + theme.count, cards: row.cards + 1 });
    }
  }
  return [...totals.values()].sort((a, b) => b.count - a.count || a.theme.localeCompare(b.theme));
};

export function compareView(cards: readonly StoredCard[]): CompareView {
  const refused = cards.length < MIN_COMPARE ? TOO_FEW : cards.length > MAX_CARDS ? TOO_MANY : null;
  const shown = refused === null ? cards : cards.slice(0, MAX_CARDS);
  return {
    columns: shown.map(columnOf),
    rows: refused === TOO_FEW ? [] : rowsOf(shown),
    themes: refused === TOO_FEW ? [] : themesOf(shown),
    refused,
  };
}
