import { z } from "zod";
import { FLOW_SCOPES } from "./types";
import { FLOW_TEMPLATE_SLUGS } from "./templates";
import { OPERATIONS, UPSCALE_FACTORS } from "./operations";

/**
 * What the flow screens may send (plan v5 L6, decision 0096). The brand and the person are never in
 * a body: they come from the session.
 *
 * Nothing here can ask for a generated picture to become artwork, and nothing here carries a price.
 * A run's cost is read from the platform's credit prices on the server; a body that named its own
 * figure would be a body that could lie about money.
 *
 * This file carries zod, so it is deliberately left out of `index.ts`: a client component that
 * imported it would ship zod to the browser (`tests/architecture/client-weight.test.ts`).
 */

const slug = z.enum(FLOW_TEMPLATE_SLUGS as [string, ...string[]]);
const canvas = z.number().int().min(-1_000_000).max(1_000_000);

export const applyFlowTemplateBody = z.object({
  launchProjectId: z.uuid(),
  template: slug,
  /** The design the pack launches, written on the Design board as the pack opens. */
  designProjectId: z.uuid().nullable().default(null),
  designVersion: z.number().int().min(1).nullable().default(null),
  /** Where the pack is dropped, so a second pack does not land on the first. */
  x: canvas.default(0),
  y: canvas.default(0),
});
export type ApplyFlowTemplateBody = z.output<typeof applyFlowTemplateBody>;

export const runFlowBody = z.object({
  launchProjectId: z.uuid(),
  /** The board the button was pressed on, or null for the whole canvas. */
  boardId: z.uuid().nullable().default(null),
  scope: z.enum(FLOW_SCOPES),
  /**
   * The estimate the person was shown. The server works the estimate out again and refuses the run
   * when the two disagree, so a run can never cost more than the figure on the button.
   */
  shownCredits: z.number().int().min(0).max(1_000_000),
});
export type RunFlowBody = z.output<typeof runFlowBody>;

export const flowOperationBody = z.object({
  launchProjectId: z.uuid(),
  boardId: z.uuid(),
  operation: z.enum(OPERATIONS),
  factor: z
    .number()
    .int()
    .refine((value) => UPSCALE_FACTORS.includes(value), "Upscale goes 2 or 4 times.")
    .optional(),
  presetKey: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(64)
    .optional(),
});
export type FlowOperationBody = z.output<typeof flowOperationBody>;

/** Remix on the task bar over a picture: the board, and the figure the person was shown. */
export const remixFlowBoardBody = z.object({
  launchProjectId: z.uuid(),
  boardId: z.uuid(),
  shownCredits: z.number().int().min(0).max(1_000_000),
});
export type RemixFlowBoardBody = z.output<typeof remixFlowBoardBody>;

export const publishFlowListingBody = z.object({
  launchProjectId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  /** The boards to offer. Empty means every board with a finished output. */
  boardIds: z.array(z.uuid()).max(200).default([]),
});
export type PublishFlowListingBody = z.output<typeof publishFlowListingBody>;

export const exportFlowBody = z.object({
  launchProjectId: z.uuid(),
  boardIds: z.array(z.uuid()).max(200).default([]),
});
export type ExportFlowBody = z.output<typeof exportFlowBody>;
