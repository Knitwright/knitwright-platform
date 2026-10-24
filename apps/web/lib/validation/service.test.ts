import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { defaultFactoryProfile } from "./profile";
import { DEFAULT_PROFILE_ID, loadFactoryProfile, readDesignStatus, writeDesignStatus } from "./service";
import { DRAFT } from "./status";

type Answer = { data?: unknown; error?: { code?: string; hint?: string | null; message: string } | null };

/** A client whose every query chain ends in `answer`, and whose rpc answers the same. */
const fake = (answer: Answer) => {
  const calls: { rpc?: [string, unknown] } = {};
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) chain[m] = () => chain;
  chain.maybeSingle = () => Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null });
  const client = {
    from: () => chain,
    rpc: (name: string, args: unknown) => {
      calls.rpc = [name, args];
      return Promise.resolve({ error: answer.error ?? null });
    },
  } as unknown as SupabaseClient;
  return { client, calls };
};
const failure = async (run: () => Promise<unknown>): Promise<AppError> => {
  try { await run(); } catch (e) { return e as AppError; }
  throw new Error("did not fail");
};
const who = { brandId: "b", userId: "u" };

describe("loadFactoryProfile", () => {
  it("builds the default from the registry without a read", async () => {
    expect(await loadFactoryProfile(fake({}).client)).toEqual(defaultFactoryProfile());
    expect(DEFAULT_PROFILE_ID).toBe("knitwright-default");
  });

  it("reads another profile as stored", async () => {
    const stored = { ...defaultFactoryProfile(), id: "mill-a", name: "Mill A" };
    expect((await loadFactoryProfile(fake({ data: { id: "mill-a", profile: stored } }).client, "mill-a")).name).toBe("Mill A");
  });

  it("says not found for a missing profile and internal for a read error", async () => {
    expect((await failure(() => loadFactoryProfile(fake({}).client, "nope"))).code).toBe("not_found");
    expect((await failure(() => loadFactoryProfile(fake({ error: { message: "x" } }).client, "nope"))).code).toBe("internal");
  });
});

describe("readDesignStatus", () => {
  it("treats a version with no row as a draft", async () => {
    expect(await readDesignStatus(fake({}).client, "b", "p", 1)).toEqual(DRAFT);
  });

  it("reads a stored row", async () => {
    const row = { status: "validated", profile_id: "knitwright-default", findings_hash: "a".repeat(64), changed_at: "2026-10-24T00:00:00Z" };
    expect(await readDesignStatus(fake({ data: row }).client, "b", "p", 1)).toEqual({ status: "validated", profileId: "knitwright-default", findingsHash: "a".repeat(64), at: "2026-10-24T00:00:00Z" });
  });

  it("fails on a read error", async () => {
    expect((await failure(() => readDesignStatus(fake({ error: { message: "x" } }).client, "b", "p", 1))).code).toBe("internal");
  });
});

describe("writeDesignStatus", () => {
  it("calls the function with the brand and user from the session", async () => {
    const { client, calls } = fake({});
    await writeDesignStatus(client, who, "p", 2, "validated", { profileId: "x", findingsHash: "h" });
    expect(calls.rpc).toEqual(["set_design_status", { p_project_id: "p", p_brand_id: "b", p_user_id: "u", p_version: 2, p_status: "validated", p_profile_id: "x", p_findings_hash: "h" }]);
  });

  it.each([
    [{ message: "m", hint: "status_ordered" }, "conflict"],
    [{ message: "m", hint: "status_move" }, "conflict"],
    [{ message: "m", code: "P0002" }, "not_found"],
    [{ message: "m", code: "23503" }, "not_found"],
    [{ message: "m", code: "XX000" }, "internal"],
  ])("maps %j to %s", async (error, code) => {
    expect((await failure(() => writeDesignStatus(fake({ error }).client, who, "p", 1, "draft", { profileId: null, findingsHash: null }))).code).toBe(code);
  });
});
