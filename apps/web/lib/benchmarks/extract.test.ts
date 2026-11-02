import { describe, expect, it } from "vitest";
import { createStubProvider } from "@/lib/providers/stub";
import { ModelCallError } from "@/lib/providers/text-model";
import { createModelExtractor, createStubExtractor, EXTRACT_MAX_OUTPUT_TOKENS, EXTRACT_SYSTEM, userPrompt } from "./extract";
import { runningShort } from "./fixtures/cards";
import { emptyCard } from "./schema";
import { FEATURE_KEYS } from "./vocabulary";

/**
 * The extraction step is an interface with a deterministic stub, so no test and no local run reaches a paid model
 * (plan rule, Lesson 9). The parser, not the model, decides what a card may say.
 */

const page = { kind: "url", words: "A running short. 88% polyester. £45.00.", title: "Speedshort" } as const;

describe("the stub extractor", () => {
  it("answers from its script, in order, and repeats the last answer", async () => {
    const stub = createStubExtractor([runningShort(), emptyCard()]);

    expect((await stub.extract(page)).productName.value).toBe("Acme Speedshort 5in");
    expect((await stub.extract(page)).productName.value).toBeNull();
    expect((await stub.extract(page)).productName.value).toBeNull();
    expect(stub.calls).toBe(3);
    expect(stub.seen.map((seen) => seen.kind)).toEqual(["url", "url", "url"]);
  });

  it("throws the error its script holds, so a test can prove what a failed read does", async () => {
    const stub = createStubExtractor([new ModelCallError("no key")]);

    await expect(stub.extract(page)).rejects.toThrow("no key");
  });

  it("throws when it was given no answer at all, rather than inventing a card", async () => {
    await expect(createStubExtractor([]).extract(page)).rejects.toThrow("no answer");
  });
});

describe("the instructions", () => {
  it("name every feature key of the taxonomy, so the model cannot invent one", () => {
    for (const key of FEATURE_KEYS) expect(EXTRACT_SYSTEM, key).toContain(key);
  });

  it("forbid a measurement the page does not state, and forbid copying a review", () => {
    expect(EXTRACT_SYSTEM).toContain("Never state a measurement you were not told");
    expect(EXTRACT_SYSTEM).toContain("Never copy a review");
    expect(EXTRACT_SYSTEM).toContain("Do not describe a logo, a brand mark or a print as a feature");
  });

  it("say where the words came from, and send nothing it was not given", () => {
    expect(userPrompt(page)).toContain("Source: a product page");
    expect(userPrompt({ kind: "photo" })).toBe("Source: a photograph.");
    expect(userPrompt({ kind: "review_text", words: "it rides up" })).toContain("review text a person pasted");
  });
});

describe("the model adapter", () => {
  it("reads the model's JSON through the parser, which decides what the card may say", async () => {
    const answer = JSON.stringify({
      productName: { value: "A short", provenance: "observed" },
      price: { value: { minor: 4500, currency: "gbp" }, provenance: "observed" },
      features: [{ key: "side_split", provenance: "observed" }, { key: "not_a_feature", provenance: "observed" }],
    });
    const provider = createStubProvider([answer], "test-model");
    const extractor = createModelExtractor(provider);

    const read = await extractor.extract(page);

    expect(extractor.name).toBe("test-model");
    expect(read.productName).toMatchObject({ value: "A short", provenance: "observed" });
    expect(read.price.value).toEqual({ minor: 4500, currency: "GBP" });
    expect(read.features.map((feature) => feature.key)).toEqual(["side_split"]);
    expect(provider.requests[0]).toMatchObject({ system: EXTRACT_SYSTEM, maxOutputTokens: EXTRACT_MAX_OUTPUT_TOKENS });
  });

  it("comes back with an empty card when the model answers with something that is not a card", async () => {
    for (const answer of ["not json at all", "[]", '"a string"']) {
      const read = await createModelExtractor(createStubProvider([answer])).extract(page);
      expect(read, answer).toEqual(emptyCard());
    }
  });

  it("reads an answer the model wrapped in a code fence", async () => {
    const fenced = '```json\n{"fit":{"value":"Slim","provenance":"observed"}}\n```';

    expect((await createModelExtractor(createStubProvider([fenced])).extract(page)).fit.value).toBe("Slim");
  });

  it("sends the picture only when there is one", async () => {
    const provider = createStubProvider(["{}", "{}"]);
    const extractor = createModelExtractor(provider);

    await extractor.extract({ kind: "url", words: "words" });
    await extractor.extract({ kind: "photo", image: { mediaType: "image/png", base64: "AAAA" } });

    expect(provider.requests[0]?.image).toBeUndefined();
    expect(provider.requests[1]?.image).toEqual({ mediaType: "image/png", base64: "AAAA" });
  });
});
