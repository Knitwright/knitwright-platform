import { describe, expect, it } from "vitest";
import { chargeDecision, exportPackage, PACKAGE_OUTPUT_KIND, packageFileName, type ChargeForPackage } from "./export";
import { fixtureSources, JSY_BATCH, JSY_INPUT } from "./fixtures/jsy-ss-01";
import type { KppInput } from "./model";

/** Exporting the package: who pays, what the file is called and what is recorded. */

const PAYING: KppInput = { ...JSY_INPUT, factory: { ...JSY_INPUT.factory, madeByKnitwright: false } };

describe("chargeDecision", () => {
  it("is free when Knitwright makes the order, per spec decision 9", () => {
    expect(chargeDecision(JSY_INPUT)).toEqual({ charge: false, why: "Knitwright makes this order, so the package is included." });
  });

  it("is free for a production batch, which is Knitwright's own run", () => {
    expect(chargeDecision({ ...JSY_BATCH, factory: { ...JSY_BATCH.factory, madeByKnitwright: false } })).toMatchObject({ charge: false });
  });

  it("charges when a brand takes the files elsewhere", () => {
    expect(chargeDecision(PAYING)).toEqual({ charge: true, kind: PACKAGE_OUTPUT_KIND });
  });
});

describe("packageFileName", () => {
  it("names the ZIP after the design, the version and the factory", () => {
    expect(packageFileName(JSY_INPUT)).toBe("KPP_ACME_Home_Kit_v3_SKT-01.zip");
    expect(packageFileName(JSY_BATCH)).toBe("KPP_ACME_Home_Kit_v3_SKT-01_batch.zip");
  });

  it("makes a name safe to save from a design name a person typed", () => {
    expect(packageFileName({ ...JSY_INPUT, design: { ...JSY_INPUT.design, code: "../Acme FC / kit" } })).toBe("KPP_Acme_FC_kit_v3_SKT-01.zip");
  });
});

describe("exportPackage", () => {
  it("builds the ZIP and records what it built, including the ZIP's own hash", async () => {
    const result = await exportPackage(JSY_INPUT, fixtureSources());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record).toMatchObject({
      root: "KPP_ACME_Home_Kit_v3_SKT-01",
      fileName: "KPP_ACME_Home_Kit_v3_SKT-01.zip",
      designCode: "ACME_Home_Kit",
      designVersion: 3,
      designHash: "a".repeat(64),
      factoryCode: "SKT-01",
      kind: "sample",
      builtFor: "2026-10-25T09:30:00.000Z",
    });
    expect(result.record.zipSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.record.zipBytes).toBe(result.zip.length);
    expect(result.record.fileCount).toBe(result.files.length);
  });

  it("records the same hash for the same version twice", async () => {
    const a = await exportPackage(JSY_INPUT, fixtureSources());
    const b = await exportPackage(JSY_INPUT, fixtureSources());
    expect(a.ok && b.ok && a.record.zipSha256).toBe(b.ok ? b.record.zipSha256 : "");
  });

  it("hands the gate's refusals back without building anything", async () => {
    const input: KppInput = { ...JSY_INPUT, poms: [] };
    const result = await exportPackage(input, fixtureSources());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("blocked");
    if (result.reason === "blocked") expect(result.issues.map((i) => i.message)).toContain("Points of measure: none are listed.");
  });

  it("charges before the work, and does not build when the charge is refused", async () => {
    const sources = fixtureSources();
    const asked: unknown[] = [];
    const charge: ChargeForPackage = {
      charge: async (decision) => {
        asked.push(decision);
        return "You need 1 more credit to download this package.";
      },
    };
    const result = await exportPackage(PAYING, sources, charge);
    expect(result).toEqual({ ok: false, reason: "refused", message: "You need 1 more credit to download this package." });
    // Nothing was built: the print source was never asked for a file.
    expect(sources.calls).toEqual([]);
    expect(asked).toEqual([{ charge: true, kind: PACKAGE_OUTPUT_KIND }]);
  });

  it("tells the charge that a Knitwright order is free", async () => {
    const seen: unknown[] = [];
    await exportPackage(JSY_INPUT, fixtureSources(), { charge: async (d) => (seen.push(d), null) });
    expect(seen).toEqual([{ charge: false, why: "Knitwright makes this order, so the package is included." }]);
  });
});
