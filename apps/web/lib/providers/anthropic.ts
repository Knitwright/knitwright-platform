import { z } from "zod";
import { REPLY_TOOL_DESCRIPTION, REPLY_TOOL_NAME, replyToolSchema } from "@/lib/intent/reply-tool";
import { ModelCallError, type Fetch, type ModelReply, type ModelRequest, type TextModelProvider } from "./text-model";

/**
 * Claude through the Messages API, called with fetch (no SDK). Request shape read from
 * platform.claude.com on 2026-09-29: POST /v1/messages with `x-api-key` and
 * `anthropic-version: 2023-06-01`; a tool is `{ name, description, input_schema }`; the
 * answer holds `tool_use` blocks whose `input` is the tool's arguments. Claude Sonnet 5.5,
 * Opus 5.5 and Fable 5.1 refuse a forced tool choice, so for them the tool is offered with
 * `auto` and the instructions ask for it; a plain-text answer still goes to the parser.
 */

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";

const responseSchema = z.object({
  model: z.string(),
  content: z.array(
    z.union([
      z.object({ type: z.literal("tool_use"), name: z.string(), input: z.unknown() }),
      z.object({ type: z.literal("text"), text: z.string() }),
      z.object({ type: z.string() }),
    ]),
  ),
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number() }),
});

export interface AnthropicOptions {
  readonly apiKey: string;
  readonly model: string;
  /** False for the models that answer a forced tool choice with an error. */
  readonly forcedTool: boolean;
  readonly fetch?: Fetch;
}

export function anthropicBody(options: Pick<AnthropicOptions, "model" | "forcedTool">, request: ModelRequest) {
  const image = request.image
    ? [{ type: "image", source: { type: "base64", media_type: request.image.mediaType, data: request.image.base64 } }]
    : [];
  return {
    model: options.model,
    max_tokens: request.maxOutputTokens,
    // Cached where the prompt is long enough to qualify; ignored otherwise (plan cost rule 8).
    system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
    tools: [{ name: REPLY_TOOL_NAME, description: REPLY_TOOL_DESCRIPTION, input_schema: replyToolSchema() }],
    tool_choice: options.forcedTool ? { type: "tool", name: REPLY_TOOL_NAME } : { type: "auto" },
    messages: [{ role: "user", content: [...image, { type: "text", text: request.user }] }],
  };
}

/** The reply tool's input as JSON, or the answer's text when the tool was not used. */
export function anthropicReplyText(content: z.output<typeof responseSchema>["content"]): string {
  for (const block of content) {
    if (block.type === "tool_use" && "name" in block && block.name === REPLY_TOOL_NAME) {
      return JSON.stringify(block.input) ?? "";
    }
  }
  return content.flatMap((block) => (block.type === "text" && "text" in block ? [block.text] : [])).join("\n");
}

export function createAnthropicProvider(options: AnthropicOptions): TextModelProvider {
  const send = options.fetch ?? ((input, init) => fetch(input, init));
  return {
    provider: "anthropic",
    model: options.model,
    async complete(request: ModelRequest): Promise<ModelReply> {
      let response: Response;
      try {
        response = await send(ANTHROPIC_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": options.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
          },
          body: JSON.stringify(anthropicBody(options, request)),
          signal: request.signal,
        });
      } catch (error) {
        throw new ModelCallError("The model could not be reached.", null, { cause: error });
      }
      if (!response.ok) throw new ModelCallError(`The model answered with status ${response.status}.`, response.status);
      const parsed = responseSchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success) throw new ModelCallError("The model's answer was not in the expected form.");
      return {
        text: anthropicReplyText(parsed.data.content),
        model: parsed.data.model,
        usage: { inputTokens: parsed.data.usage.input_tokens, outputTokens: parsed.data.usage.output_tokens },
      };
    },
  };
}
