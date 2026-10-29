import { z } from "zod";

/**
 * The factory model (decision 0071): factories, capabilities, price tiers, the fabric programme and country rules,
 * as the app sees them. Rows come from migration 20261101050000_factories.sql; `rows.ts` turns them into these.
 * Money is integer minor units plus an ISO currency. Null always means "not set", never zero.
 */

export const PRODUCTION_CLASSES = ["A", "B"] as const;
export type ProductionClass = (typeof PRODUCTION_CLASSES)[number];

export const FACTORY_STATUSES = ["onboarding", "active", "paused", "retired"] as const;
export const GOLDEN_SAMPLE_STATUSES = ["none", "requested", "approved", "rejected"] as const;

/** The currencies a sell price is kept in (spec F-S8: UK | GBP, AU | AUD). */
export const SELL_CURRENCIES = ["GBP", "AUD"] as const;
export type SellCurrency = (typeof SELL_CURRENCIES)[number];

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(64);
export const articleCodeSchema = z.string().regex(/^[A-Z]{3}-[A-Z]{2}-[0-9]{2}$/, "Use an article code such as JSY-SS-01.");
export const fabricCodeSchema = z.string().regex(/^F-[A-Z0-9]+(-[A-Z0-9]+)*$/, "Use a fabric code such as F-POLY-INT.").max(32);
const currency = z.string().regex(/^[A-Z]{3}$/);
/** The rulebook entry that explains a row (plan v5, "Every rule explains itself"). */
export const ruleIdSchema = z.string().regex(/^R-[A-Z]+-[0-9]{3}$/, "Use a rule id such as R-SUB-005.");
/** Used where no rulebook entry is written yet; X2 (decision 0067) seeds its text. */
export const GAP_RULE_ID = "R-GAP-000";
const minor = z.number().int().min(0).max(100_000_000);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const certificationSchema = z.object({
  name: z.string().min(1).max(120),
  expiresOn: isoDate.nullable(),
  documentRef: z.string().max(200).nullable(),
});
export type Certification = z.output<typeof certificationSchema>;

export const factorySchema = z.object({
  id: z.uuid(),
  slug,
  name: z.string().min(1).max(120),
  city: z.string().min(1).max(120),
  country: z.string().regex(/^[A-Z]{2}$/),
  timeZone: z.string().min(1).max(64),
  contactWhatsapp: z.string().regex(/^\+[1-9][0-9]{6,14}$/).nullable(),
  certifications: z.array(certificationSchema).max(50),
  status: z.enum(FACTORY_STATUSES),
  label: z.string().min(1).max(200),
  updatedAt: z.string(),
});
export type Factory = z.output<typeof factorySchema>;

export const capabilitySchema = z.object({
  id: z.uuid(),
  factoryId: z.uuid(),
  articleCode: articleCodeSchema,
  garmentTypeId: slug.nullable(),
  fabricCode: fabricCodeSchema,
  /** Working days, Monday to Friday, from the cut-off to ready for QC. */
  leadTimeDays: z.number().int().min(1).max(365).nullable(),
  moq: z.number().int().min(1).max(1_000_000).nullable(),
  weeklySlotCapacity: z.number().int().min(0).max(1_000_000).nullable(),
  fileFormats: z.array(z.string().min(1).max(16)).max(20),
  goldenSampleStatus: z.enum(GOLDEN_SAMPLE_STATUSES),
  colourDeltaMax: z.number().min(0).max(100).nullable(),
  ruleId: ruleIdSchema,
  label: z.string().min(1).max(200),
});
export type Capability = z.output<typeof capabilitySchema>;

export const priceTierSchema = z.object({
  id: z.uuid(),
  capabilityId: z.uuid(),
  qtyMin: z.number().int().min(1).max(1_000_000),
  qtyMax: z.number().int().min(1).max(1_000_000).nullable(),
  cost: z.object({ minor, currency }).nullable(),
  sellGbpMinor: minor.nullable(),
  sellAudMinor: minor.nullable(),
  personalisationCostMinor: minor.nullable(),
  ruleId: ruleIdSchema,
  label: z.string().min(1).max(200),
});
export type PriceTier = z.output<typeof priceTierSchema>;

export const programmeFabricSchema = z.object({
  id: z.uuid(),
  code: fabricCodeSchema,
  name: z.string().min(1).max(120),
  productionClass: z.enum(PRODUCTION_CLASSES),
  blend: z.string().min(1).max(200),
  gsmMin: z.number().int().nullable(),
  gsmMax: z.number().int().nullable(),
  stretch: z.string().nullable(),
  finish: z.string().nullable(),
  pfasFree: z.boolean().nullable(),
  oekoTexCert: z.string().nullable(),
  sublimatable: z.boolean().nullable(),
  swatchRef: z.string().nullable(),
  ruleId: ruleIdSchema,
  label: z.string().min(1).max(200),
});
export type ProgrammeFabric = z.output<typeof programmeFabricSchema>;

export const fabricColourSchema = z.object({
  id: z.uuid(),
  fabricCode: fabricCodeSchema,
  name: z.string().min(1).max(60),
  hex: z.string().regex(/^#[0-9A-F]{6}$/),
  lab: z.tuple([z.number(), z.number(), z.number()]).nullable(),
  pantone: z.string().nullable(),
  label: z.string().min(1).max(200),
});
export type FabricColour = z.output<typeof fabricColourSchema>;

export const countryRuleSchema = z.object({
  id: z.uuid(),
  country: z.string().regex(/^[A-Z]{2}$/),
  name: z.string().min(1).max(120),
  currency,
  /** Basis points: 2000 is 20%. */
  vatRateBp: z.number().int().min(0).max(10_000).nullable(),
  lowValueThresholdMinor: z.number().int().min(0).nullable(),
  /** HS code to duty in basis points. */
  dutyByHs: z.record(z.string().regex(/^[0-9.]{4,12}$/), z.number().int().min(0).max(10_000)),
  preferenceScheme: z.string().nullable(),
  labelRules: z.record(z.string(), z.unknown()),
  freightDays: z.number().int().min(0).max(120).nullable(),
  sellingEnabled: z.boolean(),
  ruleId: ruleIdSchema,
  label: z.string().min(1).max(200),
});
export type CountryRule = z.output<typeof countryRuleSchema>;

/** Everything about one factory the read model needs. */
export interface FactorySnapshot {
  readonly factory: Factory;
  readonly capabilities: readonly Capability[];
  readonly tiers: readonly PriceTier[];
  readonly fabrics: readonly ProgrammeFabric[];
}
