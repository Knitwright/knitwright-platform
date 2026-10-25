import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CREDIT_SETTINGS } from "@/lib/credits/settings";
import { DEFAULT_SETTINGS } from "@/lib/guardrails/settings";
import { loadCreditSettings, loadGuardrailSettings } from "./read";

const client = (rows: unknown[] | null) =>
  ({ from: () => ({ select: () => Promise.resolve(rows ? { data: rows, error: null } : { data: null, error: { message: "x" } }) }) }) as unknown as SupabaseClient;
const row = (key: string, value: unknown) => ({ key, value, set_by: null, set_at: "2026-10-27T00:00:00Z" });

describe("read-through", () => {
  it("returns the in-code defaults when nothing is stored or the read fails", async () => {
    expect(await loadCreditSettings(client([]))).toEqual(CREDIT_SETTINGS);
    expect(await loadCreditSettings(client(null))).toBe(CREDIT_SETTINGS);
    expect(await loadGuardrailSettings(client([]))).toEqual(DEFAULT_SETTINGS);
    expect(await loadGuardrailSettings(client(null))).toBe(DEFAULT_SETTINGS);
  });

  it("returns a stored value", async () => {
    expect((await loadCreditSettings(client([row("credits.monthly_allowance", 12)]))).monthlyAllowance).toBe(12);
    expect((await loadGuardrailSettings(client([row("guardrails.min_dpi", 200)]))).minDpi.value).toBe(200);
  });
});
