import { describe, expect, it, vi } from "vitest";
import { CAPTCHA_FIELD } from "@/lib/auth/schemas";
import { AppError } from "@/lib/server/core/errors";
import { LIMITS } from "@/lib/server/limits";
import { guardCommitteeWrite, type CommitteeWriteDeps } from "./respond";

const INPUT = { token: "t".repeat(43), [CAPTCHA_FIELD]: "widget-token" };

const deps = (patch: Partial<CommitteeWriteDeps> = {}): CommitteeWriteDeps => ({
  hitLinkLimit: vi.fn(async () => true),
  botCheck: vi.fn(async () => "passed" as const),
  secret: "a-secret",
  address: "203.0.113.4",
  rule: LIMITS.committeeWriteLink,
  ...patch,
});

const failure = async (given: CommitteeWriteDeps, write = vi.fn()): Promise<AppError> => {
  const error = await guardCommitteeWrite(given, INPUT, write).catch((raised: unknown) => raised);
  expect(error).toBeInstanceOf(AppError);
  expect(write).not.toHaveBeenCalled();
  return error as AppError;
};

describe("guardCommitteeWrite", () => {
  it("writes once the bot check has passed and the link has room", async () => {
    const write = vi.fn(async () => "written");
    const given = deps();

    expect(await guardCommitteeWrite(given, INPUT, write)).toBe("written");
    expect(given.botCheck).toHaveBeenCalledWith({ secret: "a-secret", token: "widget-token", address: "203.0.113.4" });
  });

  it("takes nothing at all where no bot-check secret is set", async () => {
    expect((await failure(deps({ secret: null }))).code).toBe("unavailable");
  });

  it("tells a fault at Cloudflare apart from a check that did not pass", async () => {
    expect((await failure(deps({ botCheck: vi.fn(async () => "unreachable" as const) }))).code).toBe("unavailable");
    const refused = await failure(deps({ botCheck: vi.fn(async () => "failed" as const) }));
    expect(refused.code).toBe("invalid_input");
    expect(refused.fields?.[CAPTCHA_FIELD]).toEqual(["The check did not pass. Try it again."]);
  });

  it("counts the link's allowance only after the bot check passed, so failed attempts cost nothing", async () => {
    const hitLinkLimit = vi.fn(async () => true);
    await failure(deps({ botCheck: vi.fn(async () => "failed" as const), hitLinkLimit }));

    expect(hitLinkLimit).not.toHaveBeenCalled();
  });

  it("names the link by a hash of its token, never by the token itself", async () => {
    const keys: string[] = [];
    const hitLinkLimit = async (key: string) => {
      keys.push(key);
      return true;
    };
    await guardCommitteeWrite(deps({ hitLinkLimit }), INPUT, vi.fn());
    const key = keys[0] ?? "";

    expect(key).toContain(LIMITS.committeeWriteLink.name);
    expect(key).not.toContain(INPUT.token);
  });

  it("refuses once one link has taken all it may, whatever the address", async () => {
    expect((await failure(deps({ hitLinkLimit: vi.fn(async () => false) }))).code).toBe("rate_limited");
  });
});
