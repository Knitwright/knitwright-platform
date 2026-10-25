import { describe, expect, it } from "vitest";
import { confirmBody, previewBody } from "./schemas";

const ID = "11111111-1111-4111-8111-111111111111";

describe("reorder bodies", () => {
  it("takes a release and, optionally, a season", () => {
    expect(previewBody.safeParse({ releaseId: ID }).success).toBe(true);
    expect(previewBody.safeParse({ releaseId: ID, seasonId: ID }).success).toBe(true);
    expect(previewBody.safeParse({ releaseId: "x" }).success).toBe(false);
  });

  it("needs the fingerprint of the plan and defaults to no answers", () => {
    expect(confirmBody.parse({ releaseId: ID, fingerprint: "a".repeat(64) }).resolutions).toEqual([]);
    expect(confirmBody.safeParse({ releaseId: ID, fingerprint: "nope" }).success).toBe(false);
  });

  it("accepts a size, a number and an action for a line, and nothing else", () => {
    const base = { releaseId: ID, fingerprint: "a".repeat(64) };
    expect(confirmBody.safeParse({ ...base, resolutions: [{ index: 1, sizeLabel: "L", number: "9", action: "keep" }] }).success).toBe(true);
    expect(confirmBody.safeParse({ ...base, resolutions: [{ index: 1, number: "ten" }] }).success).toBe(false);
    expect(confirmBody.safeParse({ ...base, resolutions: [{ index: 1, action: "delete" }] }).success).toBe(false);
    expect(confirmBody.safeParse({ ...base, resolutions: [{ index: -1 }] }).success).toBe(false);
    expect(confirmBody.safeParse({ ...base, resolutions: [{ index: 1, name: "x" }] }).success).toBe(false);
  });
});
