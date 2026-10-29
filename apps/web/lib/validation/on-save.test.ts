import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { jersey, LOGO_AND_TEXT } from "@/lib/artwork-stack/fixtures/designs";
import { validateOnSave, type SaveLog } from "./on-save";
import { UNWIRED_PORTS, type ParameterDef } from "./ports";
import { RULE_ID_PATTERN } from "./rules";

/** Spec F-0: validation runs on every save, and a failure there never undoes the save. */

const DEFS: readonly ParameterDef[] = [{ key: "body_length_offset", type: "range", min: -30, max: 40, step: 10, ruleId: "R-PAT-003" }];
const saved = { brandId: "b", userId: "u", projectId: "p", version: 4, spec: jersey() };

const fake = (overrides: Partial<{ rpcError: { message: string }; readThrows: boolean }> = {}) => {
  const calls: [string, unknown][] = [];
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) chain[m] = () => chain;
  chain.maybeSingle = () => (overrides.readThrows === true ? Promise.reject(new Error("no database")) : Promise.resolve({ data: null, error: null }));
  const client = {
    from: () => chain,
    rpc: (name: string, args: unknown) => (calls.push([name, args]), Promise.resolve({ error: overrides.rpcError ?? null })),
  } as unknown as SupabaseClient;
  return { client, calls };
};

const collected = () => {
  const lines: Parameters<SaveLog>[0][] = [];
  return { lines, write: ((event) => void lines.push(event)) as SaveLog };
};

describe("validation on save", () => {
  it("runs the checks and stores them under the save scope, with the version that was saved", async () => {
    const { client, calls } = fake();
    const result = await validateOnSave(client, saved);
    expect(result).not.toBeNull();
    expect(calls.map(([name]) => name)).toEqual(["record_validation_result"]);
    expect(calls[0]?.[1]).toMatchObject({ p_scope: "save", p_version: 4, p_project_id: "p", p_brand_id: "b", p_user_id: "u" });
  });

  it("gives every stored check a rule id", async () => {
    const result = await validateOnSave(fake().client, saved);
    expect(result?.checks.length).toBeGreaterThan(0);
    expect(result?.checks.every((check) => RULE_ID_PATTERN.test(check.ruleId))).toBe(true);
  });

  it("leaves the tech pack readiness list out, because the save path does not build the tech pack", async () => {
    const result = await validateOnSave(fake().client, saved);
    expect(result?.findings.some((found) => found.code.startsWith("readiness-"))).toBe(false);
  });

  it("finds the design is on no base article while the catalogue is not wired, and warns rather than blocks", async () => {
    const result = await validateOnSave(fake().client, saved, UNWIRED_PORTS);
    const found = result?.findings.find((one) => one.code === "article-not-set");
    expect(found?.severity).toBe("warning");
    expect(result?.orderable).toBe(true);
  });

  it("blocks a parameter outside the range once the catalogue answers", async () => {
    const spec = jersey({ article: { baseArticleCode: "JSY-SS-01", productionClass: "A", parameters: { body_length_offset: 500 } } });
    const ports = { ...UNWIRED_PORTS, catalogue: { articleForType: async () => null, parameterDefs: async () => DEFS } };
    const result = await validateOnSave(fake().client, { ...saved, spec }, ports);
    expect(result?.findings.map((one) => one.code)).toContain("parameter-out-of-range");
    expect(result?.orderable).toBe(false);
  });

  it("logs and gives nothing back when the store refuses, so the save that already happened stands", async () => {
    const { lines, write } = collected();
    expect(await validateOnSave(fake({ rpcError: { message: "no such function" } }).client, saved, UNWIRED_PORTS, write)).toBeNull();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: "warn", where: "validation on save" });
    expect(lines[0]?.message).toContain("version 4");
  });

  it("logs and gives nothing back when the profile cannot be read", async () => {
    const { lines, write } = collected();
    expect(await validateOnSave(fake({ readThrows: true }).client, saved, UNWIRED_PORTS, write)).toBeNull();
    expect(lines).toHaveLength(1);
  });

  it("stores the same checks twice for the same saved version", async () => {
    const spec = jersey({ artwork: LOGO_AND_TEXT });
    const first = await validateOnSave(fake().client, { ...saved, spec });
    const again = await validateOnSave(fake().client, { ...saved, spec });
    expect(again?.checks).toEqual(first?.checks);
  });
});
