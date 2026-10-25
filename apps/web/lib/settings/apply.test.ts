import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyChange } from "./apply";

const row = (key: string, value: unknown) => ({ key, value, set_by: "u1", set_at: "2026-10-27T08:00:00Z" });

function fake(rows: unknown[]) {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const client = {
    rpc,
    from: (table: string) => (table === "factory_profiles" ? { upsert } : { select: () => Promise.resolve({ data: rows, error: null }) }),
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "ada@example.com" } } }) } },
  } as unknown as SupabaseClient;
  return { client, rpc, upsert };
}

describe("applyChange", () => {
  it("writes an ops change through to ops_settings with the admin's name in the label", async () => {
    const { client, rpc } = fake([row("ops.cutoff_weekday", 4), row("ops.cutoff_minutes", 420)]);
    await applyChange(client, "u1", "ops.cutoff_minutes", async () => undefined);
    expect(rpc).toHaveBeenCalledWith("ops_update_settings", { p_actor: "u1", p_weekday: 4, p_minutes: 420, p_lead_time_days: null, p_label: "Set by ada@example.com on 2026-10-27" });
  });

  it("restores the defaults when the last ops value is reset", async () => {
    const { client, rpc } = fake([]);
    await applyChange(client, "u1", "ops.cutoff_minutes", async () => undefined);
    expect(rpc).toHaveBeenCalledWith("ops_update_settings", expect.objectContaining({ p_weekday: 5, p_minutes: 1020, p_label: "Knitwright default, not agreed with a factory" }));
  });

  it("writes factory terms to the seeded factory profile row", async () => {
    const { client, upsert } = fake([row("factory.lead_time_days", 10)]);
    await applyChange(client, "u1", "factory.lead_time_days", async () => undefined);
    const written = upsert.mock.calls[0]![0] as { id: string; label: string; profile: { leadTimeDays: unknown } };
    expect(written.id).toBe("knitwright-default");
    expect(written.label).toBe("Set by ada@example.com on 2026-10-27");
    expect(written.profile.leadTimeDays).toEqual({ status: "set", value: 10 });
  });

  it("syncs credit prices through the credit service, and does nothing for settings read directly", async () => {
    const sync = vi.fn().mockResolvedValue(undefined);
    const { client, rpc, upsert } = fake([row("credits.price_pattern_file", 3)]);
    await applyChange(client, "u1", "credits.price_pattern_file", sync);
    expect(sync).toHaveBeenCalledTimes(1);
    await applyChange(client, "u1", "guardrails.bleed_mm", sync);
    await applyChange(client, "u1", "credits.monthly_allowance", sync);
    expect(sync).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("throws a generic error when the profile cannot be written", async () => {
    const { client } = fake([row("factory.lead_time_days", 10)]);
    (client as unknown as { from: (t: string) => unknown }).from = (table) => (table === "factory_profiles" ? { upsert: async () => ({ error: { message: "x" } }) } : { select: async () => ({ data: [row("factory.lead_time_days", 10)], error: null }) });
    await expect(applyChange(client, "u1", "factory.lead_time_days", async () => undefined)).rejects.toMatchObject({ code: "internal" });
  });
});
