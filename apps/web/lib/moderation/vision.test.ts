import { describe, expect, it } from "vitest";
import { createStubProvider } from "@/lib/providers/stub";
import { ModelCallError } from "@/lib/providers/text-model";
import { createModelVisionCheck, createStubVisionCheck, parseVisionReply, VISION_MAX_OUTPUT_TOKENS, VISION_SYSTEM } from "./vision";

const IMAGE = { mediaType: "image/png" as const, base64: "AAAA" };

describe("reading the vision model's answer", () => {
  it("reads a clear answer through the reply tool", () => {
    expect(parseVisionReply(JSON.stringify({ kind: "changes", actions: [] }))).toEqual({ marks: [], offensive: false });
  });

  it("reads a rejection whose reason is a finding", () => {
    const text = JSON.stringify({ kind: "rejection", reason: JSON.stringify({ marks: ["Nike swoosh"], offensive: false }) });
    expect(parseVisionReply(text)).toEqual({ marks: ["Nike swoosh"], offensive: false });
  });

  it("keeps a rejection's plain words as the mark, for a person to read", () => {
    expect(parseVisionReply(JSON.stringify({ kind: "rejection", reason: "a football club crest" }))).toEqual({ marks: ["a football club crest"], offensive: false });
    expect(parseVisionReply(JSON.stringify({ kind: "rejection" }))).toEqual({ marks: ["unnamed mark"], offensive: false });
  });

  it("reads a bare finding", () => {
    expect(parseVisionReply(' {"marks":[],"offensive":true} ')).toEqual({ marks: [], offensive: true });
  });

  it("refuses anything else", () => {
    expect(() => parseVisionReply("I think it is fine")).toThrow(ModelCallError);
    expect(() => parseVisionReply(JSON.stringify({ kind: "maybe" }))).toThrow(ModelCallError);
  });
});

describe("the model adapter", () => {
  it("sends the picture with fixed instructions and a fixed output limit, through the provider interface", async () => {
    const provider = createStubProvider([JSON.stringify({ kind: "changes", actions: [] })], "claude-haiku-4-5");
    const check = createModelVisionCheck(provider);
    expect(check.name).toBe("claude-haiku-4-5");
    expect(await check.inspect(IMAGE)).toEqual({ marks: [], offensive: false });
    expect(provider.requests[0]).toMatchObject({ system: VISION_SYSTEM, image: IMAGE, maxOutputTokens: VISION_MAX_OUTPUT_TOKENS });
  });

  it("passes a provider failure on", async () => {
    const check = createModelVisionCheck(createStubProvider([new ModelCallError("no key")]));
    await expect(check.inspect(IMAGE)).rejects.toThrow("no key");
  });
});

describe("the stub", () => {
  it("answers clear by default and repeats its last answer", async () => {
    const stub = createStubVisionCheck();
    expect(await stub.inspect(IMAGE)).toEqual({ marks: [], offensive: false });
    expect(await stub.inspect(IMAGE)).toEqual({ marks: [], offensive: false });
    expect(stub.calls).toBe(2);
  });
});
