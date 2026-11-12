import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { jersey } from "@/lib/artwork-stack/fixtures/designs";
import type { ValidationCheck } from "./check";
import { assertOrderable, blockersOf, checkVersion, whyNotOrderable } from "./order-gate";
import { UNWIRED_PORTS, type ModerationReader, type ValidationPorts } from "./ports";

/** Plan v6 D1 (decision 0132): spec F-0, "blocks ordering or export on any error". */

const check = (over: Partial<ValidationCheck> = {}): ValidationCheck => ({
  code: "article-not-made",
  severity: "blocker",
  message: "Profile does not list this garment",
  target: { article: "team-jersey", panel: null },
  ruleId: "R-GAP-000",
  passed: false,
  ...over,
});

const fake = () => {
  const calls: [string, Record<string, unknown>][] = [];
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) chain[m] = () => chain;
  chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
  const admin = {
    from: () => chain,
    rpc: (name: string, args: Record<string, unknown>) => (calls.push([name, args]), Promise.resolve({ error: null })),
  } as unknown as SupabaseClient;
  return { admin, calls };
};

const who = { brandId: "b", userId: "u" };
const target = { projectId: "p", version: 3, spec: jersey() };

/** A design whose one picture the content review blocked: a blocker whatever the profile says. */
const blockedPicture: ModerationReader = {
  statusesFor: async (_brand, targets) => [{ target: targets[0] ?? { kind: "asset", id: "a", label: "Crest" }, result: "blocked" }],
};
const blockedPorts: ValidationPorts = { ...UNWIRED_PORTS, moderation: blockedPicture };

describe("which checks stop an order", () => {
  it("is every failed blocker, and never a warning or a passing check", () => {
    const checks = [check(), check({ code: "moq-not-set", severity: "warning" }), check({ code: "min-dpi", severity: null, passed: true })];
    expect(blockersOf(checks).map((one) => one.code)).toEqual(["article-not-made"]);
  });

  it("says nothing when nothing blocks", () => {
    expect(whyNotOrderable([check({ severity: "warning" })])).toBeNull();
    expect(whyNotOrderable([])).toBeNull();
  });

  it("names the blockers in the person's own words, and counts the rest", () => {
    const one = whyNotOrderable([check()]);
    expect(one).toContain("1 blocker against the factory profile");
    expect(one).toContain("Profile does not list this garment.");
    const many = whyNotOrderable([1, 2, 3, 4, 5].map((n) => check({ code: `c-${n}`, message: `Problem ${n}.` })));
    expect(many).toContain("5 blockers");
    expect(many).toContain("Problem 3.");
    expect(many).not.toContain("Problem 4.");
    expect(many).toContain("And 2 more.");
  });
});

describe("checking a version before it is ordered", () => {
  it("runs the save checks and stores them as the version's newest save result", async () => {
    const { admin, calls } = fake();
    const result = await checkVersion({ admin, ports: UNWIRED_PORTS }, who, target);
    expect(calls.map(([name]) => name)).toEqual(["record_validation_result"]);
    expect(calls[0]?.[1]).toMatchObject({ p_scope: "save", p_version: 3, p_project_id: "p", p_brand_id: "b", p_passed: result.orderable });
    expect(result.findings.some((found) => found.code.startsWith("readiness-"))).toBe(false);
  });

  it("lets a version with no blocker through", async () => {
    await expect(assertOrderable({ admin: fake().admin, ports: UNWIRED_PORTS }, who, target)).resolves.toMatchObject({ orderable: true });
  });

  it("refuses a version with a blocker, after storing the result the database will read", async () => {
    const { admin, calls } = fake();
    await expect(assertOrderable({ admin, ports: blockedPorts }, who, target)).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("Factory file") });
    expect(calls[0]?.[1]).toMatchObject({ p_passed: false });
  });
});
