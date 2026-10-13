import { describe, expect, it, vi } from "vitest";
import { FAL_TEXT_URL, createFalTextProvider, falModelId, withFallback } from "./fal-text";
import { chooseModels } from "./select";
import { ModelCallError, type ModelReply, type TextModelProvider } from "./text-model";

const REQUEST = { system: "s", user: "u", maxOutputTokens: 100 };

const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const toolReply = {
  model: "anthropic/claude-haiku-4.5",
  choices: [{ message: { content: null, tool_calls: [{ function: { name: "reply", arguments: '{"a":1}' } }] } }],
  usage: { prompt_tokens: 661, completion_tokens: 150 },
};

const call = (fetcher: ReturnType<typeof vi.fn>, index = 0) => fetcher.mock.calls[index] as unknown as [string, RequestInit];

describe("falModelId", () => {
  it("writes our model ids the way OpenRouter names them", () => {
    expect(falModelId("claude-haiku-4-5")).toBe("anthropic/claude-haiku-4.5");
    expect(falModelId("claude-sonnet-5-5")).toBe("anthropic/claude-sonnet-5.5");
    expect(falModelId("gpt-5.4-mini")).toBe("openai/gpt-5.4-mini");
  });
});

describe("createFalTextProvider", () => {
  it("calls fal's chat endpoint with the fal key, asks it to keep nothing, and names the model", async () => {
    const fetcher = vi.fn(async () => answer(toolReply));
    const provider = createFalTextProvider({ apiKey: "fal-secret", model: "claude-haiku-4-5", forcedTool: true, fetch: fetcher });

    const reply = await provider.complete(REQUEST);

    const [url, init] = call(fetcher);
    expect(url).toBe(FAL_TEXT_URL);
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Key fal-secret");
    expect(headers.get("x-fal-store-io")).toBe("0");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("anthropic/claude-haiku-4.5");
    expect(body.tool_choice).toEqual({ type: "function", function: { name: "reply" } });
    expect(reply).toEqual({ text: '{"a":1}', model: "anthropic/claude-haiku-4.5", usage: { inputTokens: 661, outputTokens: 150 } });
    expect(provider.provider).toBe("fal");
  });

  it("lets a model that refuses a forced tool choose the tool itself", async () => {
    const fetcher = vi.fn(async () => answer(toolReply));

    await createFalTextProvider({ apiKey: "k", model: "claude-sonnet-5-5", forcedTool: false, fetch: fetcher }).complete(REQUEST);

    expect(JSON.parse(String(call(fetcher)[1].body)).tool_choice).toBe("auto");
  });

  it("fails with the status when fal refuses", async () => {
    const provider = createFalTextProvider({ apiKey: "k", model: "claude-haiku-4-5", forcedTool: true, fetch: async () => answer({}, 401) });

    await expect(provider.complete(REQUEST)).rejects.toMatchObject({ status: 401 });
  });
});

const fixed = (name: string, result: ModelReply | Error): TextModelProvider & { calls: number } => {
  const provider = {
    provider: name,
    model: `${name}-model`,
    calls: 0,
    async complete() {
      provider.calls += 1;
      if (result instanceof Error) throw result;
      return result;
    },
  };
  return provider;
};

const REPLY: ModelReply = { text: "{}", model: "m", usage: { inputTokens: 1, outputTokens: 1 } };

describe("withFallback", () => {
  it("uses the first provider when it answers", async () => {
    const first = fixed("anthropic", REPLY);
    const second = fixed("fal", REPLY);

    await withFallback(first, second).complete(REQUEST);

    expect([first.calls, second.calls]).toEqual([1, 0]);
  });

  it("asks the second when the first fails, for example when its credit has run out", async () => {
    const first = fixed("anthropic", new ModelCallError("The model answered with status 400.", 400));
    const second = fixed("fal", { ...REPLY, model: "via-fal" });

    const reply = await withFallback(first, second).complete(REQUEST);

    expect(reply.model).toBe("via-fal");
    expect(second.calls).toBe(1);
  });

  it("does not hide a fault that is not a failed call", async () => {
    const first = fixed("anthropic", new TypeError("bug"));
    const second = fixed("fal", REPLY);

    await expect(withFallback(first, second).complete(REQUEST)).rejects.toBeInstanceOf(TypeError);
    expect(second.calls).toBe(0);
  });

  it("does not ask again once the person has given up", async () => {
    const controller = new AbortController();
    controller.abort();
    const first = fixed("anthropic", new ModelCallError("The model could not be reached."));
    const second = fixed("fal", REPLY);

    await expect(withFallback(first, second).complete({ ...REQUEST, signal: controller.signal })).rejects.toBeInstanceOf(ModelCallError);
    expect(second.calls).toBe(0);
  });

  it("names both providers", () => {
    const both = withFallback(fixed("anthropic", REPLY), fixed("fal", REPLY));
    expect(both.provider).toBe("anthropic, then fal");
    expect(both.model).toBe("anthropic-model");
  });
});

describe("chooseModels with a fal key", () => {
  const base = { INTENT_MODEL: "claude-haiku-4-5", INTENT_RETRY_MODEL: "claude-sonnet-5-5" } as const;

  it("falls back to fal behind Anthropic for both the first try and the retry", () => {
    const choice = chooseModels({ ...base, ANTHROPIC_API_KEY: "a", FAL_KEY: "f" });
    expect(choice.primary?.provider.provider).toBe("anthropic, then fal");
    expect(choice.retry?.provider.provider).toBe("anthropic, then fal");
  });

  it("uses fal alone when it is the only key", () => {
    const choice = chooseModels({ ...base, FAL_KEY: "f" });
    expect(choice.primary?.provider.provider).toBe("fal");
    expect(choice.primary?.entry.id).toBe("claude-haiku-4-5");
  });

  it("is unchanged without a fal key", () => {
    expect(chooseModels({ ...base, ANTHROPIC_API_KEY: "a" }).primary?.provider.provider).toBe("anthropic");
  });
});
