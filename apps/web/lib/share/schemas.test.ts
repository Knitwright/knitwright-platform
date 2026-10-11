import { describe, expect, it } from "vitest";
import { CAPTCHA_FIELD } from "@/lib/auth/schemas";
import {
  COMMENT_MAX,
  NAME_MAX,
  createShareLinkSchema,
  shareLinkSchema,
  shareResponseSchema,
} from "./schemas";
import { newShareToken } from "./token";

const PROJECT = "7d4f6a2e-3b1c-4e5d-9f80-1a2b3c4d5e6f";
const LINK = "0e1d2c3b-4a59-4687-8796-a5b4c3d2e1f0";

describe("createShareLinkSchema", () => {
  it("takes the design and a length of 7, 30 or 90 days, 30 when none is chosen", () => {
    expect(createShareLinkSchema.parse({ projectId: PROJECT, days: "7" })).toEqual({ projectId: PROJECT, days: 7 });
    expect(createShareLinkSchema.parse({ projectId: PROJECT, days: "90" }).days).toBe(90);
    expect(createShareLinkSchema.parse({ projectId: PROJECT }).days).toBe(30);
  });

  it("refuses any other length and anything that is not a design", () => {
    expect(createShareLinkSchema.safeParse({ projectId: PROJECT, days: "31" }).success).toBe(false);
    expect(createShareLinkSchema.safeParse({ projectId: "nope", days: "30" }).success).toBe(false);
  });
});

describe("shareLinkSchema", () => {
  it("takes the design and the link", () => {
    expect(shareLinkSchema.parse({ projectId: PROJECT, linkId: LINK })).toEqual({ projectId: PROJECT, linkId: LINK });
    expect(shareLinkSchema.safeParse({ projectId: PROJECT, linkId: "x" }).success).toBe(false);
  });
});

describe("shareResponseSchema", () => {
  const token = newShareToken();
  const answer = (patch: Record<string, unknown>) => ({
    token,
    name: "Sam",
    vote: "yes",
    comment: "",
    [CAPTCHA_FIELD]: "passed",
    ...patch,
  });

  it("takes a name and a vote, and reads an empty comment as none", () => {
    expect(shareResponseSchema.parse(answer({ name: "  Sam  " }))).toEqual({
      token,
      name: "Sam",
      vote: "yes",
      comment: null,
      [CAPTCHA_FIELD]: "passed",
    });
  });

  it("takes a comment with no vote, keeping its line breaks", () => {
    const parsed = shareResponseSchema.parse(answer({ vote: "", comment: " Love it.\nNavy sleeves? " }));

    expect(parsed.vote).toBeNull();
    expect(parsed.comment).toBe("Love it.\nNavy sleeves?");
  });

  it("takes both, and reads a missing vote as none", () => {
    const parsed = shareResponseSchema.parse(answer({ vote: undefined, comment: "Yes" }));

    expect(parsed.vote).toBeNull();
    expect(shareResponseSchema.parse(answer({ vote: "not_yet", comment: "Not the collar." })).vote).toBe("not_yet");
  });

  it("asks for a vote or a comment when there is neither", () => {
    const result = shareResponseSchema.safeParse(answer({ vote: "", comment: "   " }));

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Choose a vote, write a comment, or both.");
  });

  it("asks for a short name with no hidden characters", () => {
    expect(shareResponseSchema.safeParse(answer({ name: "  " })).success).toBe(false);
    expect(shareResponseSchema.safeParse(answer({ name: "x".repeat(NAME_MAX + 1) })).success).toBe(false);
    expect(shareResponseSchema.safeParse(answer({ name: "x".repeat(NAME_MAX) })).success).toBe(true);
    expect(shareResponseSchema.safeParse(answer({ name: "Sam\u0000" })).success).toBe(false);
    expect(shareResponseSchema.safeParse(answer({ name: "Sam\nK" })).success).toBe(false);
  });

  it("limits a comment's length and refuses hidden characters other than line breaks", () => {
    expect(shareResponseSchema.safeParse(answer({ comment: "x".repeat(COMMENT_MAX + 1) })).success).toBe(false);
    expect(shareResponseSchema.safeParse(answer({ comment: "x".repeat(COMMENT_MAX) })).success).toBe(true);
    expect(shareResponseSchema.safeParse(answer({ comment: "a\u0007b" })).success).toBe(false);
  });

  it("refuses an unknown vote, a malformed token and a missing bot check", () => {
    expect(shareResponseSchema.safeParse(answer({ vote: "maybe" })).success).toBe(false);
    expect(shareResponseSchema.safeParse(answer({ token: "short" })).success).toBe(false);
    expect(shareResponseSchema.safeParse(answer({ [CAPTCHA_FIELD]: "" })).success).toBe(false);
  });
});
