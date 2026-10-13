import { z } from "zod";
import { REPLY_TOOL_DESCRIPTION, REPLY_TOOL_NAME, replyToolSchema } from "@/lib/intent/reply-tool";
import { ModelCallError, type Fetch, type ModelReply, type ModelRequest, type TextModelProvider } from "./text-model";

/**
 * OpenAI through the Chat Completions API, called with fetch (no SDK). The second
 * candidate provider. The reply tool is a function the model is told to call; its
 * `arguments` string is the reply. Not tried live: no key exists yet (owner action A3).
 */

export const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const responseSchema = z.object({
  model: z.string(),
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
          tool_calls: z
            .array(z.object({ function: z.object({ name: z.string(), arguments: z.string() }) }))
            .optional(),
        }),
      }),
    )
    .min(1),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }),
});

export interface OpenAiOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly fetch?: Fetch;
  /**
   * For another service that speaks the same API (fal, lib/providers/fal-text.ts): its address,
   * the whole authorization header, any extra headers and the name it is logged under.
   */
  readonly url?: string;
  readonly authorization?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly providerName?: string;
  /** False where the model refuses a forced tool choice: it is then left to choose the tool. */
  readonly forcedTool?: boolean;
}

export function openAiBody(model: string, request: ModelRequest, forcedTool = true) {
  const image = request.image
    ? [{ type: "image_url", image_url: { url: `data:${request.image.mediaType};base64,${request.image.base64}` } }]
    : [];
  return {
    model,
    // Includes any reasoning the model does, so the limit holds for the whole reply.
    max_completion_tokens: request.maxOutputTokens,
    messages: [
      { role: "system", content: request.system },
      { role: "user", content: [...image, { type: "text", text: request.user }] },
    ],
    tools: [
      {
        type: "function",
        function: { name: REPLY_TOOL_NAME, description: REPLY_TOOL_DESCRIPTION, parameters: replyToolSchema() },
      },
    ],
    tool_choice: forcedTool ? { type: "function", function: { name: REPLY_TOOL_NAME } } : "auto",
  };
}

export function createOpenAiProvider(options: OpenAiOptions): TextModelProvider {
  const send = options.fetch ?? ((input, init) => fetch(input, init));
  return {
    provider: options.providerName ?? "openai",
    model: options.model,
    async complete(request: ModelRequest): Promise<ModelReply> {
      let response: Response;
      try {
        response = await send(options.url ?? OPENAI_URL, {
          method: "POST",
          headers: {
            ...options.headers,
            "content-type": "application/json",
            authorization: options.authorization ?? `Bearer ${options.apiKey}`,
          },
          body: JSON.stringify(openAiBody(options.model, request, options.forcedTool ?? true)),
          signal: request.signal,
        });
      } catch (error) {
        throw new ModelCallError("The model could not be reached.", null, { cause: error });
      }
      if (!response.ok) throw new ModelCallError(`The model answered with status ${response.status}.`, response.status);
      const parsed = responseSchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success) throw new ModelCallError("The model's answer was not in the expected form.");
      const message = parsed.data.choices[0].message;
      const call = message.tool_calls?.find((entry) => entry.function.name === REPLY_TOOL_NAME);
      return {
        text: call ? call.function.arguments : (message.content ?? ""),
        model: parsed.data.model,
        usage: { inputTokens: parsed.data.usage.prompt_tokens, outputTokens: parsed.data.usage.completion_tokens },
      };
    },
  };
}
