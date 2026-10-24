import { z } from "zod";
import { kitSchema, type Kit } from "./kit";
import { APPLY_PARTS } from "./apply-kit";
import { ASSIGNABLE_ROLES } from "./roles";
import { playersSchema } from "./roster";

const date = z.iso.date().nullable();

export const seasonBody = z
  .object({
    name: z.string().trim().min(1, "Name the season.").max(80),
    startsOn: date.default(null),
    endsOn: date.default(null),
    /** Start the season with this earlier season's players and sizes. */
    copyFromSeasonId: z.uuid().optional(),
  })
  .refine((s) => s.startsOn === null || s.endsOn === null || s.startsOn <= s.endsOn, { message: "The season cannot end before it starts.", path: ["endsOn"] });
export type SeasonBody = z.output<typeof seasonBody>;

export const kitBody = kitSchema;
export type KitBody = Kit;

export const rosterBody = z.object({ players: playersSchema });
export type RosterBody = z.output<typeof rosterBody>;

export const rosterImportBody = z.object({
  csv: z.string().min(1).max(250_000),
  header: z.boolean().optional(),
  mapping: z
    .object({
      name: z.number().int().min(0).max(50),
      number: z.number().int().min(0).max(50),
      sizeLabel: z.number().int().min(0).max(50),
      cut: z.number().int().min(0).max(50),
    })
    .partial()
    .optional(),
});
export type RosterImportBody = z.output<typeof rosterImportBody>;

export const inviteBody = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter an email address.")),
  role: z.enum(ASSIGNABLE_ROLES),
});
export const roleBody = z.object({ role: z.enum(ASSIGNABLE_ROLES) });

export const applyKitBody = z.object({
  projectId: z.uuid(),
  expectedVersion: z.number().int().min(1),
  parts: z.array(z.enum(APPLY_PARTS)).min(1, "Choose what to use.").max(APPLY_PARTS.length),
});
export type ApplyKitBody = z.output<typeof applyKitBody>;
