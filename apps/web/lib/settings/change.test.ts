import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/server/core/errors";
import { writeSetting } from "./change";

const client = (error: { code?: string; message: string } | null = null) => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error });
  return { rpc, client: { rpc } as unknown as SupabaseClient };
};
const failure = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (e) {
    return e as AppError;
  }
  throw new Error("did not fail");
};

describe("writeSetting", () => {
  it("calls the database function with the actor, key and value", async () => {
    const { rpc, client: c } = client();
    await writeSetting(c, "admin-1", "guardrails.bleed_mm", 15);
    expect(rpc).toHaveBeenCalledWith("platform_setting_set", { p_actor: "admin-1", p_key: "guardrails.bleed_mm", p_value: 15 });
  });

  it("refuses an unknown key before calling the database", async () => {
    const { rpc, client: c } = client();
    const e = await failure(() => writeSetting(c, "a", "stripe.secret_key", "sk_live"));
    expect(e.code).toBe("invalid_input");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a value its schema rejects, in words", async () => {
    const { rpc, client: c } = client();
    const e = await failure(() => writeSetting(c, "a", "guardrails.bleed_mm", 500));
    expect(e).toMatchObject({ code: "invalid_input", message: "Use 50 or less." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("lets null through as a reset", async () => {
    const { rpc, client: c } = client();
    await writeSetting(c, "a", "guardrails.bleed_mm", null);
    expect(rpc).toHaveBeenCalledWith("platform_setting_set", expect.objectContaining({ p_value: null }));
  });

  it("answers not found when the database says the actor is not an admin, internal for anything else", async () => {
    expect((await failure(() => writeSetting(client({ code: "P0002", message: "Not found." }).client, "a", "guardrails.bleed_mm", 5))).code).toBe("not_found");
    expect((await failure(() => writeSetting(client({ message: "boom" }).client, "a", "guardrails.bleed_mm", 5))).code).toBe("internal");
  });
});
