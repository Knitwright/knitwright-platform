import { pt } from "../../chain";
import { need, resolveDimensions } from "../../dimensions";
import { placedDecoration } from "../../artwork";
import type { Point } from "../../model";
import { anchorPoint } from "../../templates/anchors";
import { basisOf, fitProblems, type Basis } from "../../templates/basis";
import { calloutElements } from "../../templates/callouts";
import { detailLines } from "../../templates/details";
import { seamLines, stitchLines } from "../../templates/lines";
import { readTopsOptions } from "../../templates/options";
import { outlineOf } from "../../templates/outline";
import { panelPaths } from "../../templates/panels";
import { frameOf, sleeveEnds, type Frame } from "../../templates/pieces";
import { templateFor } from "../../templates";
import type { DrawContext, FamilyDrawing } from "../drawing";

/**
 * The tops template each shirt is drawn from. A football shirt is a team jersey and a goalkeeper
 * shirt too, a training top is a long sleeve tee, and a cricket shirt is a polo. These are the
 * existing drawing proportions, labelled as a starting shape in `lib/flat/OWNER-QUESTIONS.md`.
 */
const TEMPLATE_OF: Readonly<Record<string, string>> = {
  "football-shirt": "team-jersey",
  "goalkeeper-shirt": "team-jersey",
  "winter-code-top": "team-jersey",
  "football-training-top": "long-sleeve-tee",
  "cricket-shirt": "polo",
  "cricket-training-tee": "crew-tee",
};

export const isTeamwearTop = (typeId: string): boolean => Object.hasOwn(TEMPLATE_OF, typeId);

const templateOfType = (typeId: string) => templateFor(TEMPLATE_OF[typeId] ?? "");

const rounded = (point: Point): Point => ({ x: Math.round(point.x * 10) / 10 + 0, y: Math.round(point.y * 10) / 10 + 0 });

/** The same named points the tops drawing carries, for tests and callouts. */
function landmarksOf(basis: Basis, frame: Frame): Readonly<Record<string, Point>> {
  return {
    hps: pt(0, 0),
    "underarm-right": rounded(basis.underarm),
    "underarm-left": rounded(pt(-basis.underarm.x, basis.underarm.y)),
    "sleeve-start-right": rounded(basis.top),
    "sleeve-end-right": rounded(sleeveEnds(basis).topEnd),
    "hem-centre": rounded(pt(0, basis.length)),
    "neck-bottom": rounded(pt(0, frame.drop)),
    "neck-seam-start": rounded(pt(basis.seamX, 0)),
    "sleeve-opening-lower": rounded(sleeveEnds(basis).lowerEnd),
  };
}

/** The proportions a shirt is drawn with when it has no measurements. */
export function teamwearTopProportions(spec: DrawContext["spec"]) {
  const template = templateOfType(spec.typeId);
  if (!template) throw new Error(`No tops template for ${spec.typeId}.`);
  return template.proportions(readTopsOptions(spec));
}

/** Draws one side of a shirt, top or tee through the tops drawing code, as the plan for V2 says. */
export function drawTeamwearTop(context: DrawContext): FamilyDrawing | null {
  const options = readTopsOptions(context.spec);
  const resolved = resolveDimensions({
    needed: context.points.map((point) => ({ id: point.id, label: point.label })),
    values: context.values,
    proportions: teamwearTopProportions(context.spec),
    check: (dims) => fitProblems(dims, options),
  });
  const { basis } = basisOf(resolved.dims, options);
  if (!basis) return null;
  const frame = frameOf(basis, options, context.view, resolved.dims);
  const callouts =
    context.callouts && resolved.toScale
      ? calloutElements(context.points.map((point) => ({ id: point.id, label: point.label, value: need(resolved.dims, point.id) })), frame, resolved.dims)
      : null;
  return {
    resolved,
    panels: panelPaths({ frame, view: context.view, wanted: context.wanted, nameOf: context.nameOf, fillOf: context.fillOf }),
    seams: seamLines(frame),
    stitching: stitchLines(frame),
    details: detailLines(frame, context.fillOf("collar")),
    artwork: placedDecoration(context.spec, context.view, (panelId, anchorId) => anchorPoint(frame, panelId, anchorId)),
    callouts,
    outline: outlineOf(frame),
    landmarks: landmarksOf(basis, frame),
  };
}
