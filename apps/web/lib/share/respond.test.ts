import { describe, expect, it, vi } from "vitest";
import { CAPTCHA_FIELD } from "@/lib/auth/schemas";
import { LIMITS } from "@/lib/server/limits";
import { keepAnswer, type RespondDeps } from "./respond";
import type { ShareResponseInput } from "./schemas";
import { linkRateKey, newShareToken, newVisitorKey } from "./token";

const token = newShareToken();

const input = (patch: Partial<ShareResponseInput> = {}): ShareResponseInput => ({
  token,
  name: "Sam",
  vote: "yes",
  comment: null,
  [CAPTCHA_FIELD]: "passed-token",
  ...patch,
});

const deps = (patch: Partial<RespondDeps> = {}): RespondDeps => ({
  hitLinkLimit: vi.fn(async () => true),
  botCheck: vi.fn(async () => "passed" as const),
  secret: "s3cret",
  address: "203.0.113.9",
  visitorKey: newVisitorKey(),
  save: vi.fn(async () => undefined),
  ...patch,
});

describe("keepAnswer", () => {
  it("counts the answer against the link, checks the bot check, then keeps it under the visitor's key", async () => {
    const given = deps();

    await keepAnswer(given, input({ comment: "Navy please" }));

    expect(given.hitLinkLimit).toHaveBeenCalledWith(`${LIMITS.shareRespondLink.name}:link:${linkRateKey(token)}`, LIMITS.shareRespondLink);
    expect(given.botCheck).toHaveBeenCalledWith({ secret: "s3cret", token: "passed-token", address: "203.0.113.9" });
    expect(given.save).toHaveBeenCalledWith({ token, visitorKey: given.visitorKey, name: "Sam", vote: "yes", comment: "Navy please" });
  });

  it("refuses an answer over the link's limit, and keeps nothing", async () => {
    const given = deps({ hitLinkLimit: vi.fn(async () => false) });

    await expect(keepAnswer(given, input())).rejects.toMatchObject({ code: "rate_limited" });
    expect(given.save).not.toHaveBeenCalled();
  });

  it("counts against the link only answers that passed the bot check, so failed attempts cannot use up a link", async () => {
    const given = deps({ botCheck: vi.fn(async () => "failed" as const) });

    await expect(keepAnswer(given, input())).rejects.toMatchObject({ code: "invalid_input" });
    expect(given.hitLinkLimit).not.toHaveBeenCalled();
  });

  it("asks for the bot check again when it fails", async () => {
    const given = deps({ botCheck: vi.fn(async () => "failed" as const) });

    await expect(keepAnswer(given, input())).rejects.toMatchObject({
      code: "invalid_input",
      fields: { [CAPTCHA_FIELD]: ["The check did not pass. Try it again."] },
    });
    expect(given.save).not.toHaveBeenCalled();
  });

  it("says to try later when Cloudflare cannot be reached, or no secret is set", async () => {
    await expect(keepAnswer(deps({ botCheck: vi.fn(async () => "unreachable" as const) }), input())).rejects.toMatchObject({
      code: "unavailable",
    });
    const noSecret = deps({ secret: null });
    await expect(keepAnswer(noSecret, input())).rejects.toMatchObject({ code: "unavailable" });
    expect(noSecret.botCheck).not.toHaveBeenCalled();
    expect(noSecret.save).not.toHaveBeenCalled();
  });
});
