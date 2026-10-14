import { z } from "zod";
import { DEFAULT_LABEL, printProfileSchema, printRuleSetSchema, type PrintProfile, type PrintRuleSet } from "@/lib/production/contract";

/** A print profile as stored: the contract's profile, and the lowest dpi the brand will accept in a file. */
export const storedPrintProfileSchema = printProfileSchema.extend({
  minDpi: z.number().int().min(72).max(1200),
});
export type StoredPrintProfile = z.output<typeof storedPrintProfileSchema>;

/** What a member sends. The source is never sent: saving a profile marks it as the print house's. */
export const printProfileInputSchema = storedPrintProfileSchema
  .omit({ source: true })
  .refine((p) => p.minDpi <= p.dpi, { message: "The lowest dpi cannot be higher than the dpi files are made at.", path: ["minDpi"] });
export type PrintProfileInput = z.output<typeof printProfileInputSchema>;

export const MAX_LEAGUE_RULE_SETS = 30;

export const leagueRulesInputSchema = z.object({
  name: z.string().trim().min(1, "Give the rule set a name.").max(80),
  source: z.string().trim().min(1, "Say where these rules came from.").max(200),
  rules: printRuleSetSchema,
});
export type LeagueRulesInput = z.output<typeof leagueRulesInputSchema>;

export type LeagueRuleSet = LeagueRulesInput & Readonly<{ id: string; updatedAt: string }>;

export const DEFAULT_PRINT_PROFILE: StoredPrintProfile = Object.freeze({
  bleedMm: 15,
  dpi: 150,
  minDpi: 150,
  iccFileId: null,
  maxPrintWidthMm: null,
  source: "knitwright-default",
});

/** Rules a brand has not set: nothing to avoid, nothing to hold to. `source` says so. */
export const DEFAULT_PRINT_RULES: PrintRuleSet & Readonly<{ source: string }> = Object.freeze({
  minTextHeightMm: null,
  minLineMm: null,
  coloursToAvoid: [],
  numberRules: null,
  source: DEFAULT_LABEL,
});

export type { PrintProfile };
