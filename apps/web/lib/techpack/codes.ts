import { POINT_GROUPS, pointsOfMeasureFor, type GarmentSpec, type PointOfMeasure } from "@/lib/garment";

const LETTERS = 26;
const FIRST_LETTER = "A".charCodeAt(0);

/** A, B, C ... Z, then AA, AB ... for the position in the table, counting from zero. */
export function codeFor(index: number): string {
  const letter = String.fromCharCode(FIRST_LETTER + (index % LETTERS));
  return index < LETTERS ? letter : `${codeFor(Math.floor(index / LETTERS) - 1)}${letter}`;
}

/**
 * The points of measure a design has, in the order of the measurement table: grouped by
 * section, and in registry order inside each section.
 */
export function pointsInTableOrder(spec: Pick<GarmentSpec, "typeId" | "options">): readonly PointOfMeasure[] {
  const points = pointsOfMeasureFor(spec);
  return POINT_GROUPS.flatMap((group) => points.filter((point) => point.group === group));
}

export interface CalloutCode {
  readonly pointId: string;
  readonly code: string;
  readonly label: string;
}

/**
 * A short code for each point of measure the design has, in the order of the measurement
 * table. The drawing and the table both use them, so they can be read together.
 */
export function calloutCodes(spec: Pick<GarmentSpec, "typeId" | "options">): readonly CalloutCode[] {
  return pointsInTableOrder(spec).map((point, index) => ({ pointId: point.id, code: codeFor(index), label: point.label }));
}
