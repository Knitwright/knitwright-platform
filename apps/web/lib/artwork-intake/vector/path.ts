import { VECTOR_LIMITS } from "../settings";
import { refuse } from "./refusal";

/** The path commands the model keeps: absolute moves, lines, cubic and quadratic curves, and close. */
export type Segment =
  | readonly ["M", number, number]
  | readonly ["L", number, number]
  | readonly ["C", number, number, number, number, number, number]
  | readonly ["Q", number, number, number, number]
  | readonly ["Z"];

const ARGUMENTS: Readonly<Record<string, number>> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
const TOKEN = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)|([\s,]+)/y;

const round = (value: number): number => Math.round(value * 10_000) / 10_000;

type Token = string | number;

const tokenise = (d: string): Token[] | null => {
  const tokens: Token[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < d.length) {
    const match = TOKEN.exec(d);
    if (!match) return null;
    if (match[1]) tokens.push(match[1]);
    else if (match[2]) tokens.push(Number.parseFloat(match[2]));
    if (tokens.length > VECTOR_LIMITS.maxPathCommands * 4) refuse("tooComplex");
  }
  return tokens;
};

/** An elliptical arc as cubic curves (the standard endpoint to centre conversion). */
const arcToCubics = (
  x1: number, y1: number, rxIn: number, ryIn: number, rotation: number, large: boolean, sweep: boolean, x2: number, y2: number,
): Segment[] => {
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if ((x1 === x2 && y1 === y2) || rx === 0 || ry === 0) return [["L", x2, y2]];
  const phi = (rotation * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const scale = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (scale > 1) {
    rx *= Math.sqrt(scale);
    ry *= Math.sqrt(scale);
  }
  const numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const factor = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator));
  const cxp = (factor * rx * y1p) / ry;
  const cyp = (-factor * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const start = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let sweepAngle = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && sweepAngle > 0) sweepAngle -= 2 * Math.PI;
  if (sweep && sweepAngle < 0) sweepAngle += 2 * Math.PI;
  const parts = Math.max(1, Math.ceil(Math.abs(sweepAngle) / (Math.PI / 2) - 1e-9));
  const step = sweepAngle / parts;
  const k = (4 / 3) * Math.tan(step / 4);
  const point = (a: number): readonly [number, number] => [
    cx + rx * Math.cos(a) * cos - ry * Math.sin(a) * sin,
    cy + rx * Math.cos(a) * sin + ry * Math.sin(a) * cos,
  ];
  const slope = (a: number): readonly [number, number] => [
    -rx * Math.sin(a) * cos - ry * Math.cos(a) * sin,
    -rx * Math.sin(a) * sin + ry * Math.cos(a) * cos,
  ];
  return Array.from({ length: parts }, (_, i): Segment => {
    const a0 = start + i * step;
    const a1 = a0 + step;
    const [p0x, p0y] = point(a0);
    const [p1x, p1y] = i === parts - 1 ? [x2, y2] : point(a1);
    const [d0x, d0y] = slope(a0);
    const [d1x, d1y] = slope(a1);
    return ["C", p0x + k * d0x, p0y + k * d0y, p1x - k * d1x, p1y - k * d1y, p1x, p1y];
  });
};

type Pen = { x: number; y: number; startX: number; startY: number; lastC: readonly [number, number] | null; lastQ: readonly [number, number] | null };

const reflected = (pen: Pen, control: readonly [number, number] | null): readonly [number, number] =>
  control ? [2 * pen.x - control[0], 2 * pen.y - control[1]] : [pen.x, pen.y];

type Drawn = { readonly out: Segment[]; readonly lastC: readonly [number, number] | null; readonly lastQ: readonly [number, number] | null };

/** The segments one command draws, and the control point a following smooth curve reflects. A move also sets where a close returns to. */
const draw = (upper: string, args: readonly number[], pen: Pen, ox: number, oy: number): Drawn => {
  switch (upper) {
    case "M":
      pen.startX = args[0] + ox;
      pen.startY = args[1] + oy;
      return { out: [["M", args[0] + ox, args[1] + oy]], lastC: null, lastQ: null };
    case "L":
      return { out: [["L", args[0] + ox, args[1] + oy]], lastC: null, lastQ: null };
    case "H":
      return { out: [["L", args[0] + ox, pen.y]], lastC: null, lastQ: null };
    case "V":
      return { out: [["L", pen.x, args[0] + oy]], lastC: null, lastQ: null };
    case "C":
      return { out: [["C", args[0] + ox, args[1] + oy, args[2] + ox, args[3] + oy, args[4] + ox, args[5] + oy]], lastC: [args[2] + ox, args[3] + oy], lastQ: null };
    case "S": {
      const [rx, ry] = reflected(pen, pen.lastC);
      return { out: [["C", rx, ry, args[0] + ox, args[1] + oy, args[2] + ox, args[3] + oy]], lastC: [args[0] + ox, args[1] + oy], lastQ: null };
    }
    case "Q":
      return { out: [["Q", args[0] + ox, args[1] + oy, args[2] + ox, args[3] + oy]], lastC: null, lastQ: [args[0] + ox, args[1] + oy] };
    case "T": {
      const [rx, ry] = reflected(pen, pen.lastQ);
      return { out: [["Q", rx, ry, args[0] + ox, args[1] + oy]], lastC: null, lastQ: [rx, ry] };
    }
    case "A":
      return { out: arcToCubics(pen.x, pen.y, args[0], args[1], args[2], args[3] !== 0, args[4] !== 0, args[5] + ox, args[6] + oy), lastC: null, lastQ: null };
    default:
      return { out: [["Z"]], lastC: null, lastQ: null };
  }
};

/** Runs one command with its arguments. Returns the segments and moves the pen. */
const run = (command: string, args: readonly number[], pen: Pen): Segment[] => {
  const relative = command === command.toLowerCase();
  const upper = command.toUpperCase();
  const { out, lastC, lastQ } = draw(upper, args, pen, relative ? pen.x : 0, relative ? pen.y : 0);
  const last = out[out.length - 1];
  if (upper === "Z") {
    pen.x = pen.startX;
    pen.y = pen.startY;
  } else if (last.length >= 3) {
    pen.x = last[last.length - 2] as number;
    pen.y = last[last.length - 1] as number;
  }
  pen.lastC = lastC;
  pen.lastQ = lastQ;
  return out;
};

/**
 * Reads SVG path data into absolute segments. As the SVG standard says, it keeps everything before a mistake
 * and stops there. `counter` totals the commands across the whole file against the limit.
 */
export const parsePath = (d: string, counter: { commands: number }): { segments: Segment[]; clean: boolean } => {
  const tokens = tokenise(d);
  if (!tokens) return { segments: [], clean: false };
  const segments: Segment[] = [];
  const pen: Pen = { x: 0, y: 0, startX: 0, startY: 0, lastC: null, lastQ: null };
  let at = 0;
  let command = "";
  let clean = true;
  while (at < tokens.length) {
    const token = tokens[at];
    if (typeof token === "string") {
      command = token;
      at += 1;
    } else if (command === "" || command.toLowerCase() === "z") {
      clean = false;
      break;
    }
    const need = ARGUMENTS[command.toLowerCase()];
    const args = tokens.slice(at, at + need);
    const first = segments.length === 0;
    if ((first && command.toLowerCase() !== "m") || args.length < need || args.some((value) => typeof value !== "number")) {
      clean = false;
      break;
    }
    counter.commands += 1;
    if (counter.commands > VECTOR_LIMITS.maxPathCommands) refuse("tooComplex");
    segments.push(...run(command, args as number[], pen));
    at += need;
    // Extra pairs after a move are lines.
    if (command === "M") command = "L";
    else if (command === "m") command = "l";
  }
  return { segments: segments.map(roundSegment), clean };
};

const roundSegment = (segment: Segment): Segment => [segment[0], ...segment.slice(1).map((value) => round(value as number))] as unknown as Segment;
