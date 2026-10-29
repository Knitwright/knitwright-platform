import { describe, expect, it } from "vitest";
import { capabilityRows, colourRows, countryRows, factoryRow, fabricRows, ids, tierRows } from "./fixtures/rows";
import { rowsOf, toCapability, toColour, toCountryRule, toFabric, toFactory, toTier } from "./rows";

/** Database rows to the app's shapes. Every row is checked on the way in, so a bad row fails loudly. */

describe("toFactory", () => {
  it("renames the columns and defaults the certifications to none", () => {
    expect(toFactory(factoryRow)).toMatchObject({ slug: "sialkot-partner", timeZone: "Asia/Karachi", contactWhatsapp: null, certifications: [], status: "onboarding" });
    expect(toFactory({ ...factoryRow, certifications: null }).certifications).toEqual([]);
  });

  it("refuses a status or a time zone the schema does not allow", () => {
    expect(() => toFactory({ ...factoryRow, status: "busy" })).toThrow();
    expect(() => toFactory({ ...factoryRow, country: "Pakistan" })).toThrow();
  });
});

describe("toCapability", () => {
  it("turns a numeric column that comes back as text into a number", () => {
    expect(toCapability(capabilityRows[0]!)).toMatchObject({ articleCode: "JSY-SS-01", leadTimeDays: 8, moq: 1, weeklySlotCapacity: null, colourDeltaMax: 1.5, ruleId: "R-GAP-000" });
  });

  it("keeps a missing garment type and missing formats as nothing, never a guess", () => {
    expect(toCapability({ ...capabilityRows[0]!, garment_type_id: null, file_formats: null })).toMatchObject({ garmentTypeId: null, fileFormats: [] });
  });
});

describe("toTier", () => {
  it("pairs a cost with its currency and leaves an unset cost null", () => {
    expect(toTier(tierRows[0]!)).toMatchObject({ qtyMin: 10, qtyMax: 19, sellGbpMinor: 2900, cost: null, ruleId: "R-COST-003" });
    expect(toTier({ ...tierRows[0]!, cost_minor: 880, cost_currency: "USD" }).cost).toEqual({ minor: 880, currency: "USD" });
  });
});

describe("toFabric and toColour", () => {
  it("reads the fabric's spec card and its rule", () => {
    expect(toFabric(fabricRows[0]!)).toMatchObject({ code: "F-POLY-INT", productionClass: "A", gsmMin: 140, gsmMax: 160, sublimatable: true, ruleId: "R-SUB-001" });
    expect(toFabric(fabricRows[1]!)).toMatchObject({ code: "F-STK-TEE", productionClass: "B", gsmMin: null, sublimatable: null, ruleId: "R-GAP-000" });
  });

  it("keeps Lab only when all three readings are there", () => {
    expect(toColour(colourRows[0]!).lab).toBeNull();
    expect(toColour({ ...colourRows[0]!, lab_l: "20.1", lab_a: "4.0", lab_b: "-18.5" }).lab).toEqual([20.1, 4, -18.5]);
    expect(toColour({ ...colourRows[0]!, lab_l: "20.1", lab_a: "4.0" }).lab).toBeNull();
  });
});

describe("toCountryRule", () => {
  it("reads a market's rules, with the empty objects the database defaults to", () => {
    expect(toCountryRule(countryRows[0]!)).toMatchObject({ country: "GB", currency: "GBP", vatRateBp: 2000, dutyByHs: {}, labelRules: {}, freightDays: 4, sellingEnabled: true });
    expect(toCountryRule(countryRows[2]!)).toMatchObject({ country: "US", vatRateBp: null, sellingEnabled: false });
  });

  it("reads duty as basis points per HS code", () => {
    expect(toCountryRule({ ...countryRows[0]!, duty_by_hs: { "6110.30": 1200 } }).dutyByHs).toEqual({ "6110.30": 1200 });
    expect(() => toCountryRule({ ...countryRows[0]!, duty_by_hs: { nonsense: 1200 } })).toThrow();
  });
});

describe("rowsOf", () => {
  it("accepts nothing as no rows and refuses something that is not a list of rows", () => {
    expect(rowsOf(null)).toEqual([]);
    expect(rowsOf([{ id: ids.factory }])).toEqual([{ id: ids.factory }]);
    expect(() => rowsOf("not rows")).toThrow();
  });
});
