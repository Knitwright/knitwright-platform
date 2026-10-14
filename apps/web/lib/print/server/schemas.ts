import { z } from "zod";
import { printRuleSetSchema, rosterRowSchema } from "@/lib/production/contract";
import { PRINT_FORMATS } from "../formats";

/** What a person gives for the brand's print profile: the numbers their print house stated. */
export const printProfileInputSchema = z.object({
  bleedMm: z.number().finite().min(0, "The bleed cannot be less than nothing.").max(100, "A bleed of more than 100 mm is not sensible."),
  dpi: z.number().int().min(72).max(1200),
  minDpi: z.number().int().min(72).max(1200),
  maxPrintWidthMm: z.number().finite().positive().max(10_000).nullable().default(null),
  iccFileId: z.uuid().nullable().default(null),
});
export type PrintProfileInput = z.output<typeof printProfileInputSchema>;

export const leagueRuleSetInputSchema = z.object({
  name: z.string().trim().min(1, "Give the rule set a name.").max(120),
  source: z.string().trim().min(1, "Say where these rules were read, such as the rulebook and section.").max(300),
  rules: printRuleSetSchema,
});
export type LeagueRuleSetInput = z.output<typeof leagueRuleSetInputSchema>;

const list = <T extends string>(allowed: readonly T[], what: string) =>
  z
    .string()
    .transform((text) => text.split(",").map((part) => part.trim()).filter((part) => part !== ""))
    .pipe(z.array(z.string()).max(40))
    .refine((items) => items.every((item) => (allowed as readonly string[]).includes(item)), `Each ${what} must be one of: ${allowed.join(", ")}.`)
    .transform((items) => [...new Set(items)] as T[]);

const VIEW_NAMES = ["front", "back", "sleeve-left", "sleeve-right", "collar"] as const;

/** The address of a download: `?sizes=48,50&format=pdf,svg&view=back&colourway=home&fabric=<id>&guides=off`. */
export const printFilesQuerySchema = z.object({
  sizes: z.string().max(200).optional(),
  format: list(PRINT_FORMATS, "format").optional(),
  view: list(VIEW_NAMES, "piece").optional(),
  colourway: z.string().max(80).optional(),
  fabric: z.uuid().optional(),
  /** A league rule set of the brand to hold the files to. */
  rules: z.uuid().optional(),
  guides: z.enum(["on", "off"]).optional(),
  version: z.coerce.number().int().min(1).optional(),
});
export type PrintFilesQuery = z.output<typeof printFilesQuerySchema>;

/** The players to make sets for: a roster in the shape the team order uses. */
export const printFilesBodySchema = z.object({
  rows: z.array(rosterRowSchema).min(1).max(1000),
  name: z.string().max(120).optional(),
});
export type PrintFilesBody = z.output<typeof printFilesBodySchema>;
