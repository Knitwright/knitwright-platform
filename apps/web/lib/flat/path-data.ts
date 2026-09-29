import type { PathCommand, Point } from "./model";

/** A number written with at most two decimals, and never as minus zero. */
export const num = (value: number): string => String(Math.round(value * 100) / 100 + 0);

const at = (point: Point): string => `${num(point.x)} ${num(point.y)}`;

function commandText(command: PathCommand): string {
  if (command.op === "Z") return "Z";
  if (command.op === "C") return `C ${at(command.c1)} ${at(command.c2)} ${at(command.to)}`;
  return `${command.op} ${at(command.to)}`;
}

/** Path data in the form both SVG and the PDF library read: `M x y L x y C ... Z`. */
export const pathData = (commands: readonly PathCommand[]): string => commands.map(commandText).join(" ");

export const pointText = at;
