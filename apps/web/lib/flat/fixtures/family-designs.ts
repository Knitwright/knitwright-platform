/**
 * Test support for the drawings of the families other than tops. MADE-UP measurements: each
 * is the template's own ratio times an invented size, so the drawing has numbers that fit
 * together. They are not measurements of any garment and must never be loaded as real data.
 */
import { listTypes, pointsOfMeasureFor, type FamilyId } from "@/lib/garment";
import { FAMILY_DRAWERS, FAMILY_PROPORTIONS } from "../families";
import { designWith } from "./designs";

/** An invented size that turns ratios into lengths, in tenths of a millimetre. */
const MADE_UP_SIZE = 5000;

/** The families that have their own drawing code, other than tops. */
export const DRAWN_FAMILIES = Object.keys(FAMILY_DRAWERS) as FamilyId[];

/** The garment types of the families that have drawing code, other than tops. */
export const familyTypeIds = (family?: FamilyId): readonly string[] =>
  listTypes(family)
    .filter((type) => type.family !== "tops" && FAMILY_DRAWERS[type.family] !== undefined)
    .map((type) => type.id);

/** Made-up measurements for every point that applies to a type with these choices. */
export function madeUpFamilyValues(
  typeId: string,
  choices: Readonly<Record<string, string>>,
  scale = 1,
): Readonly<Record<string, number>> {
  const spec = designWith(typeId, choices);
  const type = listTypes().find((entry) => entry.id === typeId);
  const proportions = type ? FAMILY_PROPORTIONS[type.family]?.(spec) : undefined;
  if (!proportions) throw new Error(`No proportions for ${typeId}.`);
  return Object.fromEntries(
    pointsOfMeasureFor(spec).flatMap((point) => {
      const ratio = proportions[point.id];
      return ratio === undefined ? [] : [[point.id, Math.round(ratio * MADE_UP_SIZE * scale)]];
    }),
  );
}
