import { describe, expect, it } from "vitest";
import { CAPTCHA_FIELD } from "@/lib/auth/fields";
import { COMMENT_MAX_LENGTH } from "@/lib/comments/text";
import {
  committeeApproveSchema,
  committeePinSchema,
  committeeVoteSchema,
  createCommitteeLinkSchema,
  lockCommitteeVersionSchema,
  NAME_MAX,
  PIN_MAX,
} from "./schemas";

const TOKEN = "a".repeat(43);
const CHECK = { [CAPTCHA_FIELD]: "token-from-the-widget" };

const pin = (patch: Record<string, unknown> = {}) => ({
  token: TOKEN,
  name: "Sam",
  version: "4",
  panelId: "body-front",
  xMm: "100.26",
  yMm: "0",
  body: "  Navy  sleeves \n\n\n please.  ",
  ...CHECK,
  ...patch,
});

describe("a pinned comment", () => {
  it("takes the point as the form sends it, in tenths of a millimetre", () => {
    const parsed = committeePinSchema.parse(pin());

    expect(parsed).toMatchObject({ version: 4, panelId: "body-front", xMm: 100.3, yMm: 0 });
  });

  it("cleans the words the way a design comment is cleaned, line breaks and all", () => {
    expect(committeePinSchema.parse(pin()).body).toBe("Navy sleeves\n\nplease.");
  });

  it("refuses a token that could never open a link", () => {
    expect(committeePinSchema.safeParse(pin({ token: "short" })).success).toBe(false);
  });

  it("refuses an empty comment, a point outside the drawing and a panel that is not an id", () => {
    expect(committeePinSchema.safeParse(pin({ body: "   " })).success).toBe(false);
    expect(committeePinSchema.safeParse(pin({ xMm: "9000" })).success).toBe(false);
    expect(committeePinSchema.safeParse(pin({ panelId: "Body Front" })).success).toBe(false);
  });

  it("refuses a comment longer than the column holds, after cleaning", () => {
    expect(committeePinSchema.safeParse(pin({ body: "x".repeat(PIN_MAX + 1) })).success).toBe(false);
    expect(committeePinSchema.safeParse(pin({ body: "x".repeat(PIN_MAX) })).success).toBe(true);
  });

  it("is held to the design comment's own length, so the field and the cleaner cannot drift apart", () => {
    expect(PIN_MAX).toBe(COMMENT_MAX_LENGTH);
  });

  it("refuses a body so long it is not worth cleaning", () => {
    expect(committeePinSchema.safeParse(pin({ body: "x".repeat(PIN_MAX * 5 + 1) })).success).toBe(false);
  });

  it("refuses a name with a line break in it, and one too long for the column", () => {
    expect(committeePinSchema.safeParse(pin({ name: "Sam\nSmith" })).success).toBe(false);
    expect(committeePinSchema.safeParse(pin({ name: "n".repeat(NAME_MAX + 1) })).success).toBe(false);
  });
});

describe("a vote", () => {
  it("takes one of the three options and nothing else", () => {
    expect(committeeVoteSchema.parse({ token: TOKEN, name: "Sam", slot: "B", ...CHECK }).slot).toBe("B");
    expect(committeeVoteSchema.safeParse({ token: TOKEN, name: "Sam", slot: "D", ...CHECK }).success).toBe(false);
  });

  it("needs the bot check's answer", () => {
    expect(committeeVoteSchema.safeParse({ token: TOKEN, name: "Sam", slot: "A" }).success).toBe(false);
  });
});

describe("an approval", () => {
  it("needs a name and takes an email if one is offered", () => {
    expect(committeeApproveSchema.parse({ token: TOKEN, name: "Dana", version: "4", ...CHECK }).email).toBeNull();
    expect(committeeApproveSchema.parse({ token: TOKEN, name: "Dana", version: "4", email: "  Dana@Example.Test ", ...CHECK }).email).toBe(
      "dana@example.test",
    );
  });

  it("treats an empty email field as no address at all, not a wrong one", () => {
    expect(committeeApproveSchema.parse({ token: TOKEN, name: "Dana", version: "4", email: "   ", ...CHECK }).email).toBeNull();
  });

  it("refuses something that is not an address, and a missing name", () => {
    expect(committeeApproveSchema.safeParse({ token: TOKEN, name: "Dana", version: "4", email: "dana@", ...CHECK }).success).toBe(false);
    expect(committeeApproveSchema.safeParse({ token: TOKEN, name: " ", version: "4", ...CHECK }).success).toBe(false);
  });
});

describe("making and locking a link", () => {
  const projectId = "11111111-1111-4111-8111-111111111111";

  it("takes one to three versions, each only once", () => {
    expect(createCommitteeLinkSchema.parse({ projectId, versions: [3, 2, 1] }).versions).toEqual([3, 2, 1]);
    expect(createCommitteeLinkSchema.safeParse({ projectId, versions: [] }).success).toBe(false);
    expect(createCommitteeLinkSchema.safeParse({ projectId, versions: [1, 2, 3, 4] }).success).toBe(false);
    expect(createCommitteeLinkSchema.safeParse({ projectId, versions: [2, 2] }).success).toBe(false);
  });

  it("names the design, the link and the version to lock", () => {
    const linkId = "22222222-2222-4222-8222-222222222222";

    expect(lockCommitteeVersionSchema.parse({ projectId, linkId, version: "7" })).toEqual({ projectId, linkId, version: 7 });
    expect(lockCommitteeVersionSchema.safeParse({ projectId, linkId, version: "0" }).success).toBe(false);
  });
});
