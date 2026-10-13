import { createAnthropicProvider } from "./anthropic";
import { createFalTextProvider, withFallback } from "./fal-text";
import { modelEntry, type ModelEntry, type ModelId } from "./catalog";
import { createOpenAiProvider } from "./openai";
import type { Fetch, TextModelProvider } from "./text-model";

/** A provider with the price list it is charged at. */
export interface PricedProvider {
  readonly provider: TextModelProvider;
  readonly entry: ModelEntry;
}

export interface ModelChoice {
  /** Null when the key for the chosen model is not set: the assistant is not available. */
  readonly primary: PricedProvider | null;
  /** The stronger model tried once before a question is asked. Null when its key is not set. */
  readonly retry: PricedProvider | null;
}

export interface ModelSettings {
  readonly ANTHROPIC_API_KEY?: string;
  readonly OPENAI_API_KEY?: string;
  /** With it, a failed call to Anthropic or OpenAI is tried once more through fal. */
  readonly FAL_KEY?: string;
  readonly INTENT_MODEL: ModelId;
  readonly INTENT_RETRY_MODEL: ModelId;
}

function direct(id: ModelId, settings: ModelSettings, fetch?: Fetch): TextModelProvider | null {
  const entry = modelEntry(id);
  if (entry.vendor === "anthropic") {
    const apiKey = settings.ANTHROPIC_API_KEY;
    return apiKey ? createAnthropicProvider({ apiKey, model: id, forcedTool: entry.forcedTool, fetch }) : null;
  }
  const apiKey = settings.OPENAI_API_KEY;
  return apiKey ? createOpenAiProvider({ apiKey, model: id, fetch }) : null;
}

/**
 * The model from its own vendor, falling back to the same model through fal when a fal key is
 * set (owner's choice, 2026-10-13). fal charges the vendor's price, so the entry is the same.
 */
function priced(id: ModelId, settings: ModelSettings, fetch?: Fetch): PricedProvider | null {
  const entry = modelEntry(id);
  const own = direct(id, settings, fetch);
  const viaFal = settings.FAL_KEY ? createFalTextProvider({ apiKey: settings.FAL_KEY, model: id, forcedTool: entry.forcedTool, fetch }) : null;
  const provider = own && viaFal ? withFallback(own, viaFal) : (own ?? viaFal);
  return provider ? { entry, provider } : null;
}

/**
 * The models configured for the assistant, each only when its key is set. A retry on the
 * same model as the first call is no retry at all, so it is left out.
 */
export function chooseModels(settings: ModelSettings, fetch?: Fetch): ModelChoice {
  const primary = priced(settings.INTENT_MODEL, settings, fetch);
  const retry = settings.INTENT_RETRY_MODEL === settings.INTENT_MODEL ? null : priced(settings.INTENT_RETRY_MODEL, settings, fetch);
  return { primary, retry: primary ? retry : null };
}
