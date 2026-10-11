import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { recordConsent, setMarketingChoice, unsubscribe } from "./service";
import { signUnsubscribe, unsubscribeKey } from "./unsubscribe-token";
import { MARKETING_OPT_IN, MARKETING_UNSUBSCRIBE } from "./wording";

const KEY = unsubscribeKey("secret");
const USER = "6f1c2a4e-1d1b-4b8e-9a51-0c6a3c1f7d20";

const adminWith = (answer: { data: unknown; error: unknown }) => {
  const rpc = vi.fn(async () => answer);
  return { admin: { rpc } as unknown as SupabaseClient, rpc };
};

/** A session client whose consent_events query answers with these rows. */
const clientWith = (rows: unknown[]): SupabaseClient => {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: async () => ({ data: rows, error: null }),
  };
  return { from: () => query } as unknown as SupabaseClient;
};

describe("recordConsent", () => {
  it("sends the person, the answer, the version of the words and where it came from", async () => {
    const { admin, rpc } = adminWith({ data: true, error: null });

    await expect(recordConsent({ admin, userId: USER, granted: true, wording: MARKETING_OPT_IN, source: "sign-up" })).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("record_consent", {
      p_user_id: USER,
      p_purpose: "marketing_email",
      p_granted: true,
      p_wording_version: MARKETING_OPT_IN.version,
      p_source: "sign-up",
    });
  });

  it("fails loudly when the database refuses", async () => {
    const { admin } = adminWith({ data: null, error: { message: "no" } });

    await expect(recordConsent({ admin, userId: USER, granted: true, wording: MARKETING_OPT_IN, source: "settings" })).rejects.toThrow("could not be saved");
  });
});

describe("setMarketingChoice", () => {
  const row = (granted: boolean) => ({ purpose: "marketing_email", granted, created_at: "2026-10-01T00:00:00Z", source: "sign-up", wording_version: "marketing-email-v1" });

  it("writes nothing when the answer is unchanged", async () => {
    const { admin, rpc } = adminWith({ data: true, error: null });

    await expect(setMarketingChoice({ client: clientWith([row(true)]), admin, userId: USER, granted: true })).resolves.toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("writes a Settings event when the answer changes", async () => {
    const { admin, rpc } = adminWith({ data: true, error: null });

    await expect(setMarketingChoice({ client: clientWith([row(true)]), admin, userId: USER, granted: false })).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("record_consent", expect.objectContaining({ p_granted: false, p_source: "settings" }));
  });
});

describe("unsubscribe", () => {
  it("records a withdrawal for the person the link names, with the unsubscribe words", async () => {
    const { admin, rpc } = adminWith({ data: true, error: null });

    await unsubscribe({ admin, token: signUnsubscribe(USER, KEY), key: KEY });
    expect(rpc).toHaveBeenCalledWith("record_consent", {
      p_user_id: USER,
      p_purpose: "marketing_email",
      p_granted: false,
      p_wording_version: MARKETING_UNSUBSCRIBE.version,
      p_source: "unsubscribe",
    });
  });

  it("refuses a link that was not signed by this server, in words the person can read, and records nothing", async () => {
    const { admin, rpc } = adminWith({ data: true, error: null });

    const failure = await unsubscribe({ admin, token: signUnsubscribe(USER, unsubscribeKey("other")), key: KEY }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AppError);
    expect(failure).toMatchObject({ code: "invalid_input", message: expect.stringMatching(/Settings/) });
    expect(rpc).not.toHaveBeenCalled();
  });
});
