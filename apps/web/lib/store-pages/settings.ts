import { z } from "zod";
import { formatMoney } from "@/lib/factory/pricing";

/**
 * A brand's store settings (plan v6 C5, decision 0156; 09 screen 25): GPSR, EPR and branding.
 *
 * - **GPSR** (EU General Product Safety Regulation): Knitwright, as manufacturer through its partner factory, fills
 *   in the manufacturer, the labels and the safety information; the seller gives an EU responsible person and a
 *   brand contact. Without the responsible person, selling into the EU and Northern Ireland is not allowed, and the
 *   page says so.
 * - **EPR** (packaging): Germany needs a LUCID registration number before shipping there; France's Triman mark is
 *   printed on inserts by Knitwright; the UK applies above a turnover threshold (a note, not a figure).
 * - **Branding**: packing inserts, neck labels, hang tags and gift messages, each switched on with a note. Costs are
 *   rows (`store_branding_options`), labelled placeholders.
 */

export const LUCID_PATTERN = /^DE[0-9]{10,16}$/;

export const storeSettingsInput = z.object({
  euRpName: z.string().trim().max(120),
  euRpAddress: z.string().trim().max(400),
  euRpEmail: z.union([z.literal(""), z.email().max(254)]),
  brandContact: z.string().trim().max(254),
  lucidNumber: z.union([z.literal(""), z.string().trim().toUpperCase().regex(LUCID_PATTERN, "A LUCID number is DE followed by its digits.")]),
});

export type StoreSettingsInput = z.infer<typeof storeSettingsInput>;

export type BrandingChoice = Readonly<{ on: boolean; note: string }>;

export interface StoreSettings extends StoreSettingsInput {
  readonly branding: Readonly<Record<string, BrandingChoice>>;
}

export const EMPTY_SETTINGS: StoreSettings = { euRpName: "", euRpAddress: "", euRpEmail: "", brandContact: "", lucidNumber: "", branding: {} };

const settingsRow = z.object({
  eu_rp_name: z.string(),
  eu_rp_address: z.string(),
  eu_rp_email: z.string(),
  brand_contact: z.string(),
  lucid_number: z.string(),
  branding: z.record(z.string(), z.object({ on: z.boolean(), note: z.string() })).catch({}),
});

export const STORE_SETTINGS_COLUMNS = Object.keys(settingsRow.shape).join(", ");

export const toStoreSettings = (row: unknown): StoreSettings => {
  if (row === null || row === undefined) return EMPTY_SETTINGS;
  const r = settingsRow.parse(row);
  return { euRpName: r.eu_rp_name, euRpAddress: r.eu_rp_address, euRpEmail: r.eu_rp_email, brandContact: r.brand_contact, lucidNumber: r.lucid_number, branding: r.branding };
};

/** Whether the EU responsible person is complete: name, address and email. */
export const euReady = (settings: StoreSettings): boolean => settings.euRpName !== "" && settings.euRpAddress !== "" && settings.euRpEmail !== "";

export interface BrandingOption {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly costFromMinor: number | null;
  readonly currency: "GBP" | "AUD";
  readonly per: "order" | "item" | null;
  readonly details: string;
  readonly isPlaceholder: boolean;
}

const optionRow = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  cost_from_minor: z.coerce.number().int().nullable(),
  currency: z.enum(["GBP", "AUD"]),
  per: z.enum(["order", "item"]).nullable(),
  details: z.string(),
  is_placeholder: z.boolean(),
});

export const BRANDING_OPTION_COLUMNS = Object.keys(optionRow.shape).join(", ");

export const toBrandingOption = (row: unknown): BrandingOption => {
  const r = optionRow.parse(row);
  return { id: r.id, name: r.name, description: r.description, costFromMinor: r.cost_from_minor, currency: r.currency, per: r.per, details: r.details, isPlaceholder: r.is_placeholder };
};

/** "From £0.30 per order", or "Free". */
export const costLine = (option: BrandingOption): string =>
  option.costFromMinor === null || option.costFromMinor === 0 ? "Free" : `From ${formatMoney(option.costFromMinor, option.currency)}${option.per ? ` per ${option.per}` : ""}`;

export const brandingInput = z.object({ optionId: z.string().regex(/^[a-z_]{1,40}$/), on: z.boolean(), note: z.string().trim().max(200) });
