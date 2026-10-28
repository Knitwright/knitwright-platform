/**
 * The candidate models, cheapest first (plan step 12, task 2). Prices in US dollars per
 * million tokens, read from the vendors' pages on 2026-09-29 through a summarising tool.
 * Re-check each before relying on it. The live selection run that picks between them is
 * owed until provider keys exist (owner action A3); see docs/evals/README.md.
 */

export type ModelVendor = "anthropic" | "openai";

export interface ModelEntry {
  readonly id: string;
  readonly vendor: ModelVendor;
  readonly inputPerMillion: number;
  readonly outputPerMillion: number;
  /** False where the vendor refuses a forced tool choice (Claude Sonnet 5.5 and later). */
  readonly forcedTool: boolean;
}

export const MODEL_CATALOG = [
  { id: "gpt-5-nano", vendor: "openai", inputPerMillion: 0.05, outputPerMillion: 0.4, forcedTool: true },
  { id: "gpt-5.4-nano", vendor: "openai", inputPerMillion: 0.2, outputPerMillion: 1.25, forcedTool: true },
  { id: "gpt-5-mini", vendor: "openai", inputPerMillion: 0.25, outputPerMillion: 2, forcedTool: true },
  { id: "gpt-5.4-mini", vendor: "openai", inputPerMillion: 0.75, outputPerMillion: 4.5, forcedTool: true },
  // Anthropic says this model retires no sooner than 2026-10-15. Check before choosing it.
  { id: "claude-haiku-4-5", vendor: "anthropic", inputPerMillion: 1, outputPerMillion: 5, forcedTool: true },
  { id: "claude-sonnet-5-5", vendor: "anthropic", inputPerMillion: 2, outputPerMillion: 10, forcedTool: false },
] as const satisfies readonly ModelEntry[];

export type ModelId = (typeof MODEL_CATALOG)[number]["id"];

export const MODEL_IDS = MODEL_CATALOG.map((entry) => entry.id) as [ModelId, ...ModelId[]];

/** The defaults until the selection run says otherwise: the cheapest Claude, and a stronger one for the retry. */
export const DEFAULT_MODEL: ModelId = "claude-haiku-4-5";
export const DEFAULT_RETRY_MODEL: ModelId = "claude-sonnet-5-5";

export function modelEntry(id: ModelId): ModelEntry {
  const entry = MODEL_CATALOG.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Unknown model ${id}.`);
  return entry;
}

/** The fixed limit on every reply. A reply is a few hundred tokens; this caps a runaway one. */
export const MAX_OUTPUT_TOKENS = 1024;

/**
 * The most input tokens a text request can have: the instructions, the design and the
 * longest message allowed. A test holds every tops type under it, counted at three
 * characters a token, which errs high.
 */
export const MAX_TEXT_INPUT_TOKENS = 5000;

/** The most tokens one picture adds. Both vendors shrink large pictures below this. */
export const IMAGE_INPUT_TOKENS = 2000;

/** Tokens a text is counted as before a call, erring high: three characters a token. */
export const estimateTokens = (text: string): number => Math.ceil(text.length / 3);

/** The most a call can cost, in whole microdollars, at least 1. */
export function callCost(entry: ModelEntry, inputTokens: number, outputTokens: number = MAX_OUTPUT_TOKENS): number {
  // A price per million tokens in dollars is the same number as microdollars per token.
  return Math.max(1, Math.ceil(inputTokens * entry.inputPerMillion + outputTokens * entry.outputPerMillion));
}

/** What a call really cost, from the tokens the vendor reported. For evaluation records. */
export const spentMicrodollars = (entry: ModelEntry, usage: { inputTokens: number; outputTokens: number }): number =>
  callCost(entry, usage.inputTokens, usage.outputTokens);

/**
 * Image edit models (design import, W7d). The price is per picture, in whole microdollars, read from the
 * provider's published price: fal's page for `fal-ai/nano-banana-2/edit` lists $0.08 a picture at about 1K, recorded
 * in docs/data-processing.md on 2026-09-29. fal.ai could not be reached from the build container on 2026-10-14,
 * so it was not re-read: re-check it before relying on it. No vision price is stated here: it is the token price
 * of the text model chosen, from MODEL_CATALOG.
 */
interface ImageEditEntry {
  readonly id: string;
  readonly vendor: "fal";
  readonly microdollarsPerImage: number;
}

export const IMAGE_EDIT_CATALOG = [{ id: "fal-ai/nano-banana-2/edit", vendor: "fal", microdollarsPerImage: 80_000 }] as const satisfies readonly ImageEditEntry[];

/** The most one design import can cost: three vision calls and two image edits. */
export function designImportMaxCost(entry: ModelEntry): { vision: number; edits: number; total: number } {
  const vision = 3 * callCost(entry, MAX_TEXT_INPUT_TOKENS + IMAGE_INPUT_TOKENS, MAX_OUTPUT_TOKENS * 2);
  const edits = 2 * IMAGE_EDIT_CATALOG[0].microdollarsPerImage;
  return { vision, edits, total: vision + edits };
}
