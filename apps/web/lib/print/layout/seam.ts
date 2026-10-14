import { KIT_STYLE_GENERATORS, type DisplayShape } from "@/lib/artwork-stack";
import { apply, type Affine, type Pt } from "../geometry/affine";
import type { Box } from "../scene";
import type { PieceInstance } from "../frames/instances";

/**
 * The back lies on the design plane the other way round from the front: the underarm landmark is on the left of the
 * front and on the right of the back, and it is the same seam. A field drawn on the back is therefore the front's
 * field turned about the centre line, and shifted so that the two underarm points meet: it is read at `join - x`,
 * where `join` is the sum of the two underarm landmarks' x on the design plane. The seven older styles already say
 * what they draw on each view, so they are left as they are.
 */
const OLDER_STYLES: ReadonlySet<string> = new Set(KIT_STYLE_GENERATORS.map((entry) => entry.id));

type Placed = { readonly instance: PieceInstance; readonly frame: { readonly toDesign: Affine } };

/** The sum of the front's and the back's underarm x on the design plane, or undefined when either has none. */
export function seamJoinFor(placed: readonly Placed[]): number | undefined {
  const xOf = (view: string): number | undefined => {
    const found = placed.find((entry) => entry.instance.view === view);
    const underarm = found?.instance.piece.landmarks.underarm;
    if (!found || !underarm) return undefined;
    const x = apply(found.frame.toDesign, underarm as Pt)[0];
    return Number.isFinite(x) ? x : undefined;
  };
  const [front, back] = [xOf("front"), xOf("back")];
  return front === undefined || back === undefined ? undefined : front + back;
}

/** The join to read this style's field by on this view, or undefined when it is drawn as it is. */
export const joinFor = (view: string, generatorId: string, join: number | undefined): number | undefined =>
  view === "back" && join !== undefined && !OLDER_STYLES.has(generatorId) ? join : undefined;

export const reflectBox = (box: Box, join: number): Box => ({ ...box, minX: join - box.maxX, maxX: join - box.minX });

export const reflectShape = (shape: DisplayShape, join: number): DisplayShape =>
  shape.kind === "polygon"
    ? { ...shape, points: shape.points.map((p) => ({ x: join - p.x, y: p.y })) }
    : { ...shape, centre: { x: join - shape.centre.x, y: shape.centre.y } };
