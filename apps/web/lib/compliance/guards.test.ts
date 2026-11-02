import { describe, expect, it } from "vitest";
import { fixtureFabric } from "./fixtures/rows";
import {
  cpsiaFindings,
  destinationGuards,
  marketFindings,
  oekoTexCertificate,
  pfasFindings,
  whyDestinationRefused,
  type DestinationGuardInput,
} from "./guards";

const input = (over: Partial<DestinationGuardInput> = {}): DestinationGuardInput => ({
  country: "GB",
  countryName: "United Kingdom",
  sellingEnabled: true,
  cpsiaRequired: false,
  wearer: "men",
  cpsiaCertificate: null,
  fabric: fixtureFabric(),
  ruleId: "R-LAB-002",
  ...over,
});

describe("PFAS-free finishes only (R-LAB-003)", () => {
  it("lets a fabric a mill has declared PFAS-free through", () => {
    expect(pfasFindings(input())).toEqual([]);
  });

  it("refuses a fabric recorded as not PFAS-free, and says why", () => {
    const [found] = pfasFindings(input({ fabric: fixtureFabric({ pfasFree: false }) }));
    expect(found).toMatchObject({ code: "pfas_not_declared", severity: "blocker", ruleId: "R-LAB-003" });
    expect(found?.message).toContain("not PFAS-free");
  });

  it("refuses a fabric nobody has declared either way rather than assuming it is clean", () => {
    const [found] = pfasFindings(input({ fabric: fixtureFabric({ pfasFree: null }) }));
    expect(found?.severity).toBe("blocker");
    expect(found?.message).toContain("Ask the mill for a PFAS-free declaration");
  });

  it("refuses when no fabric is chosen at all", () => {
    expect(pfasFindings(input({ fabric: null }))[0]).toMatchObject({ code: "fabric_not_chosen", ruleId: "R-LAB-003" });
  });
});

describe("the United States and children's sizes, blocked until CPSIA testing exists", () => {
  it("lets an adult garment into a market that does not need CPSIA testing", () => {
    expect(cpsiaFindings(input())).toEqual([]);
  });

  it("refuses a market that needs CPSIA testing while no certificate is on file", () => {
    const found = cpsiaFindings(input({ country: "US", countryName: "United States", cpsiaRequired: true }));
    expect(found[0]).toMatchObject({ code: "cpsia_required", severity: "blocker" });
  });

  it("refuses youth sizes wherever they are sold", () => {
    const found = cpsiaFindings(input({ wearer: "youth" }));
    expect(found[0]).toMatchObject({ code: "cpsia_childrens_sizes", severity: "blocker" });
    expect(found[0]?.message).toContain("wherever they are sold");
  });

  it("lets both through once a test certificate exists", () => {
    expect(cpsiaFindings(input({ wearer: "youth", cpsiaRequired: true, cpsiaCertificate: "CPSIA-2027-001" }))).toEqual([]);
  });

  it("notes, rather than passes, a market whose row does not say whether CPSIA applies", () => {
    const [found] = cpsiaFindings(input({ cpsiaRequired: null }));
    expect(found).toMatchObject({ code: "cpsia_not_recorded", severity: "warning", ruleId: "R-GAP-000" });
  });
});

describe("a market the platform does not sell into", () => {
  it("is refused, with the market row's own rule id", () => {
    const [found] = marketFindings(input({ sellingEnabled: false }));
    expect(found).toMatchObject({ code: "market_closed", severity: "blocker", ruleId: "R-LAB-002" });
  });

  it("says nothing about a market that is open", () => {
    expect(marketFindings(input())).toEqual([]);
  });
});

describe("OEKO-TEX, shown only where the fabric has it", () => {
  it("gives the certificate when the fabric row holds one", () => {
    expect(oekoTexCertificate(fixtureFabric({ oekoTexCert: "20.HPK.12345" }))).toBe("20.HPK.12345");
  });

  it("gives nothing for a fabric with no certificate, and nothing for no fabric", () => {
    expect(oekoTexCertificate(fixtureFabric())).toBeNull();
    expect(oekoTexCertificate(null)).toBeNull();
  });
});

describe("every guardrail at once", () => {
  it("is empty for an open market, a declared fabric and an adult garment", () => {
    expect(destinationGuards(input())).toEqual([]);
    expect(whyDestinationRefused([])).toBeNull();
  });

  it("names the closed market, the undeclared fabric and the youth sizes together", () => {
    const found = destinationGuards(
      input({ country: "US", countryName: "United States", sellingEnabled: false, cpsiaRequired: true, wearer: "youth", fabric: fixtureFabric({ pfasFree: null }) }),
    );
    expect(found.map((one) => one.code)).toEqual(["market_closed", "pfas_not_declared", "cpsia_required", "cpsia_childrens_sizes"]);
    expect(whyDestinationRefused(found)).toContain("United States is not a market");
  });

  it("is the same list every time, for the same input", () => {
    expect(destinationGuards(input({ wearer: "youth" }))).toEqual(destinationGuards(input({ wearer: "youth" })));
  });
});
