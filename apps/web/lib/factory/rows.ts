import { z } from "zod";
import {
  capabilitySchema,
  countryRuleSchema,
  fabricColourSchema,
  factorySchema,
  priceTierSchema,
  programmeFabricSchema,
  type Capability,
  type CountryRule,
  type FabricColour,
  type Factory,
  type PriceTier,
  type ProgrammeFabric,
} from "./schemas";

/** Database rows (snake_case) to the app's shapes. Every row is checked on the way in. */

type Row = Record<string, unknown>;

/** numeric columns may come back as text; bigint ones as numbers. Both become numbers. */
const num = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

export const FACTORY_COLUMNS = "id, slug, name, city, country, time_zone, contact_whatsapp, certifications, status, label, updated_at";
export const CAPABILITY_COLUMNS =
  "id, factory_id, article_code, garment_type_id, fabric_code, lead_time_days, moq, weekly_slot_capacity, file_formats, golden_sample_status, colour_delta_max, rule_id, label";
export const TIER_COLUMNS =
  "id, capability_id, qty_min, qty_max, cost_minor, cost_currency, sell_gbp_minor, sell_aud_minor, personalisation_cost_minor, rule_id, label";
export const FABRIC_COLUMNS =
  "id, code, name, production_class, blend, gsm_min, gsm_max, stretch, finish, pfas_free, oeko_tex_cert, sublimatable, swatch_ref, rule_id, label";
export const COLOUR_COLUMNS = "id, fabric_code, name, hex, lab_l, lab_a, lab_b, pantone, label";
export const COUNTRY_COLUMNS =
  "id, country, name, currency, vat_rate_bp, low_value_threshold_minor, duty_by_hs, preference_scheme, label_rules, freight_days, selling_enabled, rule_id, label";

export const toFactory = (r: Row): Factory =>
  factorySchema.parse({
    id: r.id,
    slug: r.slug,
    name: r.name,
    city: r.city,
    country: r.country,
    timeZone: r.time_zone,
    contactWhatsapp: r.contact_whatsapp ?? null,
    certifications: r.certifications ?? [],
    status: r.status,
    label: r.label,
    updatedAt: r.updated_at,
  });

export const toCapability = (r: Row): Capability =>
  capabilitySchema.parse({
    id: r.id,
    factoryId: r.factory_id,
    articleCode: r.article_code,
    garmentTypeId: r.garment_type_id ?? null,
    fabricCode: r.fabric_code,
    leadTimeDays: num(r.lead_time_days),
    moq: num(r.moq),
    weeklySlotCapacity: num(r.weekly_slot_capacity),
    fileFormats: r.file_formats ?? [],
    goldenSampleStatus: r.golden_sample_status,
    colourDeltaMax: num(r.colour_delta_max),
    ruleId: r.rule_id,
    label: r.label,
  });

export const toTier = (r: Row): PriceTier => {
  const cost = num(r.cost_minor);
  return priceTierSchema.parse({
    id: r.id,
    capabilityId: r.capability_id,
    qtyMin: num(r.qty_min),
    qtyMax: num(r.qty_max),
    cost: cost === null ? null : { minor: cost, currency: r.cost_currency },
    sellGbpMinor: num(r.sell_gbp_minor),
    sellAudMinor: num(r.sell_aud_minor),
    personalisationCostMinor: num(r.personalisation_cost_minor),
    ruleId: r.rule_id,
    label: r.label,
  });
};

export const toFabric = (r: Row): ProgrammeFabric =>
  programmeFabricSchema.parse({
    id: r.id,
    code: r.code,
    name: r.name,
    productionClass: r.production_class,
    blend: r.blend,
    gsmMin: num(r.gsm_min),
    gsmMax: num(r.gsm_max),
    stretch: r.stretch ?? null,
    finish: r.finish ?? null,
    pfasFree: r.pfas_free ?? null,
    oekoTexCert: r.oeko_tex_cert ?? null,
    sublimatable: r.sublimatable ?? null,
    swatchRef: r.swatch_ref ?? null,
    ruleId: r.rule_id,
    label: r.label,
  });

export const toColour = (r: Row): FabricColour => {
  const lab = [num(r.lab_l), num(r.lab_a), num(r.lab_b)];
  return fabricColourSchema.parse({
    id: r.id,
    fabricCode: r.fabric_code,
    name: r.name,
    hex: r.hex,
    lab: lab.every((v) => v !== null) ? lab : null,
    pantone: r.pantone ?? null,
    label: r.label,
  });
};

export const toCountryRule = (r: Row): CountryRule =>
  countryRuleSchema.parse({
    id: r.id,
    country: r.country,
    name: r.name,
    currency: r.currency,
    vatRateBp: num(r.vat_rate_bp),
    lowValueThresholdMinor: num(r.low_value_threshold_minor),
    dutyByHs: r.duty_by_hs ?? {},
    preferenceScheme: r.preference_scheme ?? null,
    labelRules: r.label_rules ?? {},
    freightDays: num(r.freight_days),
    sellingEnabled: r.selling_enabled,
    ruleId: r.rule_id,
    label: r.label,
  });

export const rowsOf = (data: unknown): Row[] => z.array(z.record(z.string(), z.unknown())).parse(data ?? []);
