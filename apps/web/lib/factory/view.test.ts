import { describe, expect, it } from "vitest";
import { findField, parseFieldInput } from "./edit";
import { capabilityRows, countryRows, factoryRow, fabricRows, tierRows } from "./fixtures/rows";
import { fieldViews, textOf } from "./view";

/** What a form shows for a stored value. It must be the exact inverse of what the form accepts. */

const text = (table: string, column: string, row: Readonly<Record<string, unknown>>): string => textOf(findField(table, column)!, row);

describe("textOf", () => {
  it("shows money in major units and a cost with its currency", () => {
    expect(text("price_tiers", "sell_gbp_minor", tierRows[0]!)).toBe("29.00");
    expect(text("price_tiers", "sell_aud_minor", tierRows[0]!)).toBe("");
    expect(text("price_tiers", "cost_minor", { ...tierRows[0]!, cost_minor: 880, cost_currency: "USD" })).toBe("8.80 USD");
    expect(text("price_tiers", "cost_minor", tierRows[0]!)).toBe("");
  });

  it("shows a rate in percent and a list separated by commas", () => {
    expect(text("country_rules", "vat_rate_bp", countryRows[0]!)).toBe("20");
    expect(text("country_rules", "vat_rate_bp", countryRows[2]!)).toBe("");
    expect(text("factory_capabilities", "file_formats", capabilityRows[0]!)).toBe("pdf, svg, eps, dxf");
  });

  it("shows yes, no and not known", () => {
    expect(text("country_rules", "selling_enabled", countryRows[0]!)).toBe("yes");
    expect(text("country_rules", "selling_enabled", countryRows[2]!)).toBe("no");
    expect(text("programme_fabrics", "pfas_free", fabricRows[0]!)).toBe("");
    expect(text("programme_fabrics", "sublimatable", fabricRows[0]!)).toBe("yes");
  });

  it("shows certifications, duty and label rules in the shape the form reads back", () => {
    const certified = { ...factoryRow, certifications: [{ name: "OEKO-TEX", expiresOn: "2027-06-30" }, { name: "GRS", expiresOn: null }] };
    expect(text("factories", "certifications", certified)).toBe("OEKO-TEX = 2027-06-30\nGRS");
    expect(text("country_rules", "duty_by_hs", { ...countryRows[0]!, duty_by_hs: { "6110.30": 1200 } })).toBe("6110.30 = 12");
    expect(text("country_rules", "label_rules", countryRows[0]!)).toBe("{}");
    expect(text("country_rules", "label_rules", { ...countryRows[0]!, label_rules: null })).toBe("{}");
  });

  it("shows a plain number, a decimal and a rule id as typed", () => {
    expect(text("factory_capabilities", "lead_time_days", capabilityRows[0]!)).toBe("8");
    expect(text("factory_capabilities", "colour_delta_max", capabilityRows[0]!)).toBe("1.50");
    expect(text("factory_capabilities", "colour_delta_max", capabilityRows[1]!)).toBe("");
    // The row reaches the page through toCapability, which puts the numeric through Number() and so
    // drops the trailing zero the column keeps. Both decimals are shown either way.
    expect(text("factory_capabilities", "colour_delta_max", { ...capabilityRows[0]!, colour_delta_max: 1.2 })).toBe("1.20");
    expect(text("factory_capabilities", "colour_delta_max", { ...capabilityRows[0]!, colour_delta_max: 2 })).toBe("2.00");
    expect(text("factory_capabilities", "rule_id", capabilityRows[0]!)).toBe("R-GAP-000");
  });

  it("is the inverse of the form: what it shows, typed back, gives the stored value again", () => {
    const cases: readonly [string, string, Readonly<Record<string, unknown>>, string][] = [
      ["price_tiers", "sell_gbp_minor", tierRows[0]!, "sell_gbp_minor"],
      ["country_rules", "vat_rate_bp", countryRows[0]!, "vat_rate_bp"],
      ["factory_capabilities", "file_formats", capabilityRows[0]!, "file_formats"],
      ["factory_capabilities", "lead_time_days", capabilityRows[0]!, "lead_time_days"],
      ["country_rules", "selling_enabled", countryRows[0]!, "selling_enabled"],
      ["factories", "status", factoryRow, "status"],
      ["factory_capabilities", "rule_id", capabilityRows[0]!, "rule_id"],
    ];
    for (const [table, column, row, key] of cases) {
      const field = findField(table, column)!;
      const parsed = parseFieldInput(field, textOf(field, row));
      expect([table, column, parsed.ok && parsed.columns[key]]).toEqual([table, column, row[key]]);
    }
  });
});

describe("fieldViews", () => {
  it("gives one view per editable field of the table, each carrying the row's id", () => {
    const views = fieldViews("price_tiers", tierRows[0]!);
    expect(views.map((v) => v.column)).toEqual(["qty_min", "qty_max", "sell_gbp_minor", "sell_aud_minor", "cost_minor", "personalisation_cost_minor", "rule_id", "label"]);
    expect(views.every((v) => v.id === tierRows[0]!.id && v.table === "price_tiers")).toBe(true);
  });

  it("passes the choices of a choice field through, and none for the rest", () => {
    const views = fieldViews("factories", factoryRow);
    expect(views.find((v) => v.column === "status")?.choices).toEqual(["onboarding", "active", "paused", "retired"]);
    expect(views.find((v) => v.column === "name")?.choices).toEqual([]);
  });
});
