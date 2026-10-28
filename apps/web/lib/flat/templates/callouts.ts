import { chain, lineTo, openCommands, pt } from "../chain";
import { need, type Dims } from "../dimensions";
import type { FlatElement, Point } from "../model";
import { CALLOUT_COLOUR } from "../colour";
import { formatCm } from "@/lib/garment";
import { placketTop } from "./collar";
import { hemLift, sleeveEnds, type Frame } from "./pieces";

/** Type size of a callout label, and how far a label sits off its line, in tenths of a millimetre. */
const LABEL_SIZE = 50;
const LABEL_GAP = 30;
const LINE_WIDTH = 3;

type Ends = readonly [Point, Point];

/** The two ends of the line that shows each point of measure, or null when this view does not show it. */
function endsFor(pointId: string, frame: Frame, dims: Dims): Ends | null {
  const { basis, view } = frame;
  const chest = basis.chest;
  const front = view === "front";
  const { topEnd, lowerEnd } = sleeveEnds(basis);
  const upperArm = need(dims, "upper-arm");
  const collar = frame.collarHeight;
  const table: Readonly<Record<string, Ends | null>> = {
    "chest-width": [pt(-basis.halfChest, basis.underarm.y), pt(basis.halfChest, basis.underarm.y)],
    "body-length": [pt(-(basis.halfHem + 0.06 * chest), 0), pt(-(basis.halfHem + 0.06 * chest), basis.length)],
    "shoulder-width": [pt(-basis.shoulderHalf, basis.top.y - 0.04 * chest), pt(basis.shoulderHalf, basis.top.y - 0.04 * chest)],
    "sleeve-length": [basis.top, topEnd],
    armhole: [basis.top, basis.underarm],
    "upper-arm": [basis.underarm, pt(basis.underarm.x - basis.across.x * upperArm, basis.underarm.y - basis.across.y * upperArm)],
    "sleeve-opening": [topEnd, lowerEnd],
    "hem-width": [
      pt(-basis.halfHem, basis.length - hemLift(frame, basis.halfHem) + 0.06 * chest),
      pt(basis.halfHem, basis.length - hemLift(frame, basis.halfHem) + 0.06 * chest),
    ],
    "neck-width": [pt(-basis.neckHalf, -0.05 * chest), pt(basis.neckHalf, -0.05 * chest)],
    "front-neck-drop": front ? [pt(0, 0), pt(0, frame.drop)] : null,
    "back-neck-drop": front ? null : [pt(0, 0), pt(0, frame.drop)],
    "collar-height": [pt(basis.neckHalf * 1.05, 0), pt(basis.neckHalf * 1.05, -collar * 0.8)],
    "placket-length": front
      ? [pt(frame.placketWidth / 2 + 0.04 * chest, placketTop(frame)), pt(frame.placketWidth / 2 + 0.04 * chest, placketTop(frame) + frame.placketLength)]
      : null,
    "placket-width": front
      ? [pt(-frame.placketWidth / 2, placketTop(frame) + frame.placketLength + 0.04 * chest), pt(frame.placketWidth / 2, placketTop(frame) + frame.placketLength + 0.04 * chest)]
      : null,
  };
  return table[pointId] ?? null;
}

interface CalloutPoint {
  readonly id: string;
  readonly label: string;
  /** Tenths of a millimetre. */
  readonly value: number;
}

/**
 * A line and a label for each point of measure, showing its value in centimetres. The
 * caller asks for these only when the drawing is to scale, so a schematic drawing never
 * carries a measurement value.
 */
export function calloutElements(points: readonly CalloutPoint[], frame: Frame, dims: Dims): readonly FlatElement[] {
  return points.flatMap((point): FlatElement[] => {
    const ends = endsFor(point.id, frame, dims);
    if (!ends) return [];
    const [from, to] = ends;
    const middle = pt((from.x + to.x) / 2, (from.y + to.y) / 2);
    const horizontal = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
    return [
      {
        kind: "path",
        name: `${point.label} line`,
        panelId: null,
        commands: openCommands(chain(from, lineTo(to))),
        fill: null,
        stroke: { colour: CALLOUT_COLOUR, width: LINE_WIDTH, dash: [] },
      },
      {
        kind: "text",
        text: `${point.label} ${formatCm(point.value)} cm`,
        at: horizontal ? pt(middle.x, middle.y - LABEL_GAP) : pt(middle.x - LABEL_GAP, middle.y),
        size: LABEL_SIZE,
        anchor: horizontal ? "middle" : "end",
        colour: CALLOUT_COLOUR,
        rotation: 0,
      },
    ];
  });
}
