import {
  SWATCH_PATTERN,
  colourwaySchema,
  panelsFor,
  sizeValueFor,
  toleranceFor,
  type GarmentSpec,
  type PanelColour,
  type SpecAction,
} from "@/lib/garment";
import type { TechPack } from "@/lib/techpack";
import { normaliseSwatch } from "./colour-controls";
import { cmText, parseCmInput } from "./measurement-input";
import type { FormAction, FormErrors } from "./tech-pack-forms";

/**
 * The forms on the tech pack page for measurements and colourways, as plain functions: what
 * each form shows, and the changes a form builds from what was typed. They use the same
 * reading of centimetres and colours as the editor, so a value means the same in both places.
 */

const USER = "user-edited" as const;

/** Several changes from one form, saved together as one version. */
export type FormBatch = Readonly<{ ok: true; actions: readonly SpecAction[] }> | Readonly<{ ok: false; errors: FormErrors }>;

// Measurements

export interface MeasureField {
  /** The name of the field in its form. */
  readonly name: string;
  readonly label: string;
  /** Centimetres, ready for the field. Empty when there is no value. */
  readonly text: string;
  readonly tenthsMm: number | null;
  /** True when the person typed this value, so emptying the field removes it. */
  readonly own: boolean;
  /** The size the value is for, or null for the base size, or the only column when there are no sizes. */
  readonly size: string | null;
}

export interface MeasurementFormRow {
  readonly pointId: string;
  readonly code: string;
  readonly label: string;
  readonly values: readonly MeasureField[];
  readonly tolerance: MeasureField;
}

const TOLERANCE_FIELD = "tolerance";

/** One form for each point of measure: a field for each size, and one for the tolerance. */
export function measurementFormRows(spec: GarmentSpec, pack: TechPack): readonly MeasurementFormRow[] {
  const { columns, groups } = pack.measurements;
  return groups.flatMap((group) =>
    group.rows.map((row) => {
      const values = row.values.map((cell, index): MeasureField => {
        const column = columns[index];
        const size = !column || column.isBase ? null : column.size;
        const tenthsMm = cell.status === "set" ? cell.tenthsMm : null;
        const where = column?.size === null || column === undefined ? "" : ` at size ${column.label}${column.isBase ? ", the base size" : ""}`;
        return {
          name: `value-${index}`,
          label: `${row.label}${where}, in centimetres`,
          text: tenthsMm === null ? "" : cmText(tenthsMm),
          tenthsMm,
          own: size === null ? spec.measurements.some((entry) => entry.pointId === row.pointId) : sizeValueFor(spec, row.pointId, size) !== undefined,
          size,
        };
      });
      const tolerance = row.tolerance.status === "set" ? row.tolerance.tenthsMm : null;
      return {
        pointId: row.pointId,
        code: row.code,
        label: row.label,
        values,
        tolerance: {
          name: TOLERANCE_FIELD,
          label: `Tolerance of ${row.label.toLowerCase()}, plus or minus, in centimetres`,
          text: tolerance === null ? "" : cmText(tolerance),
          tenthsMm: tolerance,
          own: toleranceFor(spec, row.pointId) !== undefined,
          size: null,
        },
      };
    }),
  );
}

/** A tolerance may be typed with its sign, as it is printed. The sign is the same either way. */
const withoutSign = (text: string): string => text.trim().replace(/^(?:±|\+\/-|\+-)\s*/, "");

type Change = Readonly<{ action: SpecAction | null }> | Readonly<{ error: string }>;

function valueChange(pointId: string, field: MeasureField, typed: string): Change {
  const text = typed.trim();
  if (text === "") {
    if (!field.own) return { action: null };
    return {
      action: field.size === null ? { type: "remove-measurement", pointId } : { type: "remove-size-measurement", pointId, size: field.size },
    };
  }
  const parsed = parseCmInput(text);
  if (!parsed.ok) return { error: parsed.reason };
  if (parsed.tenths === field.tenthsMm) return { action: null };
  const value = parsed.tenths;
  return {
    action:
      field.size === null
        ? { type: "set-measurement", pointId, value, provenance: USER }
        : { type: "set-size-measurement", entry: { pointId, size: field.size, value, provenance: USER } },
  };
}

function toleranceChange(pointId: string, field: MeasureField, typed: string): Change {
  const text = withoutSign(typed);
  if (text === "") return { action: field.own ? { type: "remove-tolerance", pointId } : null };
  const parsed = parseCmInput(text);
  if (!parsed.ok) return { error: parsed.reason };
  if (parsed.tenths === field.tenthsMm) return { action: null };
  return { action: { type: "set-tolerance", entry: { pointId, value: parsed.tenths, provenance: USER } } };
}

/**
 * The changes for one measurement form. Only fields that differ from what the design holds are
 * sent. Emptying a value the person typed removes it; emptying a value from a chart does nothing.
 * Every mistake is reported beside its field, and then nothing is sent.
 */
export function measurementFormActions(row: MeasurementFormRow, typed: Readonly<Record<string, string>>): FormBatch {
  const changes = [
    ...row.values.map((field) => [field.name, valueChange(row.pointId, field, typed[field.name] ?? "")] as const),
    [row.tolerance.name, toleranceChange(row.pointId, row.tolerance, typed[row.tolerance.name] ?? "")] as const,
  ];
  const errors = Object.fromEntries(changes.flatMap(([name, change]) => ("error" in change ? [[name, change.error]] : [])));
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, actions: changes.flatMap(([, change]) => ("action" in change && change.action ? [change.action] : [])) };
}

// Colourways

export interface ColourwayPanelField {
  readonly panelId: string;
  readonly label: string;
  /** The colour code a factory uses. */
  readonly code: string;
  /** The colour drawn on screen, as #rrggbb, or empty. */
  readonly screen: string;
}

export interface ColourwayFormRow {
  readonly colourwayId: string;
  readonly name: string;
  readonly panels: readonly ColourwayPanelField[];
}

export const codeField = (panelId: string): string => `code:${panelId}`;
export const screenField = (panelId: string): string => `screen:${panelId}`;

/** One form for each colourway, with a colour code and a screen colour for each part. */
export const colourwayFormRows = (spec: GarmentSpec): readonly ColourwayFormRow[] =>
  spec.colourways.map((colourway) => ({
    colourwayId: colourway.id,
    name: colourway.name,
    panels: panelsFor(spec).map((panel) => {
      const entry = colourway.colours.find((colour) => colour.panelId === panel.id);
      return { panelId: panel.id, label: panel.label, code: entry?.colour ?? "", screen: entry?.swatch ?? "" };
    }),
  }));

const BAD_SWATCH = "Write the screen colour as # and six letters or numbers, such as #1b2a49, or leave it empty.";
const GONE = "This colourway is no longer in the design. Reload the page.";

const sameEntry = (a: PanelColour | undefined, b: PanelColour | null): boolean =>
  (a === undefined && b === null) || (a !== undefined && b !== null && a.colour === b.colour && a.swatch === b.swatch);

/**
 * The change for a colourway form. It is worked out from the design as it will be once the
 * waiting changes are saved, so two forms saved one after the other keep each other's colours.
 * A part with no code and no screen colour has no entry. Nothing is sent when nothing changed.
 */
export function colourwayFormAction(spec: GarmentSpec, colourwayId: string, typed: Readonly<Record<string, string>>): FormAction {
  const colourway = spec.colourways.find((entry) => entry.id === colourwayId);
  if (!colourway) return { ok: false, errors: { form: GONE } };
  const errors: Record<string, string> = {};
  const next = panelsFor(spec).map((panel) => {
    const code = (typed[codeField(panel.id)] ?? "").trim();
    const swatch = normaliseSwatch(typed[screenField(panel.id)] ?? "");
    if (swatch !== null && !SWATCH_PATTERN.test(swatch)) errors[screenField(panel.id)] = BAD_SWATCH;
    const entry: PanelColour | null =
      code === "" && swatch === null ? null : { panelId: panel.id, colour: code, ...(swatch === null ? {} : { swatch }), provenance: USER };
    return { before: colourway.colours.find((colour) => colour.panelId === panel.id), entry };
  });
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (next.every(({ before, entry }) => sameEntry(before, entry))) return { ok: true, action: null };
  const colours = next.flatMap(({ entry }) => (entry ? [entry] : []));
  const checked = colourwaySchema.safeParse({ id: colourway.id, name: colourway.name, colours });
  if (!checked.success) return { ok: false, errors: { form: checked.error.issues[0]?.message ?? "Those colours cannot be used." } };
  return { ok: true, action: { type: "update-colourway", colourway: checked.data } };
}
