import type { PriceTier } from "../schemas";

/**
 * Rows for the tests, in the shape the database holds them (snake_case) and in the shape the app uses.
 * They mirror the seed of migration 20261101050000_factories.sql. Every label says "test", so a value from
 * here can never be mistaken for one a factory agreed.
 */

export const ids = {
  factory: "11111111-1111-4111-8111-111111111111",
  jersey: "22222222-2222-4222-8222-222222222222",
  shorts: "22222222-2222-4222-8222-222222222223",
  tier10: "33333333-3333-4333-8333-333333333331",
  tier20: "33333333-3333-4333-8333-333333333332",
  tier50: "33333333-3333-4333-8333-333333333333",
  shortsTier: "33333333-3333-4333-8333-333333333334",
  interlock: "44444444-4444-4444-8444-444444444441",
  stockTee: "44444444-4444-4444-8444-444444444442",
  colour: "55555555-5555-4555-8555-555555555551",
  gb: "66666666-6666-4666-8666-666666666661",
  au: "66666666-6666-4666-8666-666666666662",
  us: "66666666-6666-4666-8666-666666666663",
} as const;

const LABEL = "Test row, not a factory quote";

export const factoryRow: Record<string, unknown> = {
  id: ids.factory,
  slug: "sialkot-partner",
  name: "Sialkot partner (placeholder)",
  city: "Sialkot",
  country: "PK",
  time_zone: "Asia/Karachi",
  contact_whatsapp: null,
  certifications: [],
  status: "onboarding",
  label: LABEL,
  updated_at: "2026-10-29T00:00:00Z",
};

export const capabilityRows: Record<string, unknown>[] = [
  {
    id: ids.jersey,
    factory_id: ids.factory,
    article_code: "JSY-SS-01",
    garment_type_id: "football-shirt",
    fabric_code: "F-POLY-INT",
    lead_time_days: 8,
    moq: 1,
    weekly_slot_capacity: null,
    file_formats: ["pdf", "svg", "eps", "dxf"],
    golden_sample_status: "none",
    colour_delta_max: "1.50",
    rule_id: "R-GAP-000",
    label: LABEL,
  },
  {
    id: ids.shorts,
    factory_id: ids.factory,
    article_code: "SHO-TR-01",
    garment_type_id: "football-shorts",
    fabric_code: "F-POLY-INT",
    lead_time_days: 10,
    moq: 5,
    weekly_slot_capacity: 400,
    file_formats: ["PDF"],
    golden_sample_status: "requested",
    colour_delta_max: null,
    rule_id: "R-GAP-000",
    label: LABEL,
  },
];

const tier = (id: string, capability: string, qtyMin: number, qtyMax: number | null, gbp: number | null): Record<string, unknown> => ({
  id,
  capability_id: capability,
  qty_min: qtyMin,
  qty_max: qtyMax,
  cost_minor: null,
  cost_currency: null,
  sell_gbp_minor: gbp,
  sell_aud_minor: null,
  personalisation_cost_minor: null,
  rule_id: "R-COST-003",
  label: LABEL,
});

export const tierRows: Record<string, unknown>[] = [
  tier(ids.tier10, ids.jersey, 10, 19, 2900),
  tier(ids.tier20, ids.jersey, 20, 49, 2500),
  tier(ids.tier50, ids.jersey, 50, null, 2200),
  tier(ids.shortsTier, ids.shorts, 10, null, null),
];

export const fabricRows: Record<string, unknown>[] = [
  {
    id: ids.interlock,
    code: "F-POLY-INT",
    name: "Polyester interlock",
    production_class: "A",
    blend: "100% polyester",
    gsm_min: 140,
    gsm_max: 160,
    stretch: null,
    finish: null,
    pfas_free: null,
    oeko_tex_cert: null,
    sublimatable: true,
    swatch_ref: "SW-INT-01",
    rule_id: "R-SUB-001",
    label: LABEL,
  },
  {
    id: ids.stockTee,
    code: "F-STK-TEE",
    name: "Stock tee fabric",
    production_class: "B",
    blend: "Polyester or cotton-polyester, to confirm",
    gsm_min: null,
    gsm_max: null,
    stretch: null,
    finish: null,
    pfas_free: null,
    oeko_tex_cert: null,
    sublimatable: null,
    swatch_ref: null,
    rule_id: "R-GAP-000",
    label: LABEL,
  },
];

export const colourRows: Record<string, unknown>[] = [
  { id: ids.colour, fabric_code: "F-STK-TEE", name: "Navy", hex: "#1F2A44", lab_l: null, lab_a: null, lab_b: null, pantone: null, label: LABEL },
];

const rule = (id: string, country: string, name: string, currency: string, enabled: boolean, freight: number | null): Record<string, unknown> => ({
  id,
  country,
  name,
  currency,
  vat_rate_bp: enabled ? 2000 : null,
  low_value_threshold_minor: null,
  duty_by_hs: {},
  preference_scheme: null,
  label_rules: {},
  freight_days: freight,
  selling_enabled: enabled,
  rule_id: "R-GAP-000",
  label: LABEL,
});

export const countryRows: Record<string, unknown>[] = [
  rule(ids.gb, "GB", "United Kingdom", "GBP", true, 4),
  rule(ids.au, "AU", "Australia", "AUD", true, null),
  rule(ids.us, "US", "United States", "USD", false, null),
];

/** The raw rows of every table, as the ops page reads them. */
export const allRows = {
  factories: [factoryRow],
  factory_capabilities: capabilityRows,
  price_tiers: tierRows,
  programme_fabrics: fabricRows,
  programme_fabric_colours: colourRows,
  country_rules: countryRows,
} as const;

/** A price tier in the app's shape, for the pure pricing tests. */
export const appTier = (qtyMin: number, qtyMax: number | null, gbp: number | null, aud: number | null = null): PriceTier => ({
  id: `77777777-7777-4777-8777-${String(qtyMin).padStart(6, "0")}${String(qtyMax ?? 0).padStart(6, "0")}`,
  capabilityId: ids.jersey,
  qtyMin,
  qtyMax,
  cost: null,
  sellGbpMinor: gbp,
  sellAudMinor: aud,
  personalisationCostMinor: null,
  ruleId: "R-COST-003",
  label: LABEL,
});
