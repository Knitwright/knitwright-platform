import { randomUUID } from "node:crypto";
import { AppError } from "@/lib/server/core/errors";
import type { StoredCard } from "../compare";
import { MAX_CARDS } from "../schema";
import { storable, type BenchmarkDetail, type BenchmarkStore, type BenchmarkSummary, type FetchClaim, type NewCard, type Who } from "../store";

/**
 * The store, in memory, for the service's tests. It keeps the same promises the database keeps: one URL is fetched
 * once per brand, a comparison holds at most five cards, and nothing but a card goes in.
 */
export type MemoryStore = BenchmarkStore & {
  readonly fetches: Map<string, { host: string; outcome: string }>;
  readonly cards: Map<string, NewCard & { id: string; confirmedAt: string | null }>;
};

export function createMemoryStore(): MemoryStore {
  const benchmarks = new Map<string, { id: string; brandId: string; title: string; projectId: string | null; createdAt: string }>();
  const cards = new Map<string, NewCard & { id: string; confirmedAt: string | null }>();
  const fetches = new Map<string, { host: string; outcome: string }>();
  const toStored = (card: NewCard & { id: string; confirmedAt: string | null }): StoredCard => ({
    id: card.id,
    sourceKind: card.sourceKind,
    sourceUrl: card.sourceUrl,
    sourceHost: card.sourceHost,
    card: card.card,
    extractor: card.extractor,
    confirmedAt: card.confirmedAt,
  });
  return {
    fetches,
    cards,
    async create(who: Who, input) {
      const id = randomUUID();
      benchmarks.set(id, { id, brandId: who.brandId, title: input.title, projectId: input.projectId, createdAt: new Date().toISOString() });
      return id;
    },
    async claimFetch(who: Who, input): Promise<FetchClaim> {
      const key = `${who.brandId}:${input.urlKey}`;
      const held = fetches.get(key);
      // A page the brand tried and could not reach was never read, so it may be tried again, as the database allows.
      if (held !== undefined && held.outcome !== "failed") return "already";
      fetches.set(key, { host: input.host, outcome: "claimed" });
      return "ok";
    },
    async settleFetch(who: Who, input) {
      const key = `${who.brandId}:${input.urlKey}`;
      const found = fetches.get(key);
      if (found) fetches.set(key, { ...found, outcome: input.outcome });
    },
    async addCard(who: Who, card) {
      const mine = [...cards.values()].filter((held) => held.benchmarkId === card.benchmarkId);
      if (mine.length >= MAX_CARDS) throw new AppError("conflict", `A comparison holds ${MAX_CARDS} cards at most.`);
      const id = randomUUID();
      cards.set(id, { ...card, card: storable(card.card), id, confirmedAt: null });
      return id;
    },
    async confirmCard(_who: Who, input) {
      const found = cards.get(input.cardId);
      if (found === undefined) throw new AppError("not_found", "That benchmark could not be found.");
      cards.set(input.cardId, { ...found, card: storable(input.card), confirmedAt: new Date().toISOString() });
    },
    async removeCard(who: Who, cardId) {
      const found = cards.get(cardId);
      if (found === undefined || benchmarks.get(found.benchmarkId)?.brandId !== who.brandId) {
        throw new AppError("not_found", "That card could not be found.");
      }
      cards.delete(cardId);
    },
    async list(who: Who): Promise<readonly BenchmarkSummary[]> {
      return [...benchmarks.values()]
        .filter((held) => held.brandId === who.brandId)
        .map((held) => ({
          id: held.id,
          title: held.title,
          projectId: held.projectId,
          createdAt: held.createdAt,
          cards: [...cards.values()].filter((card) => card.benchmarkId === held.id).length,
        }));
    },
    async read(who: Who, benchmarkId): Promise<BenchmarkDetail | null> {
      const held = benchmarks.get(benchmarkId);
      if (held === undefined || held.brandId !== who.brandId) return null;
      return {
        id: held.id,
        title: held.title,
        projectId: held.projectId,
        createdAt: held.createdAt,
        cards: [...cards.values()].filter((card) => card.benchmarkId === benchmarkId).map(toStored),
      };
    },
  };
}
