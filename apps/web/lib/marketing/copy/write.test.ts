import { describe, expect, it } from "vitest";
import { ModelCallError } from "@/lib/providers/text-model";
import { createStubProvider } from "@/lib/providers/stub";
import { slot } from "../templates/types";
import { NOTHING_USABLE, NOT_TEXT, OPTION_COUNT, readOptions, writeForMe, writePrompt, type WriteRequest } from "./write";
import { NO_VOICE_NOTE, voiceTagsOf, voiceWords, hasVoice, stubVoiceSource, type BrandVoice } from "./voice";

const VOICE: BrandVoice = {
  brandId: "brand-1",
  name: "Harrow Town FC",
  tags: ["bold", "community"],
  about: "A grassroots club in north London.",
  styles: { headline: "Headline style", subheadline: "Subheadline style", body: "Body style" },
};

const headline = slot({ id: "headline", kind: "text", label: "Headline", rect: { x: 0.06, y: 0.6, width: 0.88, height: 0.1 }, style: "headline", limit: 40 });

const request = (over: Partial<WriteRequest> = {}): WriteRequest => ({
  slot: headline,
  highlight: "Pre-orders close Friday",
  campaign: "pre-order",
  voice: VOICE,
  ...over,
});

const reply = (...options: string[]) => JSON.stringify({ options });

describe("the instructions Write for me sends", () => {
  it("names the field, its limit, the brand's voice and the campaign, and nothing else", () => {
    const prompt = writePrompt(request());
    const facts = JSON.parse(prompt.user);

    expect(facts).toEqual({
      field: { name: "Headline", style: "headline", mostCharacters: 40 },
      brand: { name: "Harrow Town FC", voiceAndTone: "Bold, Community", about: "A grassroots club in north London." },
      campaign: "Pre-order",
      highlight: "Pre-orders close Friday",
    });
    expect(prompt.maxOutputTokens).toBeGreaterThan(0);
  });

  it("tells the model it writes words only and draws nothing", () => {
    const prompt = writePrompt(request());
    expect(prompt.system).toContain("words only");
    expect(prompt.system).toContain("never describe, draw, change or mention changing a garment");
    expect(prompt.system).toContain("invent no fact");
  });

  it("sends no highlight when none was typed, rather than an empty one", () => {
    expect(JSON.parse(writePrompt(request({ highlight: "   " })).user).highlight).toBeNull();
    expect(JSON.parse(writePrompt(request({ campaign: null })).user).campaign).toBeNull();
  });

  it("takes the control characters out of what a person typed", () => {
    const facts = JSON.parse(writePrompt(request({ highlight: "Close\u0000 Friday‎  now" })).user);
    expect(facts.highlight).toBe("Close Friday now");
  });

  it("passes a cancellation on, and leaves it out when there is none", () => {
    const signal = new AbortController().signal;
    expect(writePrompt(request({ signal })).signal).toBe(signal);
    expect("signal" in writePrompt(request())).toBe(false);
  });
});

describe("reading what came back", () => {
  it("takes the options out of the shape asked for", () => {
    expect(readOptions(reply("New kit. Out Friday.", "The 25/26 kit is here.", "Yours from Friday."), 40)).toEqual([
      "New kit. Out Friday.",
      "The 25/26 kit is here.",
      "Yours from Friday.",
    ]);
  });

  it("reads plain lines when the model answered in prose, and tidies them", () => {
    expect(readOptions("1. New kit\n- Out Friday\n\n* \"Yours now\"", 40)).toEqual(["New kit", "Out Friday", "Yours now"]);
  });

  it("drops anything longer than the field takes, rather than cutting a sentence in half", () => {
    expect(readOptions(reply("Short", "x".repeat(41)), 40)).toEqual(["Short"]);
    expect(readOptions(reply("x".repeat(41)), null)).toEqual(["x".repeat(41)]);
  });

  it("gives at most three, each one different", () => {
    expect(readOptions(reply("A", "A", "B", "C", "D"), 40)).toEqual(["A", "B", "C"]);
    expect(OPTION_COUNT).toBe(3);
  });

  it("gives nothing back for a reply with nothing in it", () => {
    expect(readOptions("", 40)).toEqual([]);
    expect(readOptions(JSON.stringify({ options: [] }), 40)).toEqual([]);
    expect(readOptions(JSON.stringify({ other: 1 }), 40)).toEqual([]);
  });
});

describe("Write for me", () => {
  it("gives three options and what the call cost in tokens", async () => {
    const provider = createStubProvider([reply("New kit. Out Friday.", "The kit is here.", "Yours from Friday.")]);
    const result = await writeForMe(provider, request());

    expect(result.ok && result.options).toHaveLength(3);
    expect(result.ok && result.usage.outputTokens).toBeGreaterThan(0);
    expect(provider.requests).toHaveLength(1);
  });

  it("refuses any slot that is not a text field, so a model is never asked for a picture", async () => {
    const provider = createStubProvider([reply("anything")]);
    for (const kind of ["mockup", "logo", "qr", "shape"] as const) {
      const one = slot({ id: kind, kind, label: kind, rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } });
      const result = await writeForMe(provider, request({ slot: one }));
      expect(result.ok, kind).toBe(false);
      expect(result.ok ? "" : result.reason).toBe(NOT_TEXT);
    }
    // Nothing was asked of the model at all.
    expect(provider.requests).toEqual([]);
  });

  it("writes nothing for a brand with no voice on file", async () => {
    const provider = createStubProvider([reply("anything")]);
    const result = await writeForMe(provider, request({ voice: { ...VOICE, tags: [] } }));

    expect(result.ok ? "" : result.reason).toBe(NO_VOICE_NOTE);
    expect(provider.requests).toEqual([]);
  });

  it("says plainly when nothing came back that fits the field", async () => {
    const provider = createStubProvider([reply("x".repeat(80))]);
    expect((await writeForMe(provider, request())).ok).toBe(false);
    expect(await writeForMe(createStubProvider([reply("x".repeat(80))]), request()).then((r) => (r.ok ? "" : r.reason))).toBe(NOTHING_USABLE);
  });

  it("says plainly when the model could not be reached, and does not throw", async () => {
    const provider = createStubProvider([new ModelCallError("no key")]);
    const result = await writeForMe(provider, request());
    expect(result.ok ? "" : result.reason).toContain("could not be reached");
  });

  it("lets anything that is not a failed call through, because it is a fault and not an answer", async () => {
    const provider = createStubProvider([new TypeError("broken")]);
    await expect(writeForMe(provider, request())).rejects.toBeInstanceOf(TypeError);
  });
});

describe("the brand's voice", () => {
  it("keeps only the tags the spec names, in the spec's own order", () => {
    expect(voiceTagsOf(["Playful", "bold", "not-a-tag", "COMMUNITY"])).toEqual(["bold", "community", "playful"]);
    expect(voiceTagsOf([])).toEqual([]);
  });

  it("writes the tags as a sentence, and knows when there is no voice at all", () => {
    expect(voiceWords(VOICE)).toBe("Bold, Community");
    expect(hasVoice(VOICE)).toBe(true);
    expect(hasVoice(null)).toBe(false);
    expect(hasVoice({ ...VOICE, tags: [] })).toBe(false);
  });

  it("reads a brand from the source it is given, and nothing from anywhere else", async () => {
    const source = stubVoiceSource([VOICE]);
    expect(await source.read("brand-1")).toEqual(VOICE);
    expect(await source.read("brand-2")).toBeNull();
  });
});
