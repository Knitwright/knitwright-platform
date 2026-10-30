import { describe, expect, it, vi } from "vitest";
import { buildBoard, cardById, cardsOf } from "./board";
import { faultingProvider, silentProvider, stubCard, stubProvider } from "./sources/stubs";
import type { ContextQuery } from "./types";
import { CARD_SOURCES, REFRESH_BUDGET_MS, faultSentence, noKeySentence, slowSentence } from "./vocabulary";

/**
 * The board (spec F-S1): the sources in the spec's order, each labelled, inside the refresh budget. A source whose
 * key is absent, which is slow, or which faults gives one plain sentence and the rest of the board is unaffected.
 */

const query: ContextQuery = { tags: [{ text: "rugby", kind: "sport" }], text: "rugby", removed: [] };

describe("the order of the board", () => {
  it("shows the sources in the order F-S1 lists them, whatever order they were built in", async () => {
    const sources = [...CARD_SOURCES].reverse().map((source) => stubProvider(source, [stubCard(source, "1")]));
    const board = await buildBoard(query, { sources });
    expect(board.sources.map((entry) => entry.source)).toEqual([...CARD_SOURCES]);
    expect(board.sources.map((entry) => entry.label)).toEqual([
      "Knitwright library",
      "Your Pinterest board",
      "Unsplash",
      "Pexels",
      "Product link",
      "AI mood image",
    ]);
  });

  it("asks every source the same query, and gathers their cards in source order", async () => {
    const library = stubProvider("knitwright-library", [stubCard("knitwright-library", "a")]);
    const unsplash = stubProvider("unsplash", [stubCard("unsplash", "b")]);
    const board = await buildBoard(query, { sources: [unsplash, library] });
    expect(library.asked).toEqual([query]);
    expect(unsplash.asked).toEqual([query]);
    expect(cardsOf(board).map((card) => card.id)).toEqual(["knitwright-library:a", "unsplash:b"]);
  });

  it("offers the Behance and Pinterest search buttons with the query in them", async () => {
    const board = await buildBoard(query, { sources: [] });
    expect(board.searchLinks).toEqual([
      { site: "behance", label: "Search on Behance", url: "https://www.behance.net/search/projects?search=rugby" },
      { site: "pinterest", label: "Search on Pinterest", url: "https://www.pinterest.com/search/pins/?q=rugby" },
    ]);
  });
});

describe("a source that cannot answer", () => {
  it("says so in one sentence when its key is not set, and the others still answer", async () => {
    const off = { source: "unsplash" as const, unavailable: noKeySentence("Unsplash", "UNSPLASH_ACCESS_KEY") };
    const board = await buildBoard(query, { sources: [off, stubProvider("pexels", [stubCard("pexels", "1")])] });
    expect(board.sources[0]).toEqual({
      source: "unsplash",
      label: "Unsplash",
      cards: [],
      unavailable: "Unsplash is not switched on here, so it shows nothing. Knitwright needs UNSPLASH_ACCESS_KEY for it.",
    });
    expect(board.sources[1]?.cards).toHaveLength(1);
  });

  it("says so when it faults, and the board still comes back", async () => {
    const board = await buildBoard(query, { sources: [faultingProvider("pexels"), stubProvider("unsplash", [stubCard("unsplash", "1")])] });
    expect(board.sources.find((entry) => entry.source === "pexels")?.unavailable).toBe(faultSentence("Pexels"));
    expect(board.sources.find((entry) => entry.source === "unsplash")?.cards).toHaveLength(1);
  });

  it("is dropped when it is slower than its share of the refresh budget", async () => {
    vi.useFakeTimers();
    try {
      const board = buildBoard(query, { sources: [silentProvider("pexels"), stubProvider("unsplash", [stubCard("unsplash", "1")])], sourceBudgetMs: 2_000 });
      await vi.advanceTimersByTimeAsync(2_001);
      const built = await board;
      expect(built.sources.find((entry) => entry.source === "pexels")?.unavailable).toBe(slowSentence("Pexels"));
      expect(built.sources.find((entry) => entry.source === "unsplash")?.cards).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("the refresh budget", () => {
  it("takes as long as the slowest source and no longer, which is inside the three seconds F-S1 asks for", async () => {
    vi.useFakeTimers();
    try {
      let clock = 0;
      const board = buildBoard(query, {
        sources: [silentProvider("pexels"), silentProvider("unsplash"), stubProvider("knitwright-library", [stubCard("knitwright-library", "1")])],
        sourceBudgetMs: 2_000,
        now: () => clock,
      });
      clock = 2_000;
      await vi.advanceTimersByTimeAsync(2_001);
      const built = await board;
      expect(built.tookMs).toBeLessThan(REFRESH_BUDGET_MS);
      expect(cardsOf(built)).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts the source it gave up on, so nothing is left running", async () => {
    vi.useFakeTimers();
    try {
      const signals: AbortSignal[] = [];
      const slow = {
        source: "pexels" as const,
        name: "slow",
        search: (_query: ContextQuery, signal?: AbortSignal) => {
          if (signal) signals.push(signal);
          return new Promise<never>(() => {});
        },
      };
      const board = buildBoard(query, { sources: [slow], sourceBudgetMs: 500 });
      await vi.advanceTimersByTimeAsync(501);
      await board;
      expect(signals[0]?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("the cards the board showed", () => {
  it("finds one by its id, and finds nothing for an id it never showed", async () => {
    const board = await buildBoard(query, { sources: [stubProvider("unsplash", [stubCard("unsplash", "1")])] });
    expect(cardById(board, "unsplash:1")?.title).toBe("A unsplash card");
    expect(cardById(board, "unsplash:made-up")).toBeNull();
  });

  it("hands each source's cards to the screen, so moderation can hold one back", async () => {
    const board = await buildBoard(query, {
      sources: [stubProvider("unsplash", [stubCard("unsplash", "1"), stubCard("unsplash", "2")])],
      screen: async (cards) => cards.filter((card) => card.id !== "unsplash:2"),
    });
    expect(cardsOf(board).map((card) => card.id)).toEqual(["unsplash:1"]);
  });
});
