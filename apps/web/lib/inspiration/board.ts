import { searchLinks } from "./sources/external";
import { isProvider, labelOf, type MaybeProvider } from "./sources/source";
import type { Board, ContextQuery, InspirationCard, SourceResult } from "./types";
import { CARD_SOURCES, SOURCE_BUDGET_MS, faultSentence, slowSentence, type CardSource } from "./vocabulary";

/**
 * The board: every source asked at once, shown in the order F-S1 lists them, inside the refresh budget (3 seconds,
 * F-S1 acceptance). A source that is switched off, slow or faulting gives a plain sentence and the rest of the board
 * is unaffected: a missing key degrades the feature, it never breaks it.
 */

export type BoardDeps = Readonly<{
  /** Every source, built or switched off. The order here does not matter: the board sorts by the spec's order. */
  sources: readonly MaybeProvider[];
  /** How long one source may take. Default `SOURCE_BUDGET_MS`, inside the 3-second budget. */
  sourceBudgetMs?: number;
  /** The clock, so the test can read the time the board took. */
  now?: () => number;
  /** A last pass over the cards of one source, such as moderation (X8). Default: the cards unchanged. */
  screen?: (cards: readonly InspirationCard[]) => Promise<readonly InspirationCard[]>;
}>;

const rank = (source: CardSource): number => CARD_SOURCES.indexOf(source);

/** Runs one promise against a deadline. The source's own signal is aborted, so nothing is left running. */
async function inTime<T>(work: (signal: AbortSignal) => Promise<T>, budgetMs: number): Promise<{ ok: true; value: T } | { ok: false; slow: boolean }> {
  const control = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<{ ok: false; slow: true }>((resolve) => {
    timer = setTimeout(() => {
      control.abort();
      resolve({ ok: false, slow: true });
    }, budgetMs);
  });
  try {
    const done = await Promise.race([work(control.signal).then((value) => ({ ok: true as const, value })), deadline]);
    return done;
  } catch {
    return { ok: false, slow: false };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function askOne(entry: MaybeProvider, query: ContextQuery, deps: BoardDeps): Promise<SourceResult> {
  const label = labelOf(entry.source);
  if (!isProvider(entry)) return { source: entry.source, label, cards: [], unavailable: entry.unavailable };
  const answer = await inTime((signal) => entry.search(query, signal), deps.sourceBudgetMs ?? SOURCE_BUDGET_MS);
  if (!answer.ok) return { source: entry.source, label, cards: [], unavailable: answer.slow ? slowSentence(label) : faultSentence(label) };
  const screened = deps.screen ? await deps.screen(answer.value) : answer.value;
  return { source: entry.source, label, cards: screened, unavailable: null };
}

/**
 * The whole board for one context query. Every source is asked at the same time, so the board takes as long as its
 * slowest source and no longer; a source over its own budget is dropped with a sentence.
 */
export async function buildBoard(query: ContextQuery, deps: BoardDeps): Promise<Board> {
  const clock = deps.now ?? Date.now;
  const started = clock();
  const results = await Promise.all(deps.sources.map((entry) => askOne(entry, query, deps)));
  const sources = [...results].sort((left, right) => rank(left.source) - rank(right.source));
  return { query, sources, searchLinks: searchLinks(query), tookMs: clock() - started };
}

/** Every card on the board, in the spec's source order. What the panel lays out, and what a save is checked against. */
export const cardsOf = (board: Board): readonly InspirationCard[] => board.sources.flatMap((entry) => entry.cards);

/** The card with that id, or null. A save only ever works from a card the board really showed. */
export const cardById = (board: Board, id: string): InspirationCard | null => cardsOf(board).find((entry) => entry.id === id) ?? null;
