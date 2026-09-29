import {
  COMPONENT_KIND_LABELS,
  LABELLING_FIELDS,
  FABRIC_WEIGHT_MAX_GSM,
  LABELLING_LABELS,
  STRETCH_VALUES,
  componentSlotsFor,
  fabricFor,
  listSeamClasses,
  listStitchClasses,
  panelsFor,
  seamClassById,
  seamsFor,
  specActionSchema,
  stitchClassById,
  type GarmentSpec,
  type LabellingField,
  type SpecAction,
} from "@/lib/garment";
import { listOf } from "@/lib/techpack/text";

/**
 * The logic of the forms on the tech pack page, as plain functions: what each form shows
 * from the design, and the change that a form builds from what was typed. The components
 * only hold markup. A form never says where a value came from: the server does.
 */

export type FormErrors = Readonly<Record<string, string>>;
export type FormResult<T = SpecAction> =
  | Readonly<{ ok: true; action: T }>
  | Readonly<{ ok: false; errors: FormErrors }>;

const USER = "user-edited" as const;
const WEIGHT_TEXT = /^(\d+)(?:\s*gsm)?$/i;
const WEIGHT_HELP = "Enter the weight as a whole number of grams per square metre, such as 180.";

type Choice = Readonly<{ id: string; label: string }>;

export const STRETCH_CHOICES: readonly Choice[] = [
  { id: "not-set", label: "Not set" },
  { id: "none", label: "No stretch" },
  { id: "two-way", label: "Two-way stretch" },
  { id: "four-way", label: "Four-way stretch" },
];

export const SEAM_CLASS_CHOICES: readonly Choice[] = listSeamClasses().map((entry) => ({
  id: entry.id,
  label: `${entry.name}, ISO ${entry.iso}`,
}));

export const STITCH_CLASS_CHOICES: readonly Choice[] = listStitchClasses().map((entry) => ({
  id: entry.id,
  label: `${entry.name}, ISO ${entry.iso}`,
}));

/** Turns what the schema found wrong into one message for each field, using the last step of the path that names a field. */
function errorsFrom(issues: readonly { path: PropertyKey[]; message: string }[], depth: number, rename: FormErrors = {}): FormErrors {
  const found: Record<string, string> = {};
  for (const issue of issues) {
    const name = String(issue.path[depth] ?? issue.path[issue.path.length - 1] ?? "form");
    const field = rename[name] ?? name;
    if (!(field in found)) found[field] = issue.message;
  }
  return found;
}

/** Reads a change with the design contract's own rules. */
function validated(action: unknown, depth: number, rename?: FormErrors): FormResult {
  const parsed = specActionSchema.safeParse(action);
  return parsed.success ? { ok: true, action: parsed.data } : { ok: false, errors: errorsFrom(parsed.error.issues, depth, rename) };
}

export type FormAction = Readonly<{ ok: true; action: SpecAction | null }> | Readonly<{ ok: false; errors: FormErrors }>;

// Fabrics

export interface FabricValues {
  readonly name: string;
  readonly composition: string;
  readonly construction: string;
  /** Grams per square metre, as typed. */
  readonly weight: string;
  readonly finish: string;
  readonly consumption: string;
  readonly stretch: string;
}

export interface FabricFormRow {
  readonly id: string;
  readonly values: FabricValues;
  /** The panels that use this fabric now. */
  readonly usedBy: readonly string[];
  readonly canRemove: boolean;
}

export function fabricRows(spec: GarmentSpec): readonly FabricFormRow[] {
  const panels = panelsFor(spec);
  return spec.fabrics.map((fabric) => ({
    id: fabric.id,
    values: {
      name: fabric.name,
      composition: fabric.composition,
      construction: fabric.construction,
      weight: fabric.weightGsm === null ? "" : String(fabric.weightGsm),
      finish: fabric.finish,
      consumption: fabric.consumption,
      stretch: fabric.stretch,
    },
    usedBy: panels.filter((panel) => fabricFor(spec, panel.id).id === fabric.id).map((panel) => panel.label),
    canRemove: spec.fabrics.length > 1,
  }));
}

export interface PanelFabricRow {
  readonly panelId: string;
  readonly label: string;
  /** The fabric the panel uses now. */
  readonly fabricId: string;
  readonly choices: readonly Choice[];
}

export function panelFabricRows(spec: GarmentSpec): readonly PanelFabricRow[] {
  const choices = spec.fabrics.map((fabric) => ({ id: fabric.id, label: fabric.name }));
  return panelsFor(spec).map((panel) => ({
    panelId: panel.id,
    label: panel.label,
    fabricId: fabricFor(spec, panel.id).id,
    choices,
  }));
}

function weightFrom(text: string): number | null | "bad" {
  if (text.trim() === "") return null;
  const found = WEIGHT_TEXT.exec(text.trim());
  return found ? Number(found[1]) : "bad";
}

type FabricFieldName = Exclude<keyof FabricValues, "weight">;
const FABRIC_TEXT_FIELDS: readonly FabricFieldName[] = ["name", "composition", "construction", "finish", "consumption", "stretch"];

/**
 * The change for a fabric form. A new fabric is added with every field it was given. For a
 * fabric that exists, only the fields that differ from what it holds are sent, so a field that
 * was not touched keeps its source. Nothing is sent when nothing changed.
 */
export function fabricAction(id: string, values: FabricValues, current: FabricValues | null): FormAction {
  const weight = weightFrom(values.weight);
  if (weight === "bad" || (weight !== null && (weight < 1 || weight > FABRIC_WEIGHT_MAX_GSM))) {
    return { ok: false, errors: { weight: weight === "bad" ? WEIGHT_HELP : `The weight must be between 1 and ${FABRIC_WEIGHT_MAX_GSM}.` } };
  }
  if (!(STRETCH_VALUES as readonly string[]).includes(values.stretch)) {
    return { ok: false, errors: { stretch: "Choose a stretch from the list." } };
  }
  if (current === null) {
    const fabric = { ...textOf(values), id, weightGsm: weight, provenance: USER };
    return validated({ type: "add-fabric", fabric }, 1);
  }
  const changed = FABRIC_TEXT_FIELDS.filter((field) => values[field].trim() !== current[field]);
  const weightChanged = weight !== weightFrom(current.weight);
  const changes = {
    ...Object.fromEntries(changed.map((field) => [field, values[field]])),
    ...(weightChanged ? { weightGsm: weight } : {}),
  };
  if (Object.keys(changes).length === 0) return { ok: true, action: null };
  return validated({ type: "change-fabric", id, changes, provenance: USER }, 2);
}

const textOf = (values: FabricValues) => ({
  name: values.name,
  composition: values.composition,
  construction: values.construction,
  finish: values.finish,
  consumption: values.consumption,
  stretch: values.stretch,
});

// Components

export interface ComponentValues {
  readonly name: string;
  readonly details: string;
  readonly quantity: string;
  /** "used", or "not-used" when the brand does not use this part. */
  readonly used: string;
}

export const USED_CHOICES: readonly Choice[] = [
  { id: "used", label: "Used" },
  { id: "not-used", label: "Not used" },
];

export interface ComponentRow {
  readonly slotId: string;
  readonly label: string;
  readonly kindLabel: string;
  readonly help: string;
  readonly values: ComponentValues;
  readonly hasEntry: boolean;
}

export function componentRows(spec: GarmentSpec): readonly ComponentRow[] {
  return componentSlotsFor(spec).map((slot) => {
    const entry = spec.components.find((candidate) => candidate.id === slot.id);
    return {
      slotId: slot.id,
      label: slot.label,
      kindLabel: COMPONENT_KIND_LABELS[slot.kind],
      help: slot.help,
      values: {
        name: entry?.name ?? "",
        details: entry?.details ?? "",
        quantity: entry?.quantity ?? "",
        used: entry?.notUsed === true ? "not-used" : "used",
      },
      hasEntry: entry !== undefined,
    };
  });
}

const isEmpty = (...texts: readonly string[]): boolean => texts.every((text) => text.trim() === "");

/** The change for a component form. Every field emptied removes what was written. A part marked not used keeps no details. */
export function componentAction(slotId: string, values: ComponentValues, hasEntry: boolean): FormAction {
  if (!USED_CHOICES.some((choice) => choice.id === values.used)) {
    return { ok: false, errors: { used: "Choose used or not used." } };
  }
  if (values.used === "not-used") {
    const entry = { id: slotId, name: "", details: "", quantity: "", notUsed: true, provenance: USER };
    return validated({ type: "set-component", component: entry }, 1);
  }
  if (isEmpty(values.name, values.details, values.quantity)) {
    return { ok: true, action: hasEntry ? { type: "remove-component", id: slotId } : null };
  }
  const { name, details, quantity } = values;
  return validated({ type: "set-component", component: { id: slotId, name, details, quantity, provenance: USER } }, 1);
}

// Construction

export interface ConstructionValues {
  /** A seam class id, or empty to keep the registry proposal. */
  readonly seamClass: string;
  readonly stitchClass: string;
  readonly stitchDensity: string;
}

export interface SeamRow {
  readonly seamId: string;
  readonly label: string;
  readonly panels: string;
  /** What the registry proposes, in words. */
  readonly proposal: Readonly<{ seamClass: string; stitchClass: string }>;
  readonly values: ConstructionValues;
  readonly hasEntry: boolean;
}

export function seamRows(spec: GarmentSpec): readonly SeamRow[] {
  return seamsFor(spec).map((seam) => {
    const entry = spec.construction.find((candidate) => candidate.seamId === seam.id);
    return {
      seamId: seam.id,
      label: seam.label,
      panels: listOf(seam.panels.map((panel) => panel.label)),
      proposal: { seamClass: seam.seamClass.name, stitchClass: seam.stitchClass.name },
      values: {
        seamClass: entry?.seamClass ?? "",
        stitchClass: entry?.stitchClass ?? "",
        stitchDensity: entry?.stitchDensity ?? "",
      },
      hasEntry: entry !== undefined,
    };
  });
}

/** The change for a seam form. Back to the proposal with no density removes what was entered. */
export function constructionAction(seamId: string, values: ConstructionValues, hasEntry: boolean): FormAction {
  if (values.seamClass !== "" && !seamClassById(values.seamClass)) {
    return { ok: false, errors: { seamClass: "Choose a seam class from the list." } };
  }
  if (values.stitchClass !== "" && !stitchClassById(values.stitchClass)) {
    return { ok: false, errors: { stitchClass: "Choose a stitch class from the list." } };
  }
  if (values.seamClass === "" && values.stitchClass === "" && values.stitchDensity.trim() === "") {
    return { ok: true, action: hasEntry ? { type: "remove-construction", seamId } : null };
  }
  const entry = {
    seamId,
    ...(values.seamClass === "" ? {} : { seamClass: values.seamClass }),
    ...(values.stitchClass === "" ? {} : { stitchClass: values.stitchClass }),
    stitchDensity: values.stitchDensity,
    provenance: USER,
  };
  return validated({ type: "set-construction", entry }, 1);
}

// Labels and packing

export interface LabellingFormRow {
  readonly field: LabellingField;
  readonly label: string;
  readonly text: string;
}

export const labellingRows = (spec: GarmentSpec): readonly LabellingFormRow[] =>
  LABELLING_FIELDS.map((field) => ({ field, label: LABELLING_LABELS[field], text: spec.labelling[field]?.text ?? "" }));

/** The change for a labelling field. Emptied text clears a field that was set. */
export function labellingAction(field: LabellingField, text: string, hasEntry: boolean): FormAction {
  if (text.trim() === "" && !hasEntry) return { ok: true, action: null };
  return validated({ type: "set-labelling", field, text, provenance: USER }, 0, { text: "text" });
}
