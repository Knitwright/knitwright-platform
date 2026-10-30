import { describe, expect, it } from "vitest";
import { addPhotoSchema, addReviewTextSchema, addUrlSchema, confirmCardSchema, newBenchmarkSchema, removeCardSchema } from "./inputs";
import { MAX_REVIEW_CHARS } from "./service";

/** What the screens may send. The brand and the person always come from the session, never from a body. */

const ID = "11111111-1111-4111-8111-111111111111";

describe("what a screen may send", () => {
  it("names no brand and no person anywhere: those come from the session", () => {
    const schemas = { newBenchmarkSchema, addUrlSchema, addReviewTextSchema, addPhotoSchema, confirmCardSchema, removeCardSchema };
    for (const [name, schema] of Object.entries(schemas)) {
      const keys = Object.keys(JSON.parse(JSON.stringify(schema.safeParse({}).error?.issues ?? [])) as unknown[]);
      expect(keys, name).not.toContain("brandId");
      expect(JSON.stringify(schema)).not.toContain("brandId");
    }
  });

  it("takes a new comparison with a name, and with or without a design", () => {
    expect(newBenchmarkSchema.parse({ title: "  Running shorts  " })).toEqual({ title: "Running shorts" });
    expect(newBenchmarkSchema.parse({ title: "x", projectId: "" }).projectId).toBe("");
    expect(newBenchmarkSchema.parse({ title: "x", projectId: ID }).projectId).toBe(ID);
    expect(newBenchmarkSchema.safeParse({ title: "" }).success).toBe(false);
    expect(newBenchmarkSchema.safeParse({ title: "x", projectId: "not-an-id" }).success).toBe(false);
  });

  it("takes a URL as a person typed it and leaves the checking to the fetcher", () => {
    expect(addUrlSchema.parse({ benchmarkId: ID, url: "  https://shop.example.test/p  " }).url).toBe("https://shop.example.test/p");
    expect(addUrlSchema.safeParse({ benchmarkId: ID, url: "short" }).success).toBe(false);
    expect(addUrlSchema.safeParse({ benchmarkId: ID, url: `https://x.test/${"a".repeat(2100)}` }).success).toBe(false);
  });

  it("asks for enough review text to find a theme in, and no more than it reads", () => {
    expect(addReviewTextSchema.safeParse({ benchmarkId: ID, text: "too short" }).success).toBe(false);
    expect(addReviewTextSchema.safeParse({ benchmarkId: ID, text: "x".repeat(40) }).success).toBe(true);
    expect(addReviewTextSchema.safeParse({ benchmarkId: ID, text: "x".repeat(MAX_REVIEW_CHARS + 1) }).success).toBe(false);
  });

  it("takes a photo only as a file already in the brand's own files", () => {
    expect(addPhotoSchema.parse({ benchmarkId: ID, fileId: ID })).toEqual({ benchmarkId: ID, fileId: ID });
    expect(addPhotoSchema.safeParse({ benchmarkId: ID, fileId: "https://example.test/image.png" }).success).toBe(false);
  });

  it("takes a confirmation with the corrections beside it", () => {
    const read = confirmCardSchema.parse({ benchmarkId: ID, cardId: ID, fit: "Regular", features: "side_split" });

    expect(read).toMatchObject({ cardId: ID, fit: "Regular", features: ["side_split"] });
    expect(confirmCardSchema.safeParse({ cardId: ID }).success).toBe(false);
  });

  it("takes a removal by card", () => {
    expect(removeCardSchema.parse({ benchmarkId: ID, cardId: ID }).cardId).toBe(ID);
  });
});
