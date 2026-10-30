import { describe, expect, it } from "vitest";
import type { GateAnswer } from "@/lib/credits-gate/gate";
import { OUTPUT_KINDS, OUTPUT_LABELS } from "@/lib/credits/kinds";
import { CREDIT_SETTINGS } from "@/lib/credits/settings";
import { creditCharge, type PackageGate } from "./charge";
import { exportPackage, packageCreditKind } from "./export";
import { fixtureSources, JSY_BATCH, JSY_INPUT } from "./fixtures/jsy-ss-01";
import type { KppInput } from "./model";

/** The charge for a production package (owner decision 20), over the credits gate. */

const PAYING: KppInput = { ...JSY_INPUT, factory: { ...JSY_INPUT.factory, madeByKnitwright: false } };

const gateOf = (answer: GateAnswer) => {
  const asked: unknown[] = [];
  const gate: PackageGate = {
    check: async (request) => {
      asked.push(request);
      return answer;
    },
  };
  return { gate, asked };
};

describe("the production_package credit kind", () => {
  it("is one of the credit kinds, with a label a member reads and a placeholder price", () => {
    expect(OUTPUT_KINDS).toContain("production_package");
    expect(OUTPUT_LABELS.production_package).toBe("Production package");
    expect(CREDIT_SETTINGS.prices.production_package).toBeGreaterThanOrEqual(0);
    expect(CREDIT_SETTINGS.isPlaceholder).toBe(true);
  });

  it("is what a route charges for a brand's own export, and nothing for Knitwright's own run", () => {
    expect(packageCreditKind(PAYING)).toBe("production_package");
    expect(packageCreditKind(JSY_INPUT)).toBeNull();
    expect(packageCreditKind(JSY_BATCH)).toBeNull();
  });
});

describe("creditCharge", () => {
  it("asks the gate once, for the design's own version hash, and keeps the note for the answer", async () => {
    const { gate, asked } = gateOf({ ok: true, note: { price: 1, charged: true, balance: 4 } });
    const charging = creditCharge(gate, { brandId: "b1", userId: "u1" }, "GET /package");

    const result = await exportPackage(PAYING, fixtureSources(), charging.charge);

    expect(result.ok).toBe(true);
    expect(asked).toEqual([{ brandId: "b1", userId: "u1", kind: "production_package", designVersionHash: "a".repeat(64), where: "GET /package" }]);
    expect(charging.note()).toEqual({ price: 1, charged: true, balance: 4 });
  });

  it("does not ask the gate at all when the package is free", async () => {
    const { gate, asked } = gateOf({ ok: true, note: null });
    const charging = creditCharge(gate, { brandId: "b1", userId: "u1" }, "GET /package");

    await exportPackage(JSY_INPUT, fixtureSources(), charging.charge);

    expect(asked).toEqual([]);
    expect(charging.note()).toBeNull();
  });

  it("hands the gate's refusal back in its own words and builds nothing", async () => {
    const { gate } = gateOf({ ok: false, message: "Production package costs 1 credit. Your balance is 0.", price: 1, balance: 0 });
    const charging = creditCharge(gate, { brandId: "b1", userId: "u1" }, "GET /package");
    const sources = fixtureSources();

    const result = await exportPackage(PAYING, sources, charging.charge);

    expect(result).toEqual({ ok: false, reason: "refused", message: "Production package costs 1 credit. Your balance is 0." });
    expect(sources.calls).toEqual([]);
    expect(charging.note()).toBeNull();
  });

  it("never charges for a package the gate would refuse, so nobody pays to be told what is missing", async () => {
    const { gate, asked } = gateOf({ ok: true, note: { price: 1, charged: true, balance: 4 } });
    const charging = creditCharge(gate, { brandId: "b1", userId: "u1" }, "GET /package");

    const result = await exportPackage({ ...PAYING, poms: [] }, fixtureSources(), charging.charge);

    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === "blocked") expect(result.issues.map((issue) => issue.path)).toContain("poms");
    expect(asked).toEqual([]);
  });
});
