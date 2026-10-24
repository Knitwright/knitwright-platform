import { describe, expect, it } from "vitest";
import { listTypes } from "@/lib/garment";
import { defaultFactoryProfile, type FactoryProfile } from "./profile";
import { createCheckRegistry, type DesignInput } from "./registry";
import { doubleModule } from "./testing";
import { validateDesign } from "./validate";

const typeId = listTypes()[0]!.id;
const line = (id: string, met: boolean, whoActs: "owner" | "print-house" = "owner") => ({ id, met, sentence: `Sentence for ${id}.`, whoActs, actorLabel: "You", ownerInput: null });
const readiness = (groups: { id: string; title: string; ids: [string, boolean][] }[]): DesignInput["readiness"] => ({
  groups: groups.map((g) => ({ id: g.id, title: g.title, items: g.ids.map(([id, met]) => line(id, met)) })),
});
const design = (over: Partial<DesignInput> = {}): DesignInput => ({ typeId, readiness: readiness([]), ...over });
const profile = (over: Partial<FactoryProfile> = {}): FactoryProfile => ({ ...defaultFactoryProfile(), ...over });
const codes = (result: ReturnType<typeof validateDesign>) => result.findings.map((f) => f.code);

describe("validateDesign", () => {
  it("blocks an article the profile does not list", () => {
    const result = validateDesign(design({ typeId: "not-a-garment" }), profile());
    expect(codes(result)).toEqual(["article-not-made"]);
    expect(result.orderable).toBe(false);
    expect(result.findings[0]?.fix.whoActs).toBe("owner");
  });

  it("warns, and does not block, about a MOQ, price ladder and lead time that are not set", () => {
    const result = validateDesign(design(), profile());
    expect(codes(result).sort()).toEqual(["lead-time-not-set", "moq-not-set", "price-ladder-not-set"]);
    expect(result.blockers).toBe(0);
    expect(result.warnings).toBe(3);
    expect(result.orderable).toBe(true);
  });

  it("raises no profile warning when the profile sets them", () => {
    const set: FactoryProfile = {
      ...profile(),
      articles: [{ typeId, moq: { status: "set", value: 10 } }],
      leadTimeDays: { status: "set", value: 30 },
      priceLadder: { status: "set", value: [{ fromPieces: 10, unitPrice: 1 }] },
    };
    expect(validateDesign(design(), set).findings).toEqual([]);
  });

  it("turns a missing fabric test into a named blocker that names who acts", () => {
    const result = validateDesign(design({ readiness: readiness([{ id: "fabric", title: "Fabric", ids: [["fabric-test", false]] }]) }), profile());
    const found = result.findings.find((f) => f.code === "readiness-fabric-test");
    expect(found).toMatchObject({ severity: "blocker", article: typeId });
    expect(found?.message).toContain("Fabric:");
    expect(result.orderable).toBe(false);
  });

  it("makes open proof, order and release items warnings, and skips met items", () => {
    const result = validateDesign(
      design({ readiness: readiness([{ id: "proof", title: "Proof", ids: [["proof-strike-off", false], ["x-met", true]] }, { id: "order", title: "Order", ids: [["order-roster", false]] }]) }),
      profile(),
    );
    expect(result.findings.filter((f) => f.code.startsWith("readiness-")).every((f) => f.severity === "warning")).toBe(true);
    expect(codes(result)).not.toContain("readiness-x-met");
  });

  it("adds no readiness finding when readiness was not built", () => {
    expect(codes(validateDesign(design({ readiness: null }), profile())).some((c) => c.startsWith("readiness-"))).toBe(false);
  });

  it("runs registered modules", () => {
    const result = validateDesign(design(), profile(), createCheckRegistry([doubleModule("dpi")]));
    expect(codes(result)).toContain("double-found");
  });

  it("turns a module that throws into a blocker", () => {
    const broken = { id: "broken", run: () => { throw new Error("boom"); } };
    const result = validateDesign(design(), profile(), createCheckRegistry([broken]));
    expect(result.findings.find((f) => f.code === "check-failed")?.severity).toBe("blocker");
  });

  it("lists blockers before warnings", () => {
    const result = validateDesign(design({ readiness: readiness([{ id: "fabric", title: "Fabric", ids: [["fabric-test", false]] }]) }), profile());
    expect(result.findings[0]?.severity).toBe("blocker");
  });
});
