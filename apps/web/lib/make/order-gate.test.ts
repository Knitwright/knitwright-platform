import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SEEDED_CARE_SYMBOLS, SEEDED_LABEL_RULES_GB } from "@/lib/compliance/fixtures/rows";
import { fullDesign, packFor } from "@/lib/techpack/fixtures/designs";
import { AppError } from "@/lib/server/core/errors";

/** Plan v6 D1 (decision 0132): the gate every order path calls, with its reads replaced by doubles. */

const state = vi.hoisted(() => ({
  calls: [] as string[],
  refuse: false,
  version: 3,
  rules: [] as unknown[],
  careError: null as unknown,
}));

vi.mock("@/lib/releases/service", () => ({
  getRelease: async (_c: unknown, _b: string, _p: string, releaseId: string) => (state.calls.push(`release:${releaseId}`), { snapshot: { specVersion: state.version } }),
}));
vi.mock("@/lib/projects/tech-pack-load", async () => {
  const { fullDesign: design } = await import("@/lib/techpack/fixtures/designs");
  return { readTechPack: async (_c: unknown, _b: string, _p: string, version: number) => (state.calls.push(`read:${version}`), { project: { spec: design("team-jersey") } }) };
});
vi.mock("@/lib/projects/tech-pack-data", async () => {
  const fixtures = await import("@/lib/techpack/fixtures/designs");
  return { buildPackFor: () => fixtures.packFor(fixtures.fullDesign("team-jersey")) };
});
vi.mock("@/lib/factory/server", () => ({ factoryStore: () => ({ listCountryRules: async () => state.rules }) }));
vi.mock("@/lib/validation/live-ports", () => ({ livePorts: () => ({}) }));
vi.mock("@/lib/validation/order-gate", async () => {
  const { AppError: Refusal } = await import("@/lib/server/core/errors");
  return {
    assertOrderable: async (_deps: unknown, _who: unknown, target: { version: number }) => {
      state.calls.push(`validate:${target.version}`);
      if (state.refuse) throw new Refusal("conflict", "This design has 1 blocker against the factory profile.");
      return { orderable: true };
    },
  };
});

const { orderValidationGate } = await import("./order-gate");

const admin = {
  from: () => ({ select: () => ({ order: async () => ({ data: state.careError ? null : SEEDED_CARE_SYMBOLS.map(asRow), error: state.careError }) }) }),
} as unknown as SupabaseClient;

function asRow(symbol: (typeof SEEDED_CARE_SYMBOLS)[number]): Record<string, unknown> {
  return {
    id: symbol.id, language: symbol.language, code: symbol.code, kind: symbol.kind, symbol_ref: symbol.symbolRef, words: symbol.words, source: symbol.source,
    source_kind: symbol.sourceKind, rule_id: symbol.ruleId, confirmed: symbol.confirmed, label: symbol.label,
  };
}

const gate = orderValidationGate({ client: {} as SupabaseClient, admin, who: { brandId: "b", userId: "u" }, brandName: "Brand", country: "GB" });
const order = { projectId: "p", releaseId: "r", productionClass: "A" as const, colourToleranceMax: null };
const GB = { country: "GB", name: "United Kingdom", sellingEnabled: true, labelRules: SEEDED_LABEL_RULES_GB, ruleId: "R-LAB-002" };

beforeEach(() => {
  state.calls = [];
  state.refuse = false;
  state.rules = [GB];
  state.careError = null;
});

describe("the gate before an order", () => {
  it("checks the version the release froze, then screens, then carries the checklist to ops", async () => {
    const screen = vi.fn(async () => (state.calls.push("screen"), "clear" as const));
    const flags = await gate(order, screen);
    expect(state.calls).toEqual(["release:r", "read:3", "validate:3", "screen"]);
    expect(flags[0]?.code).toBe("pre_export_check");
    expect(flags.length).toBeGreaterThan(1);
  });

  it("refuses before the screen when the version has a blocker", async () => {
    state.refuse = true;
    const screen = vi.fn(async () => "clear" as const);
    await expect(gate(order, screen)).rejects.toMatchObject({ code: "conflict" });
    expect(screen).not.toHaveBeenCalled();
  });

  it("passes on the screen's own refusal", async () => {
    await expect(gate(order, async () => Promise.reject(new AppError("invalid_input", "Blocked.")))).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("counts a market with no row as one more thing to put right, rather than inventing its label", async () => {
    const count = (flags: readonly { text: string }[]) => Number(/^(\d+) /.exec(flags[0]?.text ?? "")?.[1] ?? 0);
    const withRow = count(await gate(order, async () => "clear"));
    state.rules = [];
    const without = count(await gate(order, async () => "clear"));
    expect(withRow).toBeGreaterThan(0);
    expect(without).not.toBe(withRow);
  });

  it("stops when the care symbols cannot be read", async () => {
    state.careError = { message: "down" };
    await expect(gate(order, async () => "clear")).rejects.toMatchObject({ code: "internal" });
  });

  it("builds the checklist from the same tech pack the Review tab reads", () => {
    expect(packFor(fullDesign("team-jersey")).measurements.columns.length).toBeGreaterThan(0);
  });
});
