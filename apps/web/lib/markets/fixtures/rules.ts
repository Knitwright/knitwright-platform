import type { CountryRule } from "@/lib/factory/schemas";

/** Test support: a market's row in the app's shape. Nothing here is used by the app. */
export const appRule = (over: Partial<CountryRule> = {}): CountryRule => ({
  id: "22222222-2222-4222-8222-222222222222",
  country: "AU",
  name: "Australia",
  currency: "AUD",
  vatRateBp: 1000,
  lowValueThresholdMinor: 100000,
  dutyByHs: {},
  preferenceScheme: null,
  labelRules: {},
  freightDays: null,
  sellingEnabled: true,
  taxName: "GST",
  taxRegistrationThresholdMinor: 7_500_000,
  taxRegistered: false,
  taxSource: "docs/spec/research/Knitwright platform validation.md. Confirm with a tax adviser.",
  ruleId: "R-GAP-000",
  label: "Placeholder, to confirm with a customs adviser",
  ...over,
});

/** The AU label rules as Z8 and O3 seed them: fibre, origin and size written, care and importer not. */
export const auLabelRules = (): Readonly<Record<string, unknown>> => ({
  version: 1,
  label: "Knitwright draft v0.1, not reviewed by a factory or a legal adviser",
  origin: "Made in Pakistan",
  cpsiaRequired: false,
  lines: {
    fibre: { text: null, language: "en", order: "descending_percentage", confirmed: false, source: "Rulebook R-LAB-002 (draft)" },
    care: { symbolCodes: [], confirmed: false, source: null, gapRuleId: "R-LAB-002", gapNote: "ISO 3758 is a paid standard and is not in this repository." },
    origin: { text: "Made in Pakistan", confirmed: false, source: "docs/spec/04-production-package.md, section 07_labels" },
    size: { text: null, convention: "size_code", confirmed: false, source: "Knitwright size runs, docs/sizing/starter-charts.md" },
    importer: { text: null, required: null, confirmed: false, source: null },
  },
});
