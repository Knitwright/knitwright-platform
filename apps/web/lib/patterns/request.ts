import { getType, type GarmentSpec } from "@/lib/garment";

/**
 * What a pattern maker needs to know about a design, written out in words: the garment, who
 * it is for, every option chosen, the measurements set so far and the size asked for. It is
 * stored with the pattern job, so whoever drafts the pattern reads exactly what was asked,
 * even if the design changes afterwards.
 */

export interface PatternOption {
  readonly option: string;
  readonly choice: string;
}

export interface PatternMeasurement {
  readonly pointId: string;
  readonly label: string;
  readonly cm: number;
}

export interface PatternRequest {
  readonly typeId: string;
  readonly garment: string;
  readonly family: string | null;
  readonly wearer: string;
  readonly size: string;
  readonly sizing: { readonly sizes: readonly string[]; readonly baseSize: string } | null;
  readonly options: readonly PatternOption[];
  readonly measurements: readonly PatternMeasurement[];
}

/** The letter sizes offered when a design has no size run yet, the usual base size first. */
const USUAL_SIZES = ["M", "XS", "S", "L", "XL", "2XL", "3XL"] as const;

export function patternRequest(spec: GarmentSpec, size: string): PatternRequest {
  const type = getType(spec.typeId);
  const options = (type?.options ?? []).flatMap((option) => {
    const chosen = spec.options[option.id]?.choiceId ?? option.defaultChoice;
    const choice = option.choices.find((entry) => entry.id === chosen);
    return choice ? [{ option: option.label, choice: choice.label }] : [];
  });
  const labels = new Map((type?.pointsOfMeasure ?? []).map((point) => [point.id, point.label]));
  const measurements = spec.measurements.map((measurement) => ({
    pointId: measurement.pointId,
    label: labels.get(measurement.pointId) ?? measurement.pointId,
    // Stored in whole tenths of a millimetre.
    cm: measurement.value / 100,
  }));
  return {
    typeId: spec.typeId,
    garment: type?.label ?? spec.typeId,
    family: type?.family ?? null,
    wearer: spec.wearer,
    size,
    sizing: spec.sizing ? { sizes: [...spec.sizing.sizes], baseSize: spec.sizing.baseSize } : null,
    options,
    measurements,
  };
}

/** The sizes a pattern can be asked for: the design's own run, base size first, or the usual letters. */
export function sizeChoices(spec: GarmentSpec): readonly string[] {
  if (!spec.sizing) return USUAL_SIZES;
  const { sizes, baseSize } = spec.sizing;
  return [baseSize, ...sizes.filter((size) => size !== baseSize)];
}
