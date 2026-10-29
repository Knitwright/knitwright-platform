import { z } from "zod";
import { FACTORY_STATUSES, GOLDEN_SAMPLE_STATUSES, certificationSchema, ruleIdSchema } from "./schemas";
import type { FactoryTable } from "./store";
import { isTimeZone } from "./zoned";

/**
 * What the ops page lets a platform admin change, one field at a time (decision 0071), and how the typed text
 * becomes column values. A field not listed here cannot be changed from the page. Money is typed in major units
 * ("29.00") and stored in minor units; rates are typed in percent ("20") and stored in basis points.
 */

export type FieldKind =
  | "text"
  | "optionalText"
  | "optionalNumber"
  | "optionalDecimal"
  | "money"
  | "costMoney"
  | "percent"
  | "boolean"
  | "optionalBoolean"
  | "choice"
  | "list"
  | "certifications"
  | "dutyLines"
  | "json";

export interface EditableField {
  readonly table: FactoryTable;
  readonly column: string;
  readonly label: string;
  readonly kind: FieldKind;
  readonly choices?: readonly string[];
  readonly min?: number;
  readonly max?: number;
  /** A further check on text values, with its message. */
  readonly check?: readonly [(value: string) => boolean, string];
}

const f = (table: FactoryTable, column: string, label: string, kind: FieldKind, extra: Partial<EditableField> = {}): EditableField => ({ table, column, label, kind, ...extra });

const SLUG: readonly [(v: string) => boolean, string] = [(v) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v) && v.length <= 64, "Use a garment type id such as football-shirt."];
const WHATSAPP: readonly [(v: string) => boolean, string] = [(v) => /^\+[1-9][0-9]{6,14}$/.test(v), "Give the number with its country code, such as +923001234567."];
const HEX: readonly [(v: string) => boolean, string] = [(v) => /^#[0-9A-F]{6}$/.test(v), "Give a colour as # and six capital hex digits, such as #1F2A44."];
const ZONE: readonly [(v: string) => boolean, string] = [isTimeZone, "Give a time zone such as Asia/Karachi."];
const RULE: readonly [(v: string) => boolean, string] = [(v) => ruleIdSchema.safeParse(v).success, "Give a rule id such as R-SUB-005, or R-GAP-000 while none is written."];

/** "Which rule explains this", on every table that carries a range, an option or a term. */
const ruleField = (table: FactoryTable): EditableField => f(table, "rule_id", "Rule that explains these values", "text", { check: RULE });

export const EDITABLE_FIELDS: readonly EditableField[] = [
  f("factories", "name", "Name", "text"),
  f("factories", "city", "City", "text"),
  f("factories", "time_zone", "Time zone (the cut-off is read on this clock)", "text", { check: ZONE }),
  f("factories", "contact_whatsapp", "WhatsApp number", "optionalText", { check: WHATSAPP }),
  f("factories", "certifications", "Certifications (one per line: name = expiry date or blank)", "certifications"),
  f("factories", "status", "Status", "choice", { choices: FACTORY_STATUSES }),
  f("factories", "label", "Source", "text"),
  f("factory_capabilities", "garment_type_id", "Garment type it is made as", "optionalText", { check: SLUG }),
  f("factory_capabilities", "lead_time_days", "Lead time (working days)", "optionalNumber", { min: 1, max: 365 }),
  f("factory_capabilities", "moq", "Minimum order (pieces)", "optionalNumber", { min: 1, max: 1_000_000 }),
  f("factory_capabilities", "weekly_slot_capacity", "Weekly Class A slot (pieces)", "optionalNumber", { min: 0, max: 1_000_000 }),
  f("factory_capabilities", "file_formats", "File formats (comma separated)", "list"),
  f("factory_capabilities", "golden_sample_status", "Golden sample", "choice", { choices: GOLDEN_SAMPLE_STATUSES }),
  f("factory_capabilities", "colour_delta_max", "Largest colour difference (delta E)", "optionalDecimal", { min: 0, max: 100 }),
  ruleField("factory_capabilities"),
  f("factory_capabilities", "label", "Source", "text"),
  f("price_tiers", "qty_min", "From (pieces)", "optionalNumber", { min: 1, max: 1_000_000 }),
  f("price_tiers", "qty_max", "To (pieces, blank for no limit)", "optionalNumber", { min: 1, max: 1_000_000 }),
  f("price_tiers", "sell_gbp_minor", "Sell price GBP per piece", "money"),
  f("price_tiers", "sell_aud_minor", "Sell price AUD per piece", "money"),
  f("price_tiers", "cost_minor", "Factory cost per piece, with currency (8.80 USD)", "costMoney"),
  f("price_tiers", "personalisation_cost_minor", "Personalisation cost per piece (cost currency)", "money"),
  ruleField("price_tiers"),
  f("price_tiers", "label", "Source", "text"),
  f("programme_fabrics", "name", "Name", "text"),
  f("programme_fabrics", "blend", "Fibre blend", "text"),
  f("programme_fabrics", "gsm_min", "Weight from (gsm)", "optionalNumber", { min: 1, max: 2000 }),
  f("programme_fabrics", "gsm_max", "Weight to (gsm)", "optionalNumber", { min: 1, max: 2000 }),
  f("programme_fabrics", "stretch", "Stretch", "optionalText"),
  f("programme_fabrics", "finish", "Finish", "optionalText"),
  f("programme_fabrics", "pfas_free", "PFAS free", "optionalBoolean"),
  f("programme_fabrics", "oeko_tex_cert", "OEKO-TEX certificate", "optionalText"),
  f("programme_fabrics", "sublimatable", "Takes sublimation", "optionalBoolean"),
  f("programme_fabrics", "swatch_ref", "Swatch reference", "optionalText"),
  ruleField("programme_fabrics"),
  f("programme_fabrics", "label", "Source", "text"),
  f("programme_fabric_colours", "name", "Name", "text"),
  f("programme_fabric_colours", "hex", "Hex", "text", { check: HEX }),
  f("programme_fabric_colours", "pantone", "Pantone", "optionalText"),
  f("programme_fabric_colours", "label", "Source", "text"),
  f("country_rules", "vat_rate_bp", "VAT or GST (%)", "percent"),
  f("country_rules", "low_value_threshold_minor", "Low-value threshold (country currency)", "money"),
  f("country_rules", "duty_by_hs", "Duty by HS code (one per line: 6110.30 = 12)", "dutyLines"),
  f("country_rules", "preference_scheme", "Preference scheme", "optionalText"),
  f("country_rules", "label_rules", "Label rules (JSON object)", "json"),
  f("country_rules", "freight_days", "Freight (calendar days)", "optionalNumber", { min: 0, max: 120 }),
  f("country_rules", "selling_enabled", "Selling open", "boolean"),
  ruleField("country_rules"),
  f("country_rules", "label", "Source", "text"),
];

export const findField = (table: string, column: string): EditableField | undefined =>
  EDITABLE_FIELDS.find((field) => field.table === table && field.column === column);

export const fieldsOf = (table: FactoryTable): readonly EditableField[] => EDITABLE_FIELDS.filter((field) => field.table === table);

export type ParsedEdit = { readonly ok: true; readonly columns: Readonly<Record<string, unknown>> } | { readonly ok: false; readonly message: string };

const fail = (message: string): ParsedEdit => ({ ok: false, message });

/** "29", "29.5" or "29.50" to 2950. Null for text that is not money. Exact: no floating point. */
export function toMinor(text: string): number | null {
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

/** "20" or "12.5" percent to basis points. */
export function toBasisPoints(text: string): number | null {
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  const bp = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return bp <= 10_000 ? bp : null;
}

const lines = (raw: string): string[] => raw.split("\n").map((l) => l.trim()).filter((l) => l !== "");

function parseCertifications(raw: string): ParsedEdit {
  const list = lines(raw).map((line) => {
    const [name = "", expires = ""] = line.split("=").map((part) => part.trim());
    return { name, expiresOn: expires === "" ? null : expires, documentRef: null };
  });
  const checked = z.array(certificationSchema).max(50).safeParse(list);
  return checked.success ? { ok: true, columns: { certifications: checked.data } } : fail("Write each line as: name = YYYY-MM-DD, or the name alone.");
}

function parseDuty(raw: string): ParsedEdit {
  const out: Record<string, number> = {};
  for (const line of lines(raw)) {
    const [code = "", rate = ""] = line.split("=").map((part) => part.trim());
    const bp = toBasisPoints(rate);
    if (!/^[0-9.]{4,12}$/.test(code) || bp === null) return fail(`Write each line as "6110.30 = 12". This one is not: "${line}".`);
    out[code] = bp;
  }
  return { ok: true, columns: { duty_by_hs: out } };
}

function parseNumber(field: EditableField, text: string, decimal: boolean): ParsedEdit {
  if (text === "") return { ok: true, columns: { [field.column]: null } };
  const value = Number(text);
  if (!Number.isFinite(value) || (!decimal && !Number.isInteger(value))) return fail(decimal ? "Give a number." : "Give a whole number.");
  if (value < (field.min ?? 0) || value > (field.max ?? Number.MAX_SAFE_INTEGER)) return fail(`Use a number from ${field.min ?? 0} to ${field.max}.`);
  return { ok: true, columns: { [field.column]: value } };
}

function parseCost(text: string): ParsedEdit {
  if (text === "") return { ok: true, columns: { cost_minor: null, cost_currency: null } };
  const match = /^([\d.]+)\s+([A-Z]{3})$/.exec(text);
  const minor = match ? toMinor(match[1]!) : null;
  if (!match || minor === null) return fail("Give the cost and its currency, such as 8.80 USD, or leave it empty.");
  return { ok: true, columns: { cost_minor: minor, cost_currency: match[2] } };
}

function parseJson(text: string): ParsedEdit {
  try {
    const value: unknown = JSON.parse(text === "" ? "{}" : text);
    if (value !== null && typeof value === "object" && !Array.isArray(value)) return { ok: true, columns: { label_rules: value } };
  } catch {
    // Falls through to the message below.
  }
  return fail('Give a JSON object, such as {"careLabel": true}.');
}

function parseText(field: EditableField, text: string): ParsedEdit {
  if (text === "") return field.kind === "optionalText" ? { ok: true, columns: { [field.column]: null } } : fail("This cannot be empty.");
  if (text.length > 200) return fail("That is too long.");
  if (field.check && !field.check[0](text)) return fail(field.check[1]);
  return { ok: true, columns: { [field.column]: text } };
}

/** Turns what was typed into the columns to write, or a message in words. */
export function parseFieldInput(field: EditableField, raw: string): ParsedEdit {
  const text = raw.trim();
  const one = (value: unknown): ParsedEdit => ({ ok: true, columns: { [field.column]: value } });
  switch (field.kind) {
    case "text":
    case "optionalText":
      return parseText(field, text);
    case "optionalNumber":
      return parseNumber(field, text, false);
    case "optionalDecimal":
      return parseNumber(field, text, true);
    case "money": {
      const minor = toMinor(text);
      return text === "" ? one(null) : minor === null ? fail("Give an amount such as 29.00.") : one(minor);
    }
    case "costMoney":
      return parseCost(text);
    case "percent": {
      const bp = toBasisPoints(text);
      return text === "" ? one(null) : bp === null ? fail("Give a percentage from 0 to 100, such as 20.") : one(bp);
    }
    case "boolean":
      return text === "yes" || text === "no" ? one(text === "yes") : fail("Choose yes or no.");
    case "optionalBoolean":
      return text === "" ? one(null) : text === "yes" || text === "no" ? one(text === "yes") : fail("Choose yes, no or not known.");
    case "choice":
      return field.choices?.includes(text) ? one(text) : fail("Choose one of the options.");
    case "list": {
      const items = text.split(",").map((part) => part.trim().toLowerCase()).filter((part) => part !== "");
      return items.length > 20 || items.some((item) => item.length > 16) ? fail("Give up to 20 formats, each up to 16 letters.") : one(items);
    }
    case "certifications":
      return parseCertifications(raw);
    case "dutyLines":
      return parseDuty(raw);
    case "json":
      return parseJson(text);
  }
}
