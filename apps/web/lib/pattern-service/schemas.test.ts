import { describe, expect, it } from "vitest";
import { moveSchema, reviewSchema } from "./schemas";

const id = "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11";

describe("moveSchema", () => {
  it("accepts a step and trims the note", () => {
    expect(moveSchema.parse({ requestId: id, to: "accepted", note: "  ok " })).toMatchObject({ note: "ok" });
    expect(moveSchema.parse({ requestId: id, to: "accepted" }).note).toBe("");
  });
  it("needs a reason to decline", () => {
    const bad = moveSchema.safeParse({ requestId: id, to: "declined", note: "  " });
    expect(bad.success).toBe(false);
    expect(moveSchema.safeParse({ requestId: id, to: "declined", note: "Cannot draft this" }).success).toBe(true);
  });
  it("refuses a step that does not exist", () => {
    expect(moveSchema.safeParse({ requestId: id, to: "requested" }).success).toBe(false);
  });
});

describe("reviewSchema", () => {
  it("needs a name", () => {
    expect(reviewSchema.safeParse({ requestId: id, reviewerName: " " }).success).toBe(false);
    expect(reviewSchema.safeParse({ requestId: id, reviewerName: "Sana" }).success).toBe(true);
  });
});
