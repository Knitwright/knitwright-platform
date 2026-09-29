import { z } from "zod";
import { familySchema, kebabId, labelText, sentenceText, wearerSchema } from "./primitives";

/**
 * The shapes of registry data. The registry says which options, points of measure and
 * panels a garment type has. It holds no measurement values and no quantities.
 */

const choiceSchema = z
  .object({ id: kebabId, label: labelText, help: sentenceText.optional() })
  .readonly();
export type OptionChoice = z.output<typeof choiceSchema>;

const hasUniqueIds = (items: readonly { id: string }[]): boolean =>
  new Set(items.map((item) => item.id)).size === items.length;

/** A question the designer answers, such as the neckline. */
export const optionSchema = z
  .object({
    id: kebabId,
    label: labelText,
    /** One plain sentence for people who do not know the term. Keep the label short. */
    help: sentenceText.optional(),
    choices: z.array(choiceSchema).min(1).readonly(),
    defaultChoice: kebabId,
  })
  .readonly()
  .refine((option) => hasUniqueIds(option.choices), {
    message: "Choices must not repeat.",
    path: ["choices"],
  })
  .refine((option) => option.choices.some((choice) => choice.id === option.defaultChoice), {
    message: "The default must be one of the choices.",
    path: ["defaultChoice"],
  });
export type OptionDefinition = z.output<typeof optionSchema>;

/** True when the named option has one of the listed choices. */
export const conditionSchema = z
  .object({ option: kebabId, in: z.array(kebabId).min(1).readonly() })
  .readonly();
export type Condition = z.output<typeof conditionSchema>;

const conditionsSchema = z.array(conditionSchema).readonly();

/**
 * Sections for laying out a measurement table. Tolerances and grade steps do not belong
 * in the registry. They live in the size chart data, keyed by point of measure id.
 */
export const POINT_GROUPS = ["body", "sleeve", "neck", "placket", "waist", "rise", "leg"] as const;
export const pointGroupSchema = z.enum(POINT_GROUPS);
export type PointGroup = z.output<typeof pointGroupSchema>;
export const POINT_GROUP_LABELS: Readonly<Record<PointGroup, string>> = {
  body: "Body",
  sleeve: "Sleeve",
  neck: "Neck and collar",
  placket: "Placket",
  waist: "Waist and hip",
  rise: "Rise",
  leg: "Leg",
};

export const pointOfMeasureSchema = z
  .object({
    id: kebabId,
    label: labelText,
    /** One plain sentence: where to lay the garment, and from which point to which. */
    howToMeasure: sentenceText,
    group: pointGroupSchema,
    /** Every condition must hold for the point to apply. Empty means always. */
    appliesWhen: conditionsSchema,
    /** Says why the point is left out when the conditions do not hold. */
    unavailableReason: sentenceText.optional(),
  })
  .readonly()
  .refine((point) => point.appliesWhen.length === 0 || point.unavailableReason !== undefined, {
    message: "A point that applies only sometimes needs a reason for when it does not.",
    path: ["unavailableReason"],
  });
export type PointOfMeasure = z.output<typeof pointOfMeasureSchema>;

const anchorSchema = z.object({ id: kebabId, label: labelText }).readonly();

/** A part of the garment that can have its own colour. */
export const panelSchema = z
  .object({
    id: kebabId,
    label: labelText,
    appliesWhen: conditionsSchema,
    /** Named places on the panel that artwork is measured from. Empty means no artwork. */
    anchors: z.array(anchorSchema).readonly(),
  })
  .readonly();
export type PanelDefinition = z.output<typeof panelSchema>;

/** A combination that cannot be made or sewn. It holds when every condition holds. */
export const ruleSchema = z
  .object({
    id: kebabId,
    when: z.array(conditionSchema).min(1).readonly(),
    reason: sentenceText,
  })
  .readonly();
export type Rule = z.output<typeof ruleSchema>;

const typeOptionSchema = z
  .object({
    option: kebabId,
    /** Narrows the choices this type offers. Leave out to offer them all. */
    choices: z.array(kebabId).min(1).readonly().optional(),
    /** The starting choice for this type. Leave out to use the option's default. */
    default: kebabId.optional(),
  })
  .readonly()
  .refine((entry) => entry.default === undefined || entry.choices === undefined || entry.choices.includes(entry.default), {
    message: "The default must be one of the offered choices.",
    path: ["default"],
  });
export type TypeOption = z.output<typeof typeOptionSchema>;

export const garmentTypeSchema = z
  .object({
    id: kebabId,
    family: familySchema,
    label: labelText,
    /** Which wearer size charts apply to this type. */
    wearers: z.array(wearerSchema).min(1).readonly(),
    options: z.array(typeOptionSchema).readonly(),
    pointsOfMeasure: z.array(kebabId).readonly(),
    panels: z.array(kebabId).readonly(),
  })
  .readonly()
  .refine((type) => new Set(type.wearers).size === type.wearers.length, {
    message: "Wearers must not repeat.",
    path: ["wearers"],
  });
export type GarmentType = z.output<typeof garmentTypeSchema>;

/**
 * A kind of stitch, named by its ISO 4915 number. The number names a kind of stitch that a
 * factory reads. It is not a quantity. These are the only numbers the registry may hold.
 */
export const stitchClassSchema = z
  .object({
    id: kebabId,
    iso: z.string().regex(/^\d{3}$/, "An ISO 4915 stitch type has three digits."),
    name: labelText,
    explanation: sentenceText,
  })
  .readonly();
export type StitchClass = z.output<typeof stitchClassSchema>;

/** A kind of seam, named by its ISO 4916 class number. Also a name, not a quantity. */
export const seamClassSchema = z
  .object({
    id: kebabId,
    iso: z.string().regex(/^\d$/, "An ISO 4916 seam class has one digit."),
    name: labelText,
    explanation: sentenceText,
  })
  .readonly();
export type SeamClass = z.output<typeof seamClassSchema>;

/**
 * A seam of the garment, and the rule that proposes how it is sewn. The classes are a
 * starting proposal from general knitwear practice. A factory confirms or changes them.
 */
export const seamSchema = z
  .object({
    id: kebabId,
    label: labelText,
    /** The panels the seam joins, or for an edge finish the panels whose edge it finishes. */
    panels: z.array(kebabId).min(1).readonly(),
    /** Every condition must hold for the seam to apply. Empty means always. */
    appliesWhen: conditionsSchema,
    /** The seam is left out when every one of these holds. Empty means never. */
    unlessWhen: conditionsSchema,
    seamClass: kebabId,
    stitchClass: kebabId,
  })
  .readonly();
export type SeamDefinition = z.output<typeof seamSchema>;

export const COMPONENT_KINDS = ["rib", "thread", "label", "trim"] as const;
export const componentKindSchema = z.enum(COMPONENT_KINDS);
export type ComponentKind = z.output<typeof componentKindSchema>;

/**
 * Something the design implies, such as buttons for a buttoned placket. It names what is
 * needed and holds no quantity. The user describes it and gives any quantity.
 */
export const componentSlotSchema = z
  .object({
    id: kebabId,
    label: labelText,
    kind: componentKindSchema,
    help: sentenceText,
    appliesWhen: conditionsSchema,
    /** The panels it is used on, for display. May be empty. */
    panels: z.array(kebabId).readonly(),
    /** True when Knitwright proposes this part from general practice, and nobody has confirmed it. */
    proposal: z.boolean(),
  })
  .readonly();
export type ComponentSlot = z.output<typeof componentSlotSchema>;

/** Everything one family contributes to the registry. */
export const familyDataSchema = z
  .object({
    id: familySchema,
    label: labelText,
    options: z.array(optionSchema).readonly(),
    pointsOfMeasure: z.array(pointOfMeasureSchema).readonly(),
    panels: z.array(panelSchema).readonly(),
    rules: z.array(ruleSchema).readonly(),
    seams: z.array(seamSchema).readonly(),
    components: z.array(componentSlotSchema).readonly(),
    types: z.array(garmentTypeSchema).readonly(),
  })
  .readonly();
export type FamilyData = z.output<typeof familyDataSchema>;
