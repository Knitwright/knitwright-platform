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
 * Reading a design from a picture (plan W7d). The most one import may use: three vision reads and two image
 * edits. The edit price is fal's published price for `fal-ai/nano-banana-2/edit`, $0.08 an image, as recorded in
 * docs/data-processing.md on 2026-10-13: read it again before relying on it. The vision read is priced from the
 * model's per-token entry above, like any other picture reading.
 */
export const DESIGN_IMPORT_MAX_VISION_CALLS = 3;
export const DESIGN_IMPORT_MAX_IMAGE_EDITS = 2;
export const IMAGE_EDIT_MICRODOLLARS = 80_000;

/** The reply to a picture reading is a list of views, marks and guesses: longer than a chat reply. */
export const DESIGN_READ_OUTPUT_TOKENS = 2048;

/** The instructions, the reading tool's schema and the picture, counted high. */
export const DESIGN_READ_INPUT_TOKENS = 2500 + IMAGE_INPUT_TOKENS;

/** The most one import can cost: every read and every edit it is allowed, in whole microdollars. */
export function designImportCost(entry: ModelEntry, options: { readonly withEdits: boolean }): number {
  const reads = DESIGN_IMPORT_MAX_VISION_CALLS * callCost(entry, DESIGN_READ_INPUT_TOKENS, DESIGN_READ_OUTPUT_TOKENS);
  return reads + (options.withEdits ? DESIGN_IMPORT_MAX_IMAGE_EDITS * IMAGE_EDIT_MICRODOLLARS : 0);
}
