import { tidy } from "./chain";
import { DETAIL_COLOUR, OUTLINE_COLOUR, SEAM_COLOUR, STITCH_COLOUR } from "./colour";
import type { FlatPath, PathCommand, Point, Stroke } from "./model";

/** Line widths and dash lengths, in tenths of a millimetre. */
const OUTLINE_WIDTH = 6;
const SEAM_WIDTH = 4;
const STITCH_WIDTH = 3;
const DETAIL_WIDTH = 4;
const STITCH_DASH: readonly number[] = [16, 10];

const round = (point: Point): Point => ({ x: tidy(point.x), y: tidy(point.y) });

/** The same commands with every coordinate rounded to a tenth of a drawing unit. */
export function tidyCommands(commands: readonly PathCommand[]): readonly PathCommand[] {
  return commands.map((command) => {
    if (command.op === "Z") return command;
    if (command.op === "C") return { op: "C", c1: round(command.c1), c2: round(command.c2), to: round(command.to) };
    return { op: command.op, to: round(command.to) };
  });
}

const stroke = (colour: string, width: number, dash: readonly number[] = []): Stroke => ({ colour, width, dash });

/** One panel of the garment: filled, with a plain outline. */
export const panelPath = (name: string, panelId: string, commands: readonly PathCommand[], fill: string): FlatPath => ({
  kind: "path",
  name,
  panelId,
  commands: tidyCommands(commands),
  fill,
  stroke: stroke(OUTLINE_COLOUR, OUTLINE_WIDTH),
});

const lineOf = (name: string, commands: readonly PathCommand[], line: Stroke, fill: string | null = null): FlatPath => ({
  kind: "path",
  name,
  panelId: null,
  commands: tidyCommands(commands),
  fill,
  stroke: line,
});

export const seamPath = (name: string, commands: readonly PathCommand[]): FlatPath =>
  lineOf(name, commands, stroke(SEAM_COLOUR, SEAM_WIDTH));

/** A dashed line: stitching. */
export const stitchPath = (name: string, commands: readonly PathCommand[]): FlatPath =>
  lineOf(name, commands, stroke(STITCH_COLOUR, STITCH_WIDTH, STITCH_DASH));

export const detailPath = (name: string, commands: readonly PathCommand[], fill: string | null = null, colour: string = DETAIL_COLOUR): FlatPath =>
  lineOf(name, commands, stroke(colour, DETAIL_WIDTH), fill);

/** Part of the garment that is not a panel of its own, such as the inside of the back seen through the neck. */
export const insidePath = (name: string, commands: readonly PathCommand[], fill: string): FlatPath => ({
  kind: "path",
  name,
  panelId: null,
  commands: tidyCommands(commands),
  fill,
  stroke: stroke(SEAM_COLOUR, SEAM_WIDTH),
});
