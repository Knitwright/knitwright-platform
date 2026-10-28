import { z } from "zod";
import { OUTPUT_KINDS } from "@/lib/credits/kinds";
import { EXTENSION_SETTINGS } from "./extensions";
import type { SettingDef } from "./types";

/**
 * Every setting a platform admin can change, with its schema, its in-code default and the owner question it
 * answers (docs/owner/questionnaire-2026-10-25.md). A key not listed here is refused. NEVER add a secret or
 * an API key: settings are shown on screen and kept in a history.
 *
 * Defaults are the values already in lib/ops, lib/guardrails and lib/credits; lib/settings/registry.test.ts
 * fails if they drift apart.
 */

const wholeNumber = (min: number, max: number) =>
  z
    .number({ error: "Give a number." })
    .int("Whole numbers only.")
    .min(min, `Use ${min} or more.`)
    .max(max, `Use ${max} or less.`);

const articleId = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use an article id such as crew-tee.").max(64);

const priceKey = (kind: (typeof OUTPUT_KINDS)[number]) => `credits.price_${kind}`;

const CREDITS: readonly SettingDef[] = OUTPUT_KINDS.map((kind) => ({
  key: priceKey(kind),
  group: "credits",
  label: `Credits for ${kind.replaceAll("_", " ")}`,
  help: "What one output costs, in credits. 0 makes it free.",
  question: 1,
  input: "number",
  schema: wholeNumber(0, 100_000),
  fallback: 1,
}));

export const CORE_SETTINGS: readonly SettingDef[] = [
  ...CREDITS,
  {
    key: "credits.monthly_allowance",
    group: "credits",
    label: "Free credits each month",
    help: "Given to every brand at the start of each UTC month. No rollover.",
    question: 3,
    input: "number",
    schema: wholeNumber(0, 1_000_000),
    fallback: 10,
  },
  {
    key: "ops.cutoff_weekday",
    group: "ops",
    label: "Weekly batch cut-off: day",
    help: "The day the weekly batch closes. Times are UTC.",
    question: 6,
    input: "weekday",
    schema: wholeNumber(0, 6),
    fallback: 5,
  },
  {
    key: "ops.cutoff_minutes",
    group: "ops",
    label: "Weekly batch cut-off: time (UTC)",
    help: "Hours and minutes in UTC. 12:00 in Pakistan is 07:00 UTC.",
    question: 6,
    input: "time",
    schema: wholeNumber(0, 1439),
    fallback: 17 * 60,
  },
  {
    key: "ops.lead_time_days",
    group: "ops",
    label: "Days from the cut-off to the promised date",
    help: "Leave empty while no factory has agreed one. No due date is promised until it is set.",
    question: 5,
    input: "optionalNumber",
    schema: wholeNumber(0, 365).nullable(),
    fallback: null,
  },
  {
    key: "guardrails.min_dpi",
    group: "guardrails",
    label: "Smallest picture resolution (dpi at print size)",
    help: "Artwork below this is flagged.",
    question: 14,
    input: "number",
    schema: wholeNumber(30, 1200),
    fallback: 150,
  },
  {
    key: "guardrails.bleed_mm",
    group: "guardrails",
    label: "Bleed (mm)",
    help: "How far artwork runs past the cut line.",
    question: 13,
    input: "number",
    schema: wholeNumber(0, 50),
    fallback: 10,
  },
  {
    key: "guardrails.safe_zone_mm",
    group: "guardrails",
    label: "Clear space around names and numbers (mm)",
    help: "Distance kept from seams and edges.",
    question: 15,
    input: "number",
    schema: wholeNumber(0, 50),
    fallback: 10,
  },
  {
    key: "media.daily_cap_per_brand",
    group: "media",
    label: "Media sets per brand per day",
    help: "The most paid media generations one brand may start in a UTC day. 0 stops them. Leave empty while no cap is agreed.",
    question: 35,
    input: "optionalNumber",
    schema: wholeNumber(0, 10_000).nullable(),
    fallback: null,
  },
  {
    key: "factory.moq_by_article",
    group: "factory",
    label: "Minimum order per article",
    help: "One line per article: crew-tee = 10. An article not listed has no minimum set.",
    question: 4,
    input: "lines",
    lines: "numbers",
    schema: z.record(articleId, wholeNumber(1, 1_000_000)),
    fallback: {},
  },
  {
    key: "factory.price_ladder",
    group: "factory",
    label: "Price ladder",
    help: "One line per step: pieces = unit price, such as 10 = 32.50. Use the factory's written quote only.",
    question: 4,
    input: "lines",
    lines: "ladder",
    schema: z
      .array(z.object({ fromPieces: wholeNumber(1, 1_000_000), unitPrice: z.number({ error: "Give a price." }).min(0, "A price cannot be negative.").max(1_000_000) }))
      .min(1, "Give at least one step, or reset to the default.")
      .max(20),
    fallback: null,
  },
  {
    key: "factory.lead_time_days",
    group: "factory",
    label: "Factory lead time (working days)",
    help: "Production days the factory has agreed in writing.",
    question: 5,
    input: "optionalNumber",
    schema: wholeNumber(1, 1_000_000).nullable(),
    fallback: null,
  },
  {
    key: "factory.file_formats",
    group: "factory",
    label: "File formats the factory accepts",
    help: "Separated by commas, such as pdf, dxf, png.",
    question: 7,
    input: "list",
    schema: z.array(z.string().trim().min(1).max(16)).max(20),
    fallback: [],
  },
  {
    key: "factory.hs_codes",
    group: "factory",
    label: "Customs (HS) codes per article",
    help: "One line per article: crew-tee = 6109.10.",
    question: 4,
    input: "lines",
    lines: "text",
    schema: z.record(z.string().max(64), z.string().regex(/^[0-9.]{4,12}$/, "An HS code is 4 to 12 digits and dots.")),
    fallback: {},
  },
];

export const SETTINGS: readonly SettingDef[] = [...CORE_SETTINGS, ...EXTENSION_SETTINGS];

export const GROUPS: Readonly<Record<string, string>> = {
  credits: "Credits",
  ops: "Weekly batch",
  guardrails: "Print file checks",
  media: "Marketing media",
  checker: "Picture checker",
  factory: "Factory terms",
  designers: "Designer royalties",
};

export const findSetting = (key: string): SettingDef | undefined => SETTINGS.find((s) => s.key === key);
