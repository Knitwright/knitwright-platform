import { describe, expect, it } from "vitest";
import { createBody, editBody, resolveBody } from "./schemas";

const ID = "6f1c2f0e-7a53-4a6f-9d63-2f6f9a3c8b11";
const base = { version: 2, body: "  Move the crest up  ", mentions: [] };

describe("createBody", () => {
  it("cleans the text and fills defaults", () => {
    expect(createBody.parse(base)).toEqual({ version: 2, body: "Move the crest up", mentions: [], parentId: null, panelId: null, xMm: null, yMm: null });
  });

  it("takes a panel, and a point on it", () => {
    expect(createBody.parse({ ...base, panelId: "front", xMm: 12.5, yMm: 40 })).toMatchObject({ panelId: "front", xMm: 12.5, yMm: 40 });
  });

  it("refuses a point without a panel, or half a point", () => {
    expect(createBody.safeParse({ ...base, xMm: 1, yMm: 2 }).success).toBe(false);
    expect(createBody.safeParse({ ...base, panelId: "front", xMm: 1 }).success).toBe(false);
  });

  it("refuses an anchor on a reply", () => {
    expect(createBody.safeParse({ ...base, parentId: ID, panelId: "front" }).success).toBe(false);
    expect(createBody.parse({ ...base, parentId: ID })).toMatchObject({ parentId: ID });
  });

  it("refuses empty text, long text, a bad version, a point off the panel and unknown fields", () => {
    expect(createBody.safeParse({ ...base, body: " ​ " }).success).toBe(false);
    expect(createBody.safeParse({ ...base, body: "x".repeat(2001) }).success).toBe(false);
    expect(createBody.safeParse({ ...base, version: 0 }).success).toBe(false);
    expect(createBody.safeParse({ ...base, panelId: "front", xMm: -1, yMm: 1 }).success).toBe(false);
    expect(createBody.safeParse({ ...base, panelId: "front", xMm: 1, yMm: 5001 }).success).toBe(false);
    expect(createBody.safeParse({ ...base, authorId: ID }).success).toBe(false);
  });

  it("keeps each named person once, and refuses more than 10 or an id that is not one", () => {
    expect(createBody.parse({ ...base, mentions: [ID, ID] }).mentions).toEqual([ID]);
    const many = Array.from({ length: 11 }, (_, i) => `6f1c2f0e-7a53-4a6f-9d63-2f6f9a3c8b${String(i).padStart(2, "0")}`);
    expect(createBody.safeParse({ ...base, mentions: many }).success).toBe(false);
    expect(createBody.safeParse({ ...base, mentions: ["nobody"] }).success).toBe(false);
  });

  it("gives the cleaning message for text that cannot be used", () => {
    const result = createBody.safeParse({ ...base, body: "   " });
    expect(result.success ? "" : result.error.issues[0]?.message).toContain("Write something");
  });
});

describe("editBody and resolveBody", () => {
  it("clean the new words", () => {
    expect(editBody.parse({ body: " Better \n\n\n\n now ", mentions: [ID] })).toEqual({ body: "Better\n\nnow", mentions: [ID] });
  });
  it("need the resolved flag to be true or false", () => {
    expect(resolveBody.parse({ resolved: true })).toEqual({ resolved: true });
    expect(resolveBody.safeParse({ resolved: "yes" }).success).toBe(false);
    expect(resolveBody.safeParse({}).success).toBe(false);
  });
});
