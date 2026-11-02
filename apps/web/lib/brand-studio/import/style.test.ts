import { describe, expect, it, vi } from "vitest";
import { modelEntry } from "@/lib/providers/catalog";
import { ModelCallError, type ModelReply, type TextModelProvider } from "@/lib/providers/text-model";
import type { UsageMeter } from "@/lib/usage/meter";
import { STYLE_FIELDS } from "../words";
import {
  ALLOWANCE_USED_UP,
  EMPTY_STYLE,
  STYLE_SYSTEM,
  createModelStyleWriter,
  createScriptedStyleWriter,
  createStubStyleWriter,
  factOf,
  meteredStyleWriter,
  styleCostMicrodollars,
  styleFrom,
  userPrompt,
  type StyleInput,
} from "./style";
import type { PictureFacts } from "./types";

/**
 * The written visual style. No test here reaches a model: the stub is deterministic and the real
 * adapter is handed a provider written in this file. The model never draws anything — it answers
 * with three strings, and `never-draws.test.ts` proves nothing downstream turns them into pixels.
 */

const facts = (count: number): StyleInput["facts"] =>
  Array.from({ length: count }, (_, at) => ({ shape: `${100 + at} × 100 px`, colours: ["#0b1f4b", "#ffd100"], said: `Home shirt ${at + 1}` }));

const input = (count = 5): StyleInput => ({ brandName: "Ravensmoor Athletic", host: "ravensmoor.test", title: "Club shop", facts: facts(count) });

const picture = (): PictureFacts => ({
  url: "https://ravensmoor.test/media/shirt-1.png",
  why: "img-product",
  alt: "Home shirt",
  contentType: "image/png",
  widthPx: 800,
  heightPx: 1000,
  bytes: 90_000,
  swatches: [
    { hex: "#0b1f4b", share: 0.7 },
    { hex: "#ffd100", share: 0.2 },
    { hex: "#c8102e", share: 0.07 },
    { hex: "#ffffff", share: 0.03 },
  ],
});

describe("factOf", () => {
  it("tells the writer a picture's size, its three main colours and what the page called it", () => {
    expect(factOf(picture())).toEqual({ shape: "800 × 1000 px", colours: ["#0b1f4b", "#ffd100", "#c8102e"], said: "Home shirt" });
  });

  it("hands over no bytes, because the facts hold none", () => {
    expect(JSON.stringify(factOf(picture()))).not.toMatch(/base64|[A-Za-z0-9+/]{80}/);
  });
});

describe("the deterministic stub", () => {
  it("writes the same three texts from the same facts, every run", async () => {
    const writer = createStubStyleWriter();
    const once = await writer.write(input());
    const twice = await writer.write(input());
    expect(once).toEqual(twice);
    expect(Object.keys(once).sort()).toEqual([...STYLE_FIELDS].sort());
  });

  it("says what was read rather than making a claim about the brand", async () => {
    const written = await createStubStyleWriter().write(input(6));
    expect(written.setting).toContain("6 of your own pictures");
    expect(written.setting).toContain("ravensmoor.test");
    expect(written.rulesBoundaries).toContain("Nothing was assumed for you");
  });

  it("is named, so a reader knows what wrote the texts", () => {
    expect(createStubStyleWriter().name).toBe("stub");
  });
});

describe("styleFrom", () => {
  it("takes three strings and nothing else from a reply", () => {
    const written = styleFrom({ setting: "A wet pitch.", artDirection: "Long lens.", rulesBoundaries: "No sleeve sponsor.", image: "data:image/png;base64,AAA" });
    expect(written).toEqual({ setting: "A wet pitch.", artDirection: "Long lens.", rulesBoundaries: "No sleeve sponsor." });
    expect(Object.keys(written)).toHaveLength(3);
  });

  it("gives empty texts for a reply in any other shape", () => {
    expect(styleFrom(undefined)).toEqual(EMPTY_STYLE);
    expect(styleFrom("a paragraph")).toEqual(EMPTY_STYLE);
    expect(styleFrom({ setting: 7 })).toEqual(EMPTY_STYLE);
  });

  it("cuts a text to the limit the database holds, and drops control characters", () => {
    const written = styleFrom({ setting: `a\u0000b   c${"x".repeat(2000)}` });
    expect(written.setting.length).toBe(1000);
    expect(written.setting.startsWith("a b c")).toBe(true);
  });
});

describe("the real adapter", () => {
  const reply = (text: string): ModelReply => ({ text, model: "claude-haiku-4-5", usage: { inputTokens: 10, outputTokens: 10 } });

  const provider = (text: string): TextModelProvider & { seen: unknown[] } => {
    const seen: unknown[] = [];
    return { provider: "stub", model: "claude-haiku-4-5", seen, complete: async (request) => (seen.push(request), reply(text)) };
  };

  it("sends the fixed instructions and the facts, and parses the reply itself", async () => {
    const vendor = provider('{"setting":"A wet pitch.","artDirection":"Long lens.","rulesBoundaries":"No sleeve sponsor."}');
    const written = await createModelStyleWriter(vendor).write(input());
    expect(written.setting).toBe("A wet pitch.");
    expect(vendor.seen[0]).toMatchObject({ system: STYLE_SYSTEM, maxOutputTokens: 700 });
  });

  it("sends the one picture the shared provider interface takes, when it is given one", async () => {
    const vendor = provider("{}");
    await createModelStyleWriter(vendor).write({ ...input(), picture: { mediaType: "image/png", base64: "AAAA" } });
    expect(vendor.seen[0]).toMatchObject({ image: { mediaType: "image/png", base64: "AAAA" } });
  });

  it("reads a reply fenced in a code block", async () => {
    const vendor = provider('```json\n{"setting":"A wet pitch."}\n```');
    expect((await createModelStyleWriter(vendor).write(input())).setting).toBe("A wet pitch.");
  });

  it("gives empty texts rather than throwing when a reply is not JSON", async () => {
    expect(await createModelStyleWriter(provider("sorry, I cannot")).write(input())).toEqual(EMPTY_STYLE);
  });

  it("is named after the model, so the proposal records what wrote the texts", () => {
    expect(createModelStyleWriter(provider("{}")).name).toBe("claude-haiku-4-5");
  });

  it("asks only for words: the instructions forbid describing the garment at all", () => {
    expect(STYLE_SYSTEM).toContain("Answer with JSON only");
    expect(STYLE_SYSTEM).toMatch(/Never describe a garment's construction/);
    expect(STYLE_SYSTEM).not.toMatch(/draw|render|image of|generate a picture/i);
  });

  it("names every picture it was told about in the words it sends", () => {
    const prompt = userPrompt(input(5));
    expect(prompt).toContain("Pictures (5)");
    expect(prompt).toContain("Home shirt 5");
  });

  it("leaves out a title the page did not have", () => {
    expect(userPrompt({ ...input(), title: null })).not.toContain("Page title");
  });

  it("says a picture holds one colour when no colour could be read, and leaves out a name it has not got", () => {
    const prompt = userPrompt({ ...input(), facts: [{ shape: "64 × 64 px", colours: [], said: null }] });
    expect(prompt).toContain("mainly one colour");
    expect(prompt).not.toContain("called");
  });
});

describe("the scripted writer, for tests", () => {
  it("answers in order, repeats its last answer and throws what it was given", async () => {
    const writer = createScriptedStyleWriter([{ ...EMPTY_STYLE, setting: "one" }, new ModelCallError("no")]);
    expect((await writer.write(input())).setting).toBe("one");
    await expect(writer.write(input())).rejects.toThrow("no");
    await expect(writer.write(input())).rejects.toThrow("no");
    expect(writer.calls).toBe(3);
    expect(writer.seen).toHaveLength(3);
  });

  it("throws when it was given no answer at all", async () => {
    await expect(createScriptedStyleWriter([]).write(input())).rejects.toThrow("no answer");
  });
});

describe("metering", () => {
  const meter = (ok: boolean): UsageMeter & { refunds: string[] } => {
    const refunds: string[] = [];
    return {
      refunds,
      reserve: async () => (ok ? { ok: true, eventId: "e1" } : { ok: false, refused: "brand" }),
      refund: async (id) => (refunds.push(id), true),
    };
  };

  const who = { brandId: "b1", userId: "u1" };

  it("costs something, worked out from the model catalogue rather than guessed", () => {
    expect(styleCostMicrodollars(modelEntry("claude-haiku-4-5"))).toBeGreaterThan(0);
  });

  it("reserves against the person and the brand before the call", async () => {
    const usage = meter(true);
    const reserve = vi.spyOn(usage, "reserve");
    await meteredStyleWriter(createStubStyleWriter(), usage, who, 500, "brand-import").write(input());
    expect(reserve).toHaveBeenCalledWith({ userId: "u1", brandId: "b1", cost: { feature: "ai", microdollars: 500 }, route: "brand-import" });
  });

  it("refuses when the allowance is used up, and never calls the writer", async () => {
    const writer = createScriptedStyleWriter([EMPTY_STYLE]);
    await expect(meteredStyleWriter(writer, meter(false), who, 500, "brand-import").write(input())).rejects.toThrow(ALLOWANCE_USED_UP);
    expect(writer.calls).toBe(0);
  });

  it("gives the cost back when the call fails", async () => {
    const usage = meter(true);
    const writer = createScriptedStyleWriter([new ModelCallError("vendor down")]);
    await expect(meteredStyleWriter(writer, usage, who, 500, "brand-import").write(input())).rejects.toThrow("vendor down");
    expect(usage.refunds).toEqual(["e1"]);
  });

  it("still raises the call's own failure when the refund itself fails", async () => {
    const usage: UsageMeter = { reserve: async () => ({ ok: true, eventId: "e1" }), refund: async () => Promise.reject(new Error("meter down")) };
    const writer = createScriptedStyleWriter([new ModelCallError("vendor down")]);
    await expect(meteredStyleWriter(writer, usage, who, 500, "brand-import").write(input())).rejects.toThrow("vendor down");
  });

  it("keeps the writer's own name, so the proposal still records what wrote the texts", () => {
    expect(meteredStyleWriter(createStubStyleWriter(), meter(true), who, 1, "r").name).toBe("stub");
  });
});
