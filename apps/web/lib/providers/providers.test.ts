import { describe, expect, it } from "vitest";
import { REPLY_TOOL_NAME } from "@/lib/intent/reply-tool";
import { ANTHROPIC_URL, ANTHROPIC_VERSION, anthropicReplyText, createAnthropicProvider } from "./anthropic";
import { MODEL_CATALOG, callCost, estimateTokens, modelEntry, spentMicrodollars } from "./catalog";
import { OPENAI_URL, createOpenAiProvider } from "./openai";
import { chooseModels } from "./select";
import { createStubProvider } from "./stub";
import { ModelCallError, type Fetch, type ModelRequest } from "./text-model";

const REQUEST: ModelRequest = { system: "rules", user: "make it slim", maxOutputTokens: 1024 };
const IMAGE: ModelRequest = { ...REQUEST, image: { mediaType: "image/png", base64: "AAAA" } };

function recorder(answer: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch: Fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(answer), { status });
  };
  const body = (index = 0) => JSON.parse(String(calls[index].init.body)) as Record<string, unknown>;
  return { calls, fetch, body };
}

const claudeAnswer = (content: unknown[]) => ({
  model: "claude-haiku-4-5-20251001",
  content,
  usage: { input_tokens: 900, output_tokens: 60 },
});

describe("the Claude provider", () => {
  it("sends the key, the version, the reply tool, a fixed output limit and the design", async () => {
    const http = recorder(claudeAnswer([{ type: "tool_use", id: "t", name: REPLY_TOOL_NAME, input: { kind: "rejection", reason: "no" } }]));
    const provider = createAnthropicProvider({ apiKey: "key-1", model: "claude-haiku-4-5", forcedTool: true, fetch: http.fetch });
    const reply = await provider.complete(REQUEST);
    expect(http.calls[0].url).toBe(ANTHROPIC_URL);
    expect(http.calls[0].init.headers).toMatchObject({ "x-api-key": "key-1", "anthropic-version": ANTHROPIC_VERSION });
    const body = http.body();
    expect(body).toMatchObject({ model: "claude-haiku-4-5", max_tokens: 1024, tool_choice: { type: "tool", name: REPLY_TOOL_NAME } });
    expect(JSON.stringify(body.messages)).toContain("make it slim");
    expect(reply).toEqual({ text: '{"kind":"rejection","reason":"no"}', model: "claude-haiku-4-5-20251001", usage: { inputTokens: 900, outputTokens: 60 } });
  });

  it("offers the tool without forcing it to models that refuse a forced choice", async () => {
    const http = recorder(claudeAnswer([{ type: "text", text: "plain" }]));
    const provider = createAnthropicProvider({ apiKey: "k", model: "claude-sonnet-5-5", forcedTool: false, fetch: http.fetch });
    expect((await provider.complete(REQUEST)).text).toBe("plain");
    expect(http.body().tool_choice).toEqual({ type: "auto" });
  });

  it("sends a picture as a base64 image block before the text", async () => {
    const http = recorder(claudeAnswer([]));
    await createAnthropicProvider({ apiKey: "k", model: "m", forcedTool: true, fetch: http.fetch }).complete(IMAGE);
    const content = (http.body().messages as { content: { type: string; source?: unknown }[] }[])[0].content;
    expect(content[0]).toEqual({ type: "image", source: { type: "base64", media_type: "image/png", data: "AAAA" } });
    expect(content[1].type).toBe("text");
  });

  it("joins text when no reply tool was used, and ignores other tools and blocks", () => {
    expect(anthropicReplyText([{ type: "thinking" }, { type: "text", text: "a" }, { type: "tool_use", name: "other", input: {} }, { type: "text", text: "b" }])).toBe("a\nb");
  });

  it("fails with a model error on a refused request, a lost connection or an unreadable answer", async () => {
    const refused = createAnthropicProvider({ apiKey: "k", model: "m", forcedTool: true, fetch: recorder({}, 529).fetch });
    await expect(refused.complete(REQUEST)).rejects.toMatchObject({ name: "ModelCallError", status: 529 });
    const lost = createAnthropicProvider({ apiKey: "k", model: "m", forcedTool: true, fetch: async () => { throw new TypeError("offline"); } });
    await expect(lost.complete(REQUEST)).rejects.toBeInstanceOf(ModelCallError);
    const odd = createAnthropicProvider({ apiKey: "k", model: "m", forcedTool: true, fetch: recorder({ hello: 1 }).fetch });
    await expect(odd.complete(REQUEST)).rejects.toThrow(/expected form/);
  });
});

const gptAnswer = (message: unknown) => ({ model: "gpt-5-nano", choices: [{ message }], usage: { prompt_tokens: 800, completion_tokens: 40 } });

describe("the OpenAI provider", () => {
  it("forces the reply function and returns its arguments", async () => {
    const http = recorder(gptAnswer({ content: null, tool_calls: [{ function: { name: REPLY_TOOL_NAME, arguments: '{"kind":"changes"}' } }] }));
    const provider = createOpenAiProvider({ apiKey: "key-2", model: "gpt-5-nano", fetch: http.fetch });
    const reply = await provider.complete(IMAGE);
    expect(http.calls[0].url).toBe(OPENAI_URL);
    expect(http.calls[0].init.headers).toMatchObject({ authorization: "Bearer key-2" });
    expect(http.body()).toMatchObject({ max_completion_tokens: 1024, tool_choice: { type: "function", function: { name: REPLY_TOOL_NAME } } });
    expect(JSON.stringify(http.body().messages)).toContain("data:image/png;base64,AAAA");
    expect(reply).toEqual({ text: '{"kind":"changes"}', model: "gpt-5-nano", usage: { inputTokens: 800, outputTokens: 40 } });
  });

  it("falls back to the message text, or nothing", async () => {
    const text = createOpenAiProvider({ apiKey: "k", model: "m", fetch: recorder(gptAnswer({ content: "hi" })).fetch });
    expect((await text.complete(REQUEST)).text).toBe("hi");
    const empty = createOpenAiProvider({ apiKey: "k", model: "m", fetch: recorder(gptAnswer({})).fetch });
    expect((await empty.complete(REQUEST)).text).toBe("");
  });

  it("fails with a model error on a refused request, a lost connection or an unreadable answer", async () => {
    await expect(createOpenAiProvider({ apiKey: "k", model: "m", fetch: recorder({}, 401).fetch }).complete(REQUEST)).rejects.toMatchObject({ status: 401 });
    await expect(createOpenAiProvider({ apiKey: "k", model: "m", fetch: async () => { throw new Error("x"); } }).complete(REQUEST)).rejects.toBeInstanceOf(ModelCallError);
    await expect(createOpenAiProvider({ apiKey: "k", model: "m", fetch: recorder({ choices: [] }).fetch }).complete(REQUEST)).rejects.toThrow(/expected form/);
  });
});

describe("the catalog", () => {
  it("lists candidates from cheapest to dearest", () => {
    const prices = MODEL_CATALOG.map((entry) => callCost(entry, 3000, 300));
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("prices a call in whole microdollars, never below one", () => {
    const haiku = modelEntry("claude-haiku-4-5");
    expect(callCost(haiku, 1000, 100)).toBe(1500);
    expect(callCost(modelEntry("gpt-5-nano"), 0, 0)).toBe(1);
    expect(spentMicrodollars(haiku, { inputTokens: 2000, outputTokens: 0 })).toBe(2000);
    expect(estimateTokens("abcdef")).toBe(2);
  });

  it("refuses a model it does not list", () => {
    expect(() => modelEntry("nope" as never)).toThrow(/Unknown model/);
  });
});

describe("choosing models", () => {
  const base = { INTENT_MODEL: "claude-haiku-4-5", INTENT_RETRY_MODEL: "claude-sonnet-5-5" } as const;

  it("has nothing without a key, so the assistant is shown as not available", () => {
    expect(chooseModels(base)).toEqual({ primary: null, retry: null });
  });

  it("uses each vendor only when its key is set", () => {
    const both = chooseModels({ ...base, ANTHROPIC_API_KEY: "a" });
    expect(both.primary?.provider.model).toBe("claude-haiku-4-5");
    expect(both.retry?.provider.model).toBe("claude-sonnet-5-5");
    const mixed = chooseModels({ INTENT_MODEL: "gpt-5-nano", INTENT_RETRY_MODEL: "claude-sonnet-5-5", OPENAI_API_KEY: "o" });
    expect(mixed.primary?.provider.provider).toBe("openai");
    expect(mixed.retry).toBeNull();
  });

  it("does not retry on the same model", () => {
    expect(chooseModels({ ...base, INTENT_RETRY_MODEL: "claude-haiku-4-5", ANTHROPIC_API_KEY: "a" }).retry).toBeNull();
  });
});

describe("the stub provider", () => {
  it("answers from its script, records requests, and runs out", async () => {
    const stub = createStubProvider(["one", (request) => request.user.toUpperCase(), new ModelCallError("down")]);
    expect((await stub.complete(REQUEST)).text).toBe("one");
    expect((await stub.complete(REQUEST)).text).toBe("MAKE IT SLIM");
    await expect(stub.complete(REQUEST)).rejects.toThrow("down");
    await expect(stub.complete(REQUEST)).rejects.toThrow(/no more/);
    expect(stub.requests).toHaveLength(4);
  });
});

describe("a reply tool of the caller's own", () => {
  const tool = { name: "describe_picture", description: "Describe a picture.", inputSchema: { type: "object", properties: {} } };
  const custom: ModelRequest = { ...REQUEST, replyTool: tool };

  it("is offered to Claude in place of the garment tool, and its input is the reply", async () => {
    const http = recorder(claudeAnswer([{ type: "tool_use", id: "t", name: "describe_picture", input: { kind: "flat" } }]));
    const provider = createAnthropicProvider({ apiKey: "k", model: "claude-haiku-4-5", forcedTool: true, fetch: http.fetch });
    expect((await provider.complete(custom)).text).toBe('{"kind":"flat"}');
    expect(http.body()).toMatchObject({ tools: [{ name: "describe_picture", input_schema: tool.inputSchema }], tool_choice: { type: "tool", name: "describe_picture" } });
  });

  it("is offered to OpenAI in place of the garment function", async () => {
    const http = recorder(gptAnswer({ content: null, tool_calls: [{ function: { name: "describe_picture", arguments: '{"kind":"flat"}' } }] }));
    const provider = createOpenAiProvider({ apiKey: "k", model: "gpt-5-nano", fetch: http.fetch });
    expect((await provider.complete(custom)).text).toBe('{"kind":"flat"}');
    expect(http.body()).toMatchObject({ tool_choice: { type: "function", function: { name: "describe_picture" } } });
  });
});

describe("the cost of reading a design from a picture", () => {
  it("is every read plus, when a clean-up is wired, every edit", async () => {
    const { designImportCost, IMAGE_EDIT_MICRODOLLARS, DESIGN_IMPORT_MAX_IMAGE_EDITS } = await import("./catalog");
    const entry = modelEntry("claude-haiku-4-5");
    const without = designImportCost(entry, { withEdits: false });
    expect(without).toBeGreaterThan(0);
    expect(designImportCost(entry, { withEdits: true })).toBe(without + DESIGN_IMPORT_MAX_IMAGE_EDITS * IMAGE_EDIT_MICRODOLLARS);
  });
});
