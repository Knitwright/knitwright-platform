import type { FlatModel } from "@/lib/flat/model";

/** What the 3D form is made from: the outline and the drawing box of one view of a flat. */
export type ShapeSource = Pick<FlatModel, "outline" | "bounds">;

/** Keeps only the parts of a flat that the form is made from. */
export const shapeSource = (model: ShapeSource): ShapeSource => ({ outline: model.outline, bounds: model.bounds });
