import type { ModelId } from "./catalog";
import { createOpenAiProvider } from "./openai";
import { ModelCallError, type Fetch, type ModelRequest, type TextModelProvider } from "./text-model";

/**
 * The text models through fal's OpenRouter endpoint, which speaks OpenAI's chat API. Added on
 * 2026-10-13 as the fallback when a call to Anthropic or OpenAI fails (the owner's Anthropic
 * credit had run out). Tried live: tool calling works and the price matched Anthropic's own.
 * Designs then pass through fal and OpenRouter as well; see docs/data-processing.md.
 */

export const FAL_TEXT_URL = "https://fal.run/openrouter/router/openai/v1/chat/completions";

/** Our model id as OpenRouter names it: `claude-haiku-4-5` is `anthropic/claude-haiku-4.5`. */
export function falModelId(id: ModelId): string {
  return id.startsWith("claude-") ? `anthropic/${id.replace(/-(\d+)-(\d+)$/, "-$1.$2")}` : `openai/${id}`;
}

interface FalTextOptions {
  readonly apiKey: string;
  readonly model: ModelId;
  readonly forcedTool: boolean;
  readonly fetch?: Fetch;
}

export function createFalTextProvider({ apiKey, model, forcedTool, fetch }: FalTextOptions): TextModelProvider {
  return createOpenAiProvider({
    apiKey,
    model: falModelId(model),
    fetch,
    url: FAL_TEXT_URL,
    authorization: `Key ${apiKey}`,
    // fal keeps request and answer payloads for 30 days unless told not to.
    headers: { "x-fal-store-io": "0" },
    providerName: "fal",
    forcedTool,
  });
}

/**
 * Asks `first`, and `second` only when that call failed: no key credit, a refusal, a network
 * fault. A programming fault is not hidden, and nothing more is asked once the person has gone.
 */
export function withFallback(first: TextModelProvider, second: TextModelProvider): TextModelProvider {
  return {
    provider: `${first.provider}, then ${second.provider}`,
    model: first.model,
    async complete(request: ModelRequest) {
      try {
        return await first.complete(request);
      } catch (error) {
        if (!(error instanceof ModelCallError) || request.signal?.aborted) throw error;
        return second.complete(request);
      }
    },
  };
}
