import type { ParamSpec } from "@/lib/artwork-stack/generator";
import { dotParamsOf, dotsLayoutOf, kitGeneratorId, sizeParamOf } from "@/lib/artwork-stack/legacy/kit-styles";
import { mmFromTenths, tenthsFromMm } from "@/lib/artwork-stack/units";
import type { EditorDesign } from "@/lib/editor/slots";
import { KIT_PATTERN_LABELS, MAX_PATTERN_COLOURS, SWATCH_PATTERN, type KitPattern, type KitPatternStyle, type PatternColour } from "@/lib/garment";
import { getGenerator } from "@/lib/pattern-generators";
import { GAP_RULE_ID } from "@/lib/rulebook/constants";
import type { Applied } from "./apply";

/**
 * The pattern-fill popover of spec F-S4 (plan v5 Y3, decision 0076): the tile, the colours, the
 * sizes in millimetres with a ratio lock, apply to all, and delete.
 *
 * Every control is generated from the style's **own** declared settings — the `ParamSpec` list of
 * the generator that draws it — narrowed to the settings a stored design can actually hold
 * (`kitPatternSchema`). A setting the spec's popover asks for that the design has no field for is
 * not drawn as a control that does nothing: it is listed, with the reason, under `unstored`. That is
 * the plan's rule, a labelled gap and a question rather than a dead parameter.
 */

export interface FillField {
  readonly id: string;
  readonly label: string;
  readonly unit: ParamSpec["unit"];
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** Null when the design holds no value for it: shown as "not set", never as zero. */
  readonly value: number | boolean | null;
}

/** A control the spec asks for that a design cannot store yet. Shown as a note, never as a slider. */
export interface Unstored {
  readonly label: string;
  readonly reason: string;
  readonly ruleId: string;
}

export interface FillTarget {
  readonly kind: "all" | "panel";
  readonly label: string;
  /** Null when the target can be used, else why it cannot. */
  readonly reason: string | null;
}

export interface FillView {
  readonly style: KitPatternStyle;
  readonly styleLabel: string;
  readonly colours: readonly PatternColour[];
  readonly maxColours: number;
  readonly fields: readonly FillField[];
  readonly unstored: readonly Unstored[];
  /** The fields a ratio lock ties together: every millimetre field that has a value. */
  readonly lockable: readonly string[];
  readonly targets: readonly FillTarget[];
}

const WHOLE_BODY = "A kit pattern is printed over the body of the whole garment, so it cannot go on one panel on its own.";
const NOT_STORED = "A design has no field for this yet, so the editor will not pretend to set it.";

const DOT_IDS = ["pitchMm", "rowStepMm", "halfDrop", "clearSpaceMm"] as const;

/** The settings of this style that a stored design can hold. */
export function storedIdsOf(style: KitPatternStyle): readonly string[] {
  return style === "dots" ? [sizeParamOf(style), ...DOT_IDS] : [sizeParamOf(style)];
}

/** What the design holds now, as the generator's own settings in millimetres. */
export function valuesOf(pattern: KitPattern): Readonly<Record<string, number | boolean>> {
  return {
    ...(pattern.size === undefined ? {} : { [sizeParamOf(pattern.style)]: mmFromTenths(pattern.size) }),
    ...dotParamsOf(pattern.dots),
  };
}

/** The controls the spec asks for that this style's stored shape has no room for. */
function unstoredOf(style: KitPatternStyle): readonly Unstored[] {
  const band = style !== "dots";
  return [
    ...(band ? [{ label: "Height", reason: `A ${KIT_PATTERN_LABELS[style].toLowerCase()} pattern stores one width and no height. ${NOT_STORED}`, ruleId: GAP_RULE_ID }] : []),
    ...(band ? [{ label: "Padding", reason: `The spacing of a ${KIT_PATTERN_LABELS[style].toLowerCase()} pattern follows its width. ${NOT_STORED}`, ruleId: GAP_RULE_ID }] : []),
    { label: "Rotation", reason: `A kit pattern is drawn at the angle its style defines. ${NOT_STORED}`, ruleId: GAP_RULE_ID },
  ];
}

/** The popover for the design's pattern fill, or null when it has none. */
export function fillView(design: EditorDesign): FillView | null {
  const pattern = design.spec.kitPattern;
  if (pattern === undefined) return null;
  const generator = getGenerator(kitGeneratorId(pattern.style));
  const stored = storedIdsOf(pattern.style);
  const values = valuesOf(pattern);
  const fields = (generator?.params ?? [])
    .filter((spec) => stored.includes(spec.id))
    .map((spec): FillField => ({ id: spec.id, label: spec.label, unit: spec.unit, min: spec.min, max: spec.max, step: spec.step, value: values[spec.id] ?? null }));
  return {
    style: pattern.style,
    styleLabel: KIT_PATTERN_LABELS[pattern.style],
    colours: pattern.colours,
    maxColours: Math.min(MAX_PATTERN_COLOURS, generator?.maxColours ?? MAX_PATTERN_COLOURS),
    fields,
    unstored: unstoredOf(pattern.style),
    lockable: fields.filter((field) => field.unit === "mm" && field.value !== null).map((field) => field.id),
    targets: [
      { kind: "all", label: "Apply to all", reason: null },
      { kind: "panel", label: "Apply to the selected panel", reason: WHOLE_BODY },
    ],
  };
}

const clamp = (value: number, field: FillField): number => Math.min(field.max, Math.max(field.min, Math.round(value * 100) / 100));

/**
 * Every millimetre value after one of them is changed. With the lock on, the others keep their
 * ratio to the one that moved; with it off, only that one changes.
 */
export function withRatio(view: FillView, id: string, next: number, locked: boolean): Readonly<Record<string, number>> {
  const moved = view.fields.find((field) => field.id === id);
  if (moved === undefined || typeof moved.value !== "number") return {};
  const value = clamp(next, moved);
  const factor = moved.value === 0 ? 1 : value / moved.value;
  const others = locked ? view.lockable.filter((other) => other !== id) : [];
  return {
    [id]: value,
    ...Object.fromEntries(
      others.flatMap((other) => {
        const field = view.fields.find((entry) => entry.id === other);
        return field === undefined || typeof field.value !== "number" ? [] : [[other, clamp(field.value * factor, field)]];
      }),
    ),
  };
}

/** The pattern with these settings stored, in the units a design keeps them in. */
function withValues(pattern: KitPattern, values: Readonly<Record<string, number | boolean>>): KitPattern {
  const all = { ...valuesOf(pattern), ...values };
  const size = all[sizeParamOf(pattern.style)];
  const layout = pattern.style === "dots" ? dotsLayoutOf(all) : undefined;
  return {
    ...pattern,
    ...(typeof size === "number" ? { size: tenthsFromMm(size) } : {}),
    ...(layout === undefined ? {} : { dots: layout }),
    provenance: "user-edited",
  };
}

const saved = (pattern: KitPattern, words: string): Applied => ({
  ok: true,
  steps: [{ kind: "save", key: "pattern-fill", action: { type: "set-kit-pattern", kitPattern: pattern } }],
  words,
});

const fail = (reason: string): Applied => ({ ok: false, reason });

/** Changes one setting of the pattern fill, carrying the others with it when the ratio is locked. */
export function setFillValue(design: EditorDesign, id: string, next: number | boolean, locked = false): Applied {
  const view = fillView(design);
  const pattern = design.spec.kitPattern;
  if (view === null || pattern === undefined) return fail("This design has no pattern fill to change.");
  const field = view.fields.find((entry) => entry.id === id);
  if (field === undefined) return fail(`${view.styleLabel} has no setting called ${id}.`);
  if (typeof next === "boolean") return saved(withValues(pattern, { [id]: next }), `${field.label} ${next ? "on" : "off"}.`);
  const values = withRatio(view, id, next, locked);
  if (Object.keys(values).length === 0) return fail(`${field.label} is not set yet, so there is no size to change. Pick a style with a size first.`);
  return saved(withValues(pattern, values), `${field.label} ${values[id]} mm${locked && Object.keys(values).length > 1 ? ", with the others kept in ratio" : ""}.`);
}

/** Recolours the fill. A screen colour only: the colour reference stays the brand's to give (R-SUB-005). */
export function setFillColour(design: EditorDesign, at: number, swatch: string): Applied {
  const pattern = design.spec.kitPattern;
  const view = fillView(design);
  if (pattern === undefined || view === null) return fail("This design has no pattern fill to recolour.");
  if (!SWATCH_PATTERN.test(swatch)) return fail("That is not a screen colour the editor can draw.");
  if (at < 0 || at > view.maxColours - 1) return fail(`${view.styleLabel} prints in at most ${view.maxColours} colours over the body.`);
  const colours = [...pattern.colours];
  colours[at] = { colour: pattern.colours[at]?.colour ?? "", swatch };
  return saved({ ...pattern, colours: colours as unknown as KitPattern["colours"], provenance: "user-edited" }, `Pattern colour ${at + 1} set to ${swatch}.`);
}

/** Takes the pattern fill off the design, so it is plain again. */
export function removeFill(design: EditorDesign): Applied {
  if (design.spec.kitPattern === undefined) return fail("This design has no pattern fill to remove.");
  return { ok: true, steps: [{ kind: "save", key: "pattern-fill", action: { type: "remove-kit-pattern" } }], words: "The pattern fill was taken off." };
}
