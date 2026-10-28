import { z } from "zod";
import { SWATCH_PATTERN, fabricChangesSchema, labellingFieldSchema, wearerSchema } from "@/lib/garment";
import { removeKitPatternWire, setKitPatternWire } from "./kit-pattern";

/**
 * The reply a model must give, as JSON. Every object is strict: a field the contract does
 * not have makes the reply unreadable, so nothing a model adds is quietly ignored. The
 * model never states where a value came from; everything it sets is marked
 * `ai-suggested` when it is turned into an editor change.
 */

export const MAX_ACTIONS = 12;
export const MAX_CHOICES = 5;
const TEXT_MAX_LENGTH = 400;
const LABEL_MAX_LENGTH = 80;

/** Model text shown to a person: whitespace, line breaks and hidden characters become single spaces. */
const shownText = (max: number) =>
  z
    .string()
    .transform((text) => text.replace(/[\s\p{Cc}]+/gu, " ").trim())
    .pipe(z.string().min(1).max(max));

const id = z.string().min(1).max(64);

/** The changes a model may ask for. Each becomes one editor `SpecAction`, except `ask-amount`. */
export const WIRE_ACTION_TYPES = [
  "set-option",
  "change-type",
  "change-wearer",
  "set-measurement",
  "remove-measurement",
  "set-colour",
  "change-fabric",
  "set-labelling",
  "add-names-numbers",
  "ask-amount",
  "set-kit-pattern",
  "remove-kit-pattern",
] as const;

export const wireActionSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("set-option"), optionId: id, choiceId: id }),
  z.strictObject({ type: z.literal("change-type"), typeId: id }),
  z.strictObject({ type: z.literal("change-wearer"), wearer: wearerSchema }),
  /** In centimetres, as a person says it. It is stored in tenths of a millimetre. */
  z.strictObject({ type: z.literal("set-measurement"), pointId: id, cm: z.number().finite().positive() }),
  z.strictObject({ type: z.literal("remove-measurement"), pointId: id }),
  z.strictObject({
    type: z.literal("set-colour"),
    panels: z.array(id).min(1).max(12),
    colour: z.string().max(LABEL_MAX_LENGTH),
    swatch: z.string().regex(SWATCH_PATTERN).optional(),
    /** The first colourway when left out. */
    colourwayId: id.optional(),
  }),
  z.strictObject({
    type: z.literal("change-fabric"),
    /** The first fabric when left out. */
    fabricId: id.optional(),
    changes: fabricChangesSchema,
  }),
  z.strictObject({ type: z.literal("set-labelling"), field: labellingFieldSchema, text: z.string().max(TEXT_MAX_LENGTH) }),
  /** Player names and numbers at the usual places of the garment (decision 0027). */
  z.strictObject({ type: z.literal("add-names-numbers") }),
  /**
   * A length asked for without an amount, such as "a bit longer". It changes nothing: the
   * person is asked how much, so the number is theirs, while the rest of the request is made.
   */
  z.strictObject({ type: z.literal("ask-amount"), pointId: id, direction: z.enum(["longer", "shorter"]) }),
  /** A kit pattern printed over the body (owner decision 2026-10-13). */
  setKitPatternWire,
  removeKitPatternWire,
]);
export type WireAction = z.output<typeof wireActionSchema>;

const actionList = z.array(z.unknown()).max(MAX_ACTIONS);

export const replySchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("changes"), actions: actionList.min(1) }),
  z
    .strictObject({
      kind: z.literal("question"),
      question: shownText(TEXT_MAX_LENGTH),
      choices: z
        .array(z.strictObject({ label: shownText(LABEL_MAX_LENGTH), actions: actionList.default([]) }))
        .min(2)
        .max(MAX_CHOICES),
      recommended: z.number().int().min(0).default(0),
    })
    .refine((reply) => reply.recommended < reply.choices.length),
  z.strictObject({ kind: z.literal("rejection"), reason: shownText(TEXT_MAX_LENGTH) }),
]);
export type Reply = z.output<typeof replySchema>;
