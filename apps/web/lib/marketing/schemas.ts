import { z } from "zod";
import { RULE_ID } from "@/lib/rulebook/constants";
import { CAMPAIGNS } from "./campaign/steps";
import { COLOUR_SPACES, FILE_FORMATS } from "./export/targets";
import { COLOUR_ROLES, MARKETING_FORMATS, MARKETING_GROUPS, SLOT_KINDS, TEXT_STYLES } from "./templates/types";

/**
 * The shapes read back out of the database (plan v5 L4, decision 0094).
 *
 * zod lives here and nowhere a component can reach it, as `lib/launch` does the same: a client
 * component that imports a module holding a schema ships all of zod to the browser
 * (`tests/architecture/client-weight.test.ts`).
 *
 * Nothing is trusted because it came from our own table. A row that does not parse is a row the
 * panel will not draw: a layout with a slot off the artboard, or a format no preset row matches,
 * would be a layout the export panel could not honour.
 */

const fraction = z.number().min(0).max(1);

export const slotRowSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(SLOT_KINDS),
  label: z.string().min(1).max(80),
  rect: z.object({ x: fraction, y: fraction, width: z.number().gt(0).max(1), height: z.number().gt(0).max(1) }),
  colourRole: z.enum(COLOUR_ROLES),
  style: z.enum(TEXT_STYLES).nullable(),
  limit: z.number().int().positive().max(2000).nullable(),
  placeholder: z.string().max(120).nullable(),
  pixelLocked: z.boolean(),
  ruleId: z.string().regex(RULE_ID),
});

/** What `templates.snapshot` holds for a row of kind `marketing`. */
export const marketingSnapshotSchema = z.object({
  kind: z.literal("marketing"),
  schemaVersion: z.literal(1),
  layoutKey: z.string().min(1).max(64),
  group: z.enum(MARKETING_GROUPS),
  format: z.enum(MARKETING_FORMATS),
  lead: z.string().min(1).max(200),
  label: z.string().min(1).max(200),
  ruleId: z.string().regex(RULE_ID),
  slots: z.array(slotRowSchema).min(1).max(32),
});

export type MarketingSnapshotRow = z.infer<typeof marketingSnapshotSchema>;

/**
 * What "Write for me" may send (spec F-L2; the wiring of decision 0094). **The slot itself is not
 * in the body**: a caller says which board and which slot id, and the server reads the board, the
 * template that board took on and that template's own slot. A well-formed slot in a body would
 * still be a slot the caller wrote, and a model may only ever be asked to fill a text field the
 * library really holds.
 */
export const writeCopyBody = z.object({
  launchProjectId: z.uuid(),
  boardId: z.uuid(),
  slotId: z.string().min(1).max(64),
  /** What the person said they want to highlight (the campaign form's step 4), or "". */
  highlight: z.string().trim().max(200).default(""),
  campaign: z.enum(CAMPAIGNS).nullable().default(null),
});
export type WriteCopyBody = z.output<typeof writeCopyBody>;

/** One row of `marketing_export_targets`. The vocabularies are `export/targets.ts`, which carries no zod. */
export const exportTargetSchema = z.object({
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(80),
  lead: z.string().min(1).max(200),
  file_format: z.enum(FILE_FORMATS),
  colour_space: z.enum(COLOUR_SPACES),
  dpi: z.number().int().positive().max(1200),
  scale: z.coerce.number().positive().max(10),
  quick: z.boolean(),
  sort: z.number().int(),
  rule_id: z.string().regex(RULE_ID),
  note: z.string().min(1).max(200),
});

/** One row of `marketing_watermark_rules`. */
export const watermarkRuleSchema = z.object({
  plan: z.enum(["free", "paid"]),
  label: z.string().min(1).max(80),
  watermarked: z.boolean(),
  max_dpi: z.number().int().positive().max(1200),
  rule_id: z.string().regex(RULE_ID),
  note: z.string().min(1).max(200),
});
