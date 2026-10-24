import { extractColours } from "./colours";
import { findMentions } from "../mentions";
import type { Observation, Observer, Prediction } from "./schema";

/**
 * The deterministic path: the vocabulary matcher the product already runs before any model
 * (`findMentions`), with no model. It names an article only when the person's words include a
 * phrase from the registry's word lists, and it never names a nearest block, because nothing
 * in the vocabulary says which block is near.
 */
export function baselineReading(prompt: string): Pick<Observation, "prediction" | "colours"> {
  const named = findMentions(prompt)
    .filter((mention) => !mention.negated && mention.target.startsWith("type:"))
    .map((mention) => mention.target.slice("type:".length));
  const articles = named.filter((id, position) => named.indexOf(id) === position);
  const prediction: Prediction =
    articles.length === 1 ? { kind: "article", articleId: articles[0] } : articles.length > 1 ? { kind: "ambiguous", candidates: articles } : { kind: "decline" };
  return { prediction, colours: extractColours(prompt) };
}

/** The baseline as an observer: no model, so no cost, and the time is the matcher's own. */
export const baselineObserver: Observer = async (prompt) => {
  const started = performance.now();
  const reading = baselineReading(prompt);
  return { ...reading, latencyMs: performance.now() - started, costMicrodollars: 0 };
};
