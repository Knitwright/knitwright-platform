import type { Board, ContextQuery, ContextTag, InspirationCard, MoodboardItem, SearchLink } from "./types";
import type { Suggestion } from "./suggest/suggest";
import { AI_MOOD_LABEL, TAG_KIND_LABELS } from "./vocabulary";

/**
 * What the inspiration panel shows (decision 0082). Pure: the panel reads this and draws it, so every sentence the
 * panel can show is tested here rather than in a browser.
 */

export const TITLE = "Inspiration";
export const SUGGESTIONS_TITLE = "Suggestions";
export const MOODBOARD_TITLE = "Moodboard";
export const EMPTY_BOARD = "No inspiration yet. Add a tag, or switch a source on.";
export const EMPTY_MOODBOARD = "Nothing saved yet. Save a card to keep it with this design.";
export const NO_SUGGESTIONS = "No suggestion came out of that card for this base article.";
export const NEVER_ON_THE_GARMENT = "An inspiration picture never goes on the garment. A suggestion only changes colours, a pattern style or an option.";

/** One tag chip: the word, where it came from, and what pressing it does. */
export type TagChip = Readonly<{
  text: string;
  kindLabel: string;
  /** True when the person pinned it, so the chip shows it is kept whatever the design says. */
  pinned: boolean;
  /** What a screen reader says for the remove button. */
  removeLabel: string;
  pinLabel: string;
}>;

export const tagChip = (tag: ContextTag): TagChip => ({
  text: tag.text,
  kindLabel: TAG_KIND_LABELS[tag.kind],
  pinned: tag.kind === "pinned",
  removeLabel: `Remove the tag ${tag.text}`,
  pinLabel: `Pin the tag ${tag.text}`,
});

/** One card as the panel draws it. */
export type CardView = Readonly<{
  id: string;
  title: string;
  sourceLabel: string;
  openUrl: string;
  previewUrl: string;
  notice: string;
  /** The AI label, shown on the card itself, or null. */
  aiLabel: string | null;
  /** What a screen reader says for the link that opens the source. */
  openLabel: string;
  suggestLabel: string;
  /** Null when the card can be saved; the reason when it cannot. */
  unsaveable: string | null;
}>;

export const cardView = (card: InspirationCard): CardView => ({
  id: card.id,
  title: card.title,
  sourceLabel: card.sourceLabel,
  openUrl: card.openUrl,
  previewUrl: card.previewUrl,
  notice: card.attribution.notice,
  aiLabel: card.aiLabel ?? null,
  openLabel: `Open "${card.title}" on ${card.sourceLabel}`,
  suggestLabel: `Suggest from "${card.title}"`,
  unsaveable: card.unsaveable ?? null,
});

/** One source's part of the panel: its cards, or the one sentence that says why it shows nothing. */
export type SourceView = Readonly<{ label: string; cards: readonly CardView[]; unavailable: string | null }>;

export type BoardView = Readonly<{
  title: string;
  tags: readonly TagChip[];
  sources: readonly SourceView[];
  searchLinks: readonly SearchLink[];
  /** Said when every source came back with nothing. */
  empty: string | null;
  /** The sentences that say why a source shows nothing, gathered for a screen reader's summary. */
  notices: readonly string[];
}>;

export function boardView(board: Board): BoardView {
  const sources = board.sources.map(
    (entry): SourceView => ({ label: entry.label, cards: entry.cards.map(cardView), unavailable: entry.unavailable }),
  );
  const anyCard = sources.some((entry) => entry.cards.length > 0);
  return {
    title: TITLE,
    tags: board.query.tags.map(tagChip),
    sources,
    searchLinks: board.searchLinks,
    empty: anyCard ? null : EMPTY_BOARD,
    notices: sources.flatMap((entry) => (entry.unavailable === null ? [] : [entry.unavailable])),
  };
}

/** One suggestion as the panel draws it. */
export type SuggestionView = Readonly<{ id: string; line: string; warnings: readonly string[]; applyLabel: string; ruleId: string }>;

export const suggestionView = (suggestion: Suggestion): SuggestionView => ({
  id: suggestion.id,
  line: suggestion.line,
  warnings: suggestion.warnings,
  applyLabel: `Apply: ${suggestion.line}`,
  ruleId: suggestion.ruleId,
});

export type SuggestionsView = Readonly<{
  title: string;
  suggestions: readonly SuggestionView[];
  /** What the base article cannot do, said plainly, and what a check refused. */
  notPossible: readonly string[];
  empty: string | null;
  note: string;
}>;

export const suggestionsView = (made: Readonly<{ suggestions: readonly Suggestion[]; notPossible: readonly string[] }>): SuggestionsView => ({
  title: SUGGESTIONS_TITLE,
  suggestions: made.suggestions.map(suggestionView),
  notPossible: made.notPossible,
  empty: made.suggestions.length === 0 ? NO_SUGGESTIONS : null,
  note: NEVER_ON_THE_GARMENT,
});

export type MoodboardView = Readonly<{
  title: string;
  items: readonly Readonly<{ id: string; title: string; openUrl: string; previewUrl: string; notice: string; removeLabel: string }>[];
  empty: string | null;
}>;

export const moodboardView = (items: readonly MoodboardItem[]): MoodboardView => ({
  title: MOODBOARD_TITLE,
  items: items.map((item) => ({
    id: item.id,
    title: item.title,
    openUrl: item.openUrl,
    previewUrl: item.previewUrl,
    notice: item.attribution.notice,
    removeLabel: `Remove "${item.title}" from the moodboard`,
  })),
  empty: items.length === 0 ? EMPTY_MOODBOARD : null,
});

/** The words the panel shows about an AI mood image, in one place so the label never drifts. */
export const aiLabelOf = (query: ContextQuery): string => `${AI_MOOD_LABEL} from ${query.tags.length} tag${query.tags.length === 1 ? "" : "s"}`;
