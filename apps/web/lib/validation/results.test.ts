import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { AppError } from "@/lib/server/core/errors";
import { checkOf, passedCheck } from "./check";
import { finding } from "./finding";
import { readValidationResults, RESULT_SCOPES, writeValidationResult } from "./results";

/** The `validation_results` table of migration 20261101030000, read and written. */

type Answer = { data?: unknown; error?: { message: string } | null };

/** A client whose query chain and rpc both end in `answer`. */
const fake = (answer: Answer = {}) => {
  const calls: [string, unknown][] = [];
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) chain[m] = () => chain;
  chain.order = () => Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null });
  const client = {
    from: () => chain,
    rpc: (name: string, args: unknown) => (calls.push([name, args]), Promise.resolve({ error: answer.error ?? null })),
  } as unknown as SupabaseClient;
  return { client, calls };
};

const failure = async (run: () => Promise<unknown>): Promise<AppError> => {
  try {
    await run();
  } catch (error) {
    return error as AppError;
  }
  throw new Error("did not fail");
};

const who = { brandId: "b", userId: "u" };
const blocker = checkOf(finding({ code: "seam-cross", severity: "blocker", message: "Crosses a seam.", action: "Move it.", whoActs: "owner" }));
const warning = checkOf(finding({ code: "gamut-approx", severity: "warning", message: "An estimate.", action: "Ask.", whoActs: "print-house" }));
const clean = passedCheck("dpi", "R-SUB-003");

describe("the two scopes", () => {
  it("are the save-time one and the full one", () => {
    expect(RESULT_SCOPES).toEqual(["save", "full"]);
  });
});

describe("writing a result", () => {
  it("sends the checks and whether they pass, under the brand and user the caller named", async () => {
    const { client, calls } = fake();
    await writeValidationResult(client, who, { projectId: "p", version: 3, profileId: "knitwright-default", scope: "save", checks: [warning, clean] });
    expect(calls).toEqual([
      [
        "record_validation_result",
        { p_project_id: "p", p_brand_id: "b", p_user_id: "u", p_version: 3, p_profile_id: "knitwright-default", p_scope: "save", p_checks: [warning, clean], p_passed: true },
      ],
    ]);
  });

  it("says a result with an open blocker does not pass", async () => {
    const { client, calls } = fake();
    await writeValidationResult(client, who, { projectId: "p", version: 1, profileId: "knitwright-default", scope: "full", checks: [blocker] });
    expect(calls[0]?.[1]).toMatchObject({ p_passed: false, p_scope: "full" });
  });

  it("reports a database fault as an internal problem, without the database's words", async () => {
    const error = await failure(() =>
      writeValidationResult(fake({ error: { message: "relation does not exist" } }).client, who, {
        projectId: "p",
        version: 1,
        profileId: "knitwright-default",
        scope: "save",
        checks: [],
      }),
    );
    expect(error.code).toBe("internal");
    expect(error.message).not.toContain("relation");
  });
});

describe("reading the stored results of a version", () => {
  const row = {
    version: 2,
    profile_id: "knitwright-default",
    scope: "full",
    checks: [warning],
    passed: true,
    checked_at: "2026-10-29T10:00:00Z",
  };

  it("is empty when nothing was stored", async () => {
    expect(await readValidationResults(fake().client, "b", "p", 2)).toEqual([]);
  });

  it("gives each row in the shape the app uses", async () => {
    expect(await readValidationResults(fake({ data: [row] }).client, "b", "p", 2)).toEqual([
      { version: 2, profileId: "knitwright-default", scope: "full", checks: [warning], passed: true, at: "2026-10-29T10:00:00Z" },
    ]);
  });

  it("refuses a row whose checks are not checks, rather than passing them on", async () => {
    const bad = { ...row, checks: [{ code: "x", passed: "yes" }] };
    await expect(readValidationResults(fake({ data: [bad] }).client, "b", "p", 2)).rejects.toThrow();
  });

  it("reports a database fault as an internal problem", async () => {
    const error = await failure(() => readValidationResults(fake({ error: { message: "boom" } }).client, "b", "p", 2));
    expect(error.code).toBe("internal");
  });
});
