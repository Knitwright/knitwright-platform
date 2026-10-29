import { describe, expect, it } from "vitest";
import { EDITABLE_FIELDS, fieldsOf, findField, parseFieldInput, toBasisPoints, toMinor } from "./edit";
import { FACTORY_TABLES } from "./store";

/**
 * What a platform admin may type, and what it becomes. Money is typed in major units and stored in minor
 * units exactly (no floating point), and a rate is typed in percent and stored in basis points.
 */

const parse = (table: string, column: string, value: string) => parseFieldInput(findField(table, column)!, value);

describe("the editable fields", () => {
  it("covers only tables of the factory model, and names a label for each", () => {
    for (const field of EDITABLE_FIELDS) {
      expect(FACTORY_TABLES, field.column).toContain(field.table);
      expect(field.label.length, field.column).toBeGreaterThan(2);
    }
    expect(fieldsOf("factories").length).toBeGreaterThan(5);
    expect(findField("factories", "id")).toBeUndefined();
    expect(findField("not_a_table", "name")).toBeUndefined();
  });

  it("lets every table that carries a range, an option or a term say which rule explains it", () => {
    for (const table of ["factory_capabilities", "price_tiers", "programme_fabrics", "country_rules"] as const) {
      expect(findField(table, "rule_id"), table).toBeDefined();
    }
  });

  it("never lets an id, a factory link or a bookkeeping column be typed over", () => {
    for (const column of ["id", "factory_id", "capability_id", "code", "country", "slug", "updated_by", "created_at"]) {
      expect(EDITABLE_FIELDS.filter((f) => f.column === column), column).toEqual([]);
    }
  });
});

describe("toMinor and toBasisPoints", () => {
  it("reads whole, one-place and two-place amounts exactly", () => {
    expect([toMinor("29"), toMinor("29.5"), toMinor("29.50"), toMinor("0.07")]).toEqual([2900, 2950, 2950, 7]);
    expect([toMinor("29.555"), toMinor("-1"), toMinor("abc"), toMinor("")]).toEqual([null, null, null, null]);
  });

  it("reads a percentage as basis points and refuses more than 100%", () => {
    expect([toBasisPoints("20"), toBasisPoints("12.5"), toBasisPoints("100")]).toEqual([2000, 1250, 10_000]);
    expect([toBasisPoints("100.01"), toBasisPoints("x")]).toEqual([null, null]);
  });
});

describe("parseFieldInput", () => {
  it("writes text, and refuses an empty required one while clearing an optional one", () => {
    expect(parse("factories", "name", " Sialkot partner ")).toEqual({ ok: true, columns: { name: "Sialkot partner" } });
    expect(parse("factories", "name", "")).toMatchObject({ ok: false });
    expect(parse("factories", "contact_whatsapp", "")).toEqual({ ok: true, columns: { contact_whatsapp: null } });
  });

  it("checks a WhatsApp number, a time zone, a hex colour and a rule id", () => {
    expect(parse("factories", "contact_whatsapp", "+923001234567")).toMatchObject({ ok: true });
    expect(parse("factories", "contact_whatsapp", "03001234567")).toMatchObject({ ok: false, message: expect.stringContaining("country code") });
    expect(parse("factories", "time_zone", "Asia/Karachi")).toMatchObject({ ok: true });
    expect(parse("factories", "time_zone", "Mars/Olympus")).toMatchObject({ ok: false });
    expect(parse("programme_fabric_colours", "hex", "#1F2A44")).toMatchObject({ ok: true });
    expect(parse("programme_fabric_colours", "hex", "1f2a44")).toMatchObject({ ok: false });
    expect(parse("price_tiers", "rule_id", "R-SUB-005")).toEqual({ ok: true, columns: { rule_id: "R-SUB-005" } });
    expect(parse("price_tiers", "rule_id", "sub-5")).toMatchObject({ ok: false, message: expect.stringContaining("R-GAP-000") });
  });

  it("refuses text that is too long", () => {
    expect(parse("factories", "label", "x".repeat(201))).toMatchObject({ ok: false });
  });

  it("reads whole numbers inside their range and clears an empty one", () => {
    expect(parse("factory_capabilities", "lead_time_days", "8")).toEqual({ ok: true, columns: { lead_time_days: 8 } });
    expect(parse("factory_capabilities", "lead_time_days", "")).toEqual({ ok: true, columns: { lead_time_days: null } });
    expect(parse("factory_capabilities", "lead_time_days", "8.5")).toMatchObject({ ok: false, message: "Give a whole number." });
    expect(parse("factory_capabilities", "lead_time_days", "400")).toMatchObject({ ok: false, message: "Use a number from 1 to 365." });
    expect(parse("factory_capabilities", "colour_delta_max", "1.5")).toEqual({ ok: true, columns: { colour_delta_max: 1.5 } });
    expect(parse("factory_capabilities", "colour_delta_max", "nonsense")).toMatchObject({ ok: false, message: "Give a number." });
  });

  it("reads money, a cost with its currency, and a percentage", () => {
    expect(parse("price_tiers", "sell_gbp_minor", "29.00")).toEqual({ ok: true, columns: { sell_gbp_minor: 2900 } });
    expect(parse("price_tiers", "sell_gbp_minor", "")).toEqual({ ok: true, columns: { sell_gbp_minor: null } });
    expect(parse("price_tiers", "sell_gbp_minor", "£29")).toMatchObject({ ok: false });
    expect(parse("price_tiers", "cost_minor", "8.80 USD")).toEqual({ ok: true, columns: { cost_minor: 880, cost_currency: "USD" } });
    expect(parse("price_tiers", "cost_minor", "")).toEqual({ ok: true, columns: { cost_minor: null, cost_currency: null } });
    expect(parse("price_tiers", "cost_minor", "8.80")).toMatchObject({ ok: false });
    expect(parse("country_rules", "vat_rate_bp", "20")).toEqual({ ok: true, columns: { vat_rate_bp: 2000 } });
    expect(parse("country_rules", "vat_rate_bp", "")).toEqual({ ok: true, columns: { vat_rate_bp: null } });
    expect(parse("country_rules", "vat_rate_bp", "200")).toMatchObject({ ok: false });
  });

  it("reads yes and no, with and without a not-known answer", () => {
    expect(parse("country_rules", "selling_enabled", "yes")).toEqual({ ok: true, columns: { selling_enabled: true } });
    expect(parse("country_rules", "selling_enabled", "")).toMatchObject({ ok: false });
    expect(parse("programme_fabrics", "pfas_free", "")).toEqual({ ok: true, columns: { pfas_free: null } });
    expect(parse("programme_fabrics", "pfas_free", "no")).toEqual({ ok: true, columns: { pfas_free: false } });
    expect(parse("programme_fabrics", "pfas_free", "maybe")).toMatchObject({ ok: false });
  });

  it("reads a choice only from its own list", () => {
    expect(parse("factories", "status", "active")).toEqual({ ok: true, columns: { status: "active" } });
    expect(parse("factories", "status", "busy")).toMatchObject({ ok: false });
  });

  it("reads a comma-separated list in lower case and refuses a silly one", () => {
    expect(parse("factory_capabilities", "file_formats", "PDF, dxf , ")).toEqual({ ok: true, columns: { file_formats: ["pdf", "dxf"] } });
    expect(parse("factory_capabilities", "file_formats", "x".repeat(17))).toMatchObject({ ok: false });
    expect(parse("factory_capabilities", "file_formats", Array.from({ length: 21 }, (_, i) => `f${i}`).join(","))).toMatchObject({ ok: false });
  });

  it("reads certifications one per line, with or without an expiry", () => {
    expect(parse("factories", "certifications", "OEKO-TEX = 2027-06-30\nGRS\n\n")).toEqual({
      ok: true,
      columns: { certifications: [{ name: "OEKO-TEX", expiresOn: "2027-06-30", documentRef: null }, { name: "GRS", expiresOn: null, documentRef: null }] },
    });
    expect(parse("factories", "certifications", " = 2027-06-30")).toMatchObject({ ok: false });
    expect(parse("factories", "certifications", "OEKO-TEX = soon")).toMatchObject({ ok: false });
  });

  it("reads duty one HS code per line, in percent", () => {
    expect(parse("country_rules", "duty_by_hs", "6110.30 = 12\n6109.10 = 10.5")).toEqual({ ok: true, columns: { duty_by_hs: { "6110.30": 1200, "6109.10": 1050 } } });
    expect(parse("country_rules", "duty_by_hs", "")).toEqual({ ok: true, columns: { duty_by_hs: {} } });
    expect(parse("country_rules", "duty_by_hs", "shirts = 12")).toMatchObject({ ok: false, message: expect.stringContaining("shirts = 12") });
  });

  it("reads label rules as a JSON object and nothing else", () => {
    expect(parse("country_rules", "label_rules", '{"careLabel": true}')).toEqual({ ok: true, columns: { label_rules: { careLabel: true } } });
    expect(parse("country_rules", "label_rules", "")).toEqual({ ok: true, columns: { label_rules: {} } });
    expect(parse("country_rules", "label_rules", "[1]")).toMatchObject({ ok: false });
    expect(parse("country_rules", "label_rules", "{oops")).toMatchObject({ ok: false });
  });
});
