import type { ContextQuery, InspirationCard } from "../types";
import type { CardSource } from "../vocabulary";
import { card, type CardProvider, type Fetch } from "./source";

/**
 * The deterministic stand-ins. Every source is an interface, and these are what the unit tests, the browser tests and
 * a local run without keys use: no test and no own run ever makes a third-party or paid call (plan rule).
 */

/** A source that answers with the cards it was given, and remembers what it was asked. */
export function stubProvider(source: CardSource, cards: readonly InspirationCard[]): CardProvider & { asked: ContextQuery[] } {
  const asked: ContextQuery[] = [];
  return {
    source,
    name: `stub-${source}`,
    asked,
    async search(query) {
      asked.push(query);
      return cards;
    },
  };
}

/** A source that never answers, to prove the refresh budget drops it and the board still comes back. */
export const silentProvider = (source: CardSource): CardProvider => ({
  source,
  name: `silent-${source}`,
  search: () =>
    new Promise((_resolve, reject) => {
      // Rejects only when the board gives up on it, so nothing is left running after a test.
      setTimeout(() => reject(new Error("The stub source never answers.")), 60_000).unref?.();
    }),
});

/** A source that faults, to prove the board says so and keeps the other sources. */
export const faultingProvider = (source: CardSource, message = "The stub source always faults."): CardProvider => ({
  source,
  name: `faulting-${source}`,
  search: async () => {
    throw new Error(message);
  },
});

/** One made-up card, enough for a board test. */
export const stubCard = (source: CardSource, id: string, parts: Partial<InspirationCard> = {}): InspirationCard => ({
  ...card(source, {
    id: `${source}:${id}`,
    title: `A ${source} card`,
    openUrl: `https://example.test/${source}/${id}`,
    previewUrl: `https://example.test/${source}/${id}.jpg`,
    owned: source === "knitwright-library",
    attribution: { creator: "A Maker", creatorUrl: null, provider: source, providerUrl: null, notice: `From ${source}` },
  }),
  ...parts,
});

/** A fetch that answers from a map of address to body, and faults for anything else. Never reaches the network. */
export function stubFetch(answers: Readonly<Record<string, unknown>>, status = 200, contentType = "application/json"): Fetch & { calls: string[] } {
  const calls: string[] = [];
  const fetcher = async (input: string): Promise<Response> => {
    calls.push(input);
    const key = Object.keys(answers).find((prefix) => input.startsWith(prefix));
    if (key === undefined) return new Response("not found", { status: 404, headers: { "content-type": "text/plain" } });
    const body = answers[key];
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": contentType } });
  };
  return Object.assign(fetcher, { calls });
}
