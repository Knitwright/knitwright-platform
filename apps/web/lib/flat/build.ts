import { getType, panelsFor, pointsOfMeasureFor, type GarmentSpec, type ResolvedType } from "@/lib/garment";
import type { Resolution } from "@/lib/sizing";
import { artworkElements } from "./artwork";
import { colourwayFor, panelFill } from "./colour";
import { describeFlat } from "./describe";
import { need, resolveDimensions } from "./dimensions";
import { boundsOfPoints, extentPoints, grow } from "./geometry";
import {
  BOUNDS_MARGIN,
  LAYERS,
  NOT_TO_SCALE_MISFIT,
  NOT_TO_SCALE_MISSING,
  type FlatElement,
  type FlatLayer,
  type FlatModel,
  type LayerKey,
  type Point,
  type View,
} from "./model";
import { tidy } from "./chain";
import { FAMILY_DRAWERS } from "./families";
import { withKitPattern } from "./kit-pattern";
import { basisOf, fitProblems, type Basis } from "./templates/basis";
import { calloutElements } from "./templates/callouts";
import { detailLines } from "./templates/details";
import { templateFor } from "./templates";
import { seamLines, stitchLines } from "./templates/lines";
import { readTopsOptions } from "./templates/options";
import { outlineOf } from "./templates/outline";
import { panelPaths } from "./templates/panels";
import { frameOf, sleeveEnds, type Frame } from "./templates/pieces";

export interface BuildInput {
  readonly spec: GarmentSpec;
  /** The measurements for one size, from `resolveMeasurements`. */
  readonly measurements: Resolution;
  readonly view: View;
  readonly colourwayId: string;
  /** Adds a line and a label for each measurement. Off by default. Never added to a drawing that is not to scale. */
  readonly callouts?: boolean;
}

/**
 * Panels that one view does not show: the body or legs of the other side, and parts that sit
 * only on the front (a placket, a kangaroo pocket, the gusset seen between the legs) or can
 * be seen only from the front (the lining inside a hood).
 */
const HIDDEN: Readonly<Record<View, readonly string[]>> = {
  front: ["body-back", "legs-back"],
  back: ["body-front", "placket", "legs-front", "gusset", "kangaroo-pocket", "hood-lining"],
};

/** The panels of a design that this view draws. */
export function visiblePanels(view: View, panelIds: readonly string[]): string[] {
  return panelIds.filter((id) => !HIDDEN[view].includes(id));
}

const layer = (key: LayerKey, elements: readonly FlatElement[]): FlatLayer => ({ ...LAYERS[key], elements });

function noticeFor(missing: number, problems: number): string | null {
  if (missing > 0) return NOT_TO_SCALE_MISSING;
  return problems > 0 ? NOT_TO_SCALE_MISFIT : null;
}

const rounded = (point: Point): Point => ({ x: tidy(point.x), y: tidy(point.y) });

/** Named points on the drawing that the tests and the callouts refer to. */
function landmarksOf(basis: Basis, frame: Frame): Readonly<Record<string, Point>> {
  return {
    hps: { x: 0, y: 0 },
    "underarm-right": rounded(basis.underarm),
    "underarm-left": rounded({ x: -basis.underarm.x, y: basis.underarm.y }),
    "sleeve-start-right": rounded(basis.top),
    "sleeve-end-right": rounded(sleeveEnds(basis).topEnd),
    "hem-centre": rounded({ x: 0, y: basis.length }),
    "neck-bottom": rounded({ x: 0, y: frame.drop }),
    "neck-seam-start": rounded({ x: basis.seamX, y: 0 }),
    "sleeve-opening-lower": rounded(sleeveEnds(basis).lowerEnd),
  };
}

const measuredValues = (resolution: Resolution): ReadonlyMap<string, number> =>
  new Map(resolution.rows.flatMap((row) => (row.status === "set" ? [[row.pointId, row.value] as const] : [])));

/** The layers of a drawing, in drawing order. The callouts layer is there only when callouts were made. */
function layersOf(spec: GarmentSpec, active: string, frame: Frame, panels: readonly FlatElement[], callouts: readonly FlatElement[] | null): FlatLayer[] {
  return [
    layer("panels", panels),
    layer("seams", seamLines(frame)),
    layer("stitching", stitchLines(frame)),
    layer("details", detailLines(frame, panelFill(spec, active, "collar"))),
    layer("artwork", artworkElements(spec, frame)),
    ...(callouts ? [layer("measurements", callouts)] : []),
  ];
}

/** Draws a design of a family other than tops, through that family's drawing code. */
function buildFamilyFlat(input: BuildInput, type: ResolvedType): FlatModel | null {
  // A family with no drawing code yet gets no drawing.
  const drawer = FAMILY_DRAWERS[type.family];
  if (!drawer) return null;
  const { spec, view } = input;
  const wanted = new Set(visiblePanels(view, panelsFor(spec).map((panel) => panel.id)));
  const active = colourwayFor(spec, input.colourwayId).id;
  const drawing = drawer({
    spec,
    type,
    view,
    points: pointsOfMeasureFor(spec),
    values: measuredValues(input.measurements),
    wanted: (id) => wanted.has(id),
    nameOf: (id) => type.panels.find((panel) => panel.id === id)?.label ?? id,
    fillOf: (id) => panelFill(spec, active, id),
    callouts: input.callouts === true,
  });
  if (!drawing) return null;
  const { resolved } = drawing;
  const callouts = input.callouts && resolved.toScale ? drawing.callouts : null;
  const layers = [
    layer("panels", drawing.panels),
    layer("seams", drawing.seams),
    layer("stitching", drawing.stitching),
    layer("details", drawing.details),
    layer("artwork", drawing.artwork),
    ...(callouts ? [layer("measurements", callouts)] : []),
  ];
  const notice = noticeFor(resolved.missing.length, resolved.problems.length);
  return {
    view,
    typeId: spec.typeId,
    colourwayId: active,
    layers,
    bounds: grow(boundsOfPoints(layers.flatMap((entry) => entry.elements).flatMap(extentPoints)), BOUNDS_MARGIN),
    toScale: resolved.toScale,
    missing: resolved.missing,
    problems: resolved.problems,
    notice,
    outline: drawing.outline,
    landmarks: drawing.landmarks,
    description: describeFlat(spec, view, active, notice),
  };
}

/**
 * Draws one side of a design as a geometry model. Nothing here is a pixel: every number is
 * in tenths of a millimetre with one scale for both axes. Measurements that are present
 * drive the drawing. Any that are missing come from the template's proportions, and the
 * model then says it is not to scale. A type with no template gets no drawing (null).
 */
export function buildFlat(input: BuildInput): FlatModel | null {
  const { spec, view } = input;
  const type = getType(spec.typeId);
  if (type && type.family !== "tops") return buildFamilyFlat(input, type);
  const template = templateFor(spec.typeId);
  if (!type || !template) return null;
  const options = readTopsOptions(spec);
  const points = pointsOfMeasureFor(spec);
  const resolved = resolveDimensions({
    needed: points.map((point) => ({ id: point.id, label: point.label })),
    values: measuredValues(input.measurements),
    proportions: template.proportions(options),
    check: (dims) => fitProblems(dims, options),
  });
  const { basis } = basisOf(resolved.dims, options);
  if (!basis) return null;
  const frame = frameOf(basis, options, view, resolved.dims);
  const wanted = new Set(visiblePanels(view, panelsFor(spec).map((panel) => panel.id)));
  const active = colourwayFor(spec, input.colourwayId).id;
  const plain = panelPaths({
    frame,
    view,
    wanted: (id) => wanted.has(id),
    nameOf: (id) => type.panels.find((panel) => panel.id === id)?.label ?? id,
    fillOf: (id) => panelFill(spec, active, id),
  });
  const panels = withKitPattern(plain, spec.kitPattern, { view, underarm: basis.underarm, decoration: artworkElements(spec, frame) });
  const callouts = input.callouts && resolved.toScale
    ? calloutElements(points.map((point) => ({ id: point.id, label: point.label, value: need(resolved.dims, point.id) })), frame, resolved.dims)
    : null;
  const layers = layersOf(spec, active, frame, panels, callouts);
  const notice = noticeFor(resolved.missing.length, resolved.problems.length);
  return {
    view,
    typeId: spec.typeId,
    colourwayId: active,
    layers,
    bounds: grow(boundsOfPoints(layers.flatMap((entry) => entry.elements).flatMap(extentPoints)), BOUNDS_MARGIN),
    toScale: resolved.toScale,
    missing: resolved.missing,
    problems: resolved.problems,
    notice,
    outline: outlineOf(frame),
    landmarks: landmarksOf(basis, frame),
    description: describeFlat(spec, view, active, notice),
  };
}
