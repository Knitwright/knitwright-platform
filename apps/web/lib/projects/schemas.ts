import { z } from "zod";
import { WEARERS, freeText } from "@/lib/garment";
import { offeredTypeSchema } from "@/lib/guided/start";
import { MAX_UTTERANCE_LENGTH } from "@/lib/intent/text-flow";

/** Limits on the text of a project. The database enforces the same ones. */
export const PROJECT_NAME_MAX = 80;
export const PROJECT_TEXT_MAX = 40;

const NAME_RULE = `A design name has 1 to ${PROJECT_NAME_MAX} characters.`;

const CONTROL_CHARACTER = /\p{Cc}/u;

export const projectNameSchema = z
  .string()
  .trim()
  .min(1, NAME_RULE)
  .max(PROJECT_NAME_MAX, NAME_RULE)
  .refine((text) => !CONTROL_CHARACTER.test(text), "Remove line breaks and hidden characters.");

/** A style number or a season. It may be empty. */
export const projectTextSchema = freeText(PROJECT_TEXT_MAX).default("");

/** The largest whole number the database holds in an integer column. */
export const MAX_VERSION = 2147483647;

const projectId = z.uuid("That is not a design.");
const expectedVersion = z.number().int().min(1).max(MAX_VERSION);

export const createProjectSchema = z.object({
  typeId: offeredTypeSchema,
  wearer: z.enum(WEARERS, "Choose who it is for."),
  name: projectNameSchema,
  styleNumber: projectTextSchema,
  season: projectTextSchema,
});

export const projectDetailsSchema = z.object({
  projectId,
  name: projectNameSchema,
  styleNumber: projectTextSchema,
  season: projectTextSchema,
});

/** The change itself is checked by the garment library, which refuses what it does not know. */
export const applyDesignActionSchema = z.object({
  projectId,
  expectedVersion,
  action: z.unknown(),
});

export const restoreVersionSchema = z.object({
  projectId,
  expectedVersion,
  version: z.number().int().min(1).max(MAX_VERSION),
});

export const designIdSchema = z.object({ projectId });

export const undoDesignSchema = z.object({ projectId, expectedVersion });

/** A proposal the assistant made, handed back to be applied. It is signed by the server. */
export const PROPOSAL_TOKEN_MAX = 64_000;

export const applyProposalSchema = z.object({
  projectId,
  expectedVersion,
  token: z.string().min(1).max(PROPOSAL_TOKEN_MAX),
});

/** One message to the assistant, with the version of the design the person is looking at. */
export const assistantMessageSchema = z.object({
  utterance: z
    .string()
    .trim()
    .min(1, "Type what you would like to change.")
    .max(MAX_UTTERANCE_LENGTH, `Keep it to ${MAX_UTTERANCE_LENGTH} characters.`),
  expectedVersion,
});

/** An uploaded sketch or photo to read, with the version of the design the person is looking at. */
export const readImageSchema = z.object({ fileId: z.uuid("Upload the picture again."), expectedVersion });
