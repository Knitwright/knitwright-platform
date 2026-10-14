import { type Budget } from "./budget";

/** The only commands the model holds: absolute move, line, cubic curve and close. */
export type PathCmd = readonly ["M", number, number] | readonly ["L", number, number] | readonly ["C", number, number, number, number, number, number] | readonly ["Z"];

const round = (value: number): number => Math.round(value * 1000) / 1000 + 0;

const ARGS: Readonly<Record<string, number>> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

type Token = Readonly<{ command: string } | { value: number }>;

/** Splits path data into commands and numbers. Null when something else is in it. */
function tokenize(d: string): Token[] | null {
  const tokens: Token[] = [];
  const pattern = /\s*,?\s*(?:([MmLlHhVvCcSsQqTtAaZz])|([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?))/gy;
  let consumed = 0;
  for (let match = pattern.exec(d); match; match = pattern.exec(d)) {
    consumed = pattern.lastIndex;
    tokens.push(match[1] ? { command: match[1] } : { value: Number(match[2]) });
  }
  return d.slice(consumed).trim() === "" ? tokens : null;
}

/** An arc as cubic curves (the standard endpoint to centre conversion). */
function arcToCubics(x1: number, y1: number, rxIn: number, ryIn: number, rotation: number, large: boolean, sweep: boolean, x2: number, y2: number): PathCmd[] {
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return rx === 0 || ry === 0 ? [["L", x2, y2]] : [];
  const phi = (rotation * Math.PI) / 180;
  const [cos, sin] = [Math.cos(phi), Math.sin(phi)];
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const factor = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator));
  const cxp = (factor * rx * y1p) / ry;
  const cyp = (-factor * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number): number => {
    const sign = ux * vy - uy * vx < 0 ? -1 : 1;
    const cosine = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
    return sign * Math.acos(Math.max(-1, Math.min(1, cosine)));
  };
  const start = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let sweepAngle = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && sweepAngle > 0) sweepAngle -= 2 * Math.PI;
  if (sweep && sweepAngle < 0) sweepAngle += 2 * Math.PI;
  const segments = Math.max(1, Math.ceil(Math.abs(sweepAngle) / (Math.PI / 2) - 1e-9));
  const step = sweepAngle / segments;
  const alpha = (4 / 3) * Math.tan(step / 4);
  const point = (theta: number): readonly [number, number] => [
    cx + rx * Math.cos(theta) * cos - ry * Math.sin(theta) * sin,
    cy + rx * Math.cos(theta) * sin + ry * Math.sin(theta) * cos,
  ];
  const slope = (theta: number): readonly [number, number] => [
    -rx * Math.sin(theta) * cos - ry * Math.cos(theta) * sin,
    -rx * Math.sin(theta) * sin + ry * Math.cos(theta) * cos,
  ];
  const out: PathCmd[] = [];
  for (let i = 0; i < segments; i += 1) {
    const a = start + i * step;
    const b = a + step;
    const [pa, pb, da, db] = [point(a), point(b), slope(a), slope(b)];
    out.push(["C", pa[0] + alpha * da[0], pa[1] + alpha * da[1], pb[0] - alpha * db[0], pb[1] - alpha * db[1], i === segments - 1 ? x2 : pb[0], i === segments - 1 ? y2 : pb[1]]);
  }
  return out;
}

class Pen {
  readonly out: PathCmd[] = [];
  x = 0;
  y = 0;
  startX = 0;
  startY = 0;
  lastC: readonly [number, number] | null = null;
  lastQ: readonly [number, number] | null = null;

  move(x: number, y: number): void {
    this.out.push(["M", x, y]);
    [this.x, this.y, this.startX, this.startY] = [x, y, x, y];
    this.lastC = this.lastQ = null;
  }

  line(x: number, y: number): void {
    this.out.push(["L", x, y]);
    [this.x, this.y] = [x, y];
    this.lastC = this.lastQ = null;
  }

  cubic(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void {
    this.out.push(["C", x1, y1, x2, y2, x, y]);
    [this.x, this.y, this.lastC, this.lastQ] = [x, y, [x2, y2], null];
  }

  quad(x1: number, y1: number, x: number, y: number): void {
    const [x0, y0] = [this.x, this.y];
    this.out.push(["C", x0 + (2 / 3) * (x1 - x0), y0 + (2 / 3) * (y1 - y0), x + (2 / 3) * (x1 - x), y + (2 / 3) * (y1 - y), x, y]);
    [this.x, this.y, this.lastC, this.lastQ] = [x, y, null, [x1, y1]];
  }

  close(): void {
    this.out.push(["Z"]);
    [this.x, this.y] = [this.startX, this.startY];
    this.lastC = this.lastQ = null;
  }
}

function run(pen: Pen, command: string, a: number[]): void {
  const relative = command === command.toLowerCase();
  const upper = command.toUpperCase();
  const [ox, oy] = relative ? [pen.x, pen.y] : [0, 0];
  switch (upper) {
    case "M":
      pen.move(a[0] + ox, a[1] + oy);
      break;
    case "L":
      pen.line(a[0] + ox, a[1] + oy);
      break;
    case "H":
      pen.line(a[0] + ox, pen.y);
      break;
    case "V":
      pen.line(pen.x, a[0] + oy);
      break;
    case "C":
      pen.cubic(a[0] + ox, a[1] + oy, a[2] + ox, a[3] + oy, a[4] + ox, a[5] + oy);
      break;
    case "S": {
      const [rx, ry] = pen.lastC ? [2 * pen.x - pen.lastC[0], 2 * pen.y - pen.lastC[1]] : [pen.x, pen.y];
      pen.cubic(rx, ry, a[0] + ox, a[1] + oy, a[2] + ox, a[3] + oy);
      break;
    }
    case "Q":
      pen.quad(a[0] + ox, a[1] + oy, a[2] + ox, a[3] + oy);
      break;
    case "T": {
      const [qx, qy] = pen.lastQ ? [2 * pen.x - pen.lastQ[0], 2 * pen.y - pen.lastQ[1]] : [pen.x, pen.y];
      pen.quad(qx, qy, a[0] + ox, a[1] + oy);
      break;
    }
    case "A": {
      const [x1, y1] = [pen.x, pen.y];
      for (const cmd of arcToCubics(x1, y1, a[0], a[1], a[2], a[3] !== 0, a[4] !== 0, a[5] + ox, a[6] + oy)) {
        if (cmd[0] === "C") pen.cubic(cmd[1], cmd[2], cmd[3], cmd[4], cmd[5], cmd[6]);
        else if (cmd[0] === "L") pen.line(cmd[1], cmd[2]);
      }
      if (pen.x !== a[5] + ox || pen.y !== a[6] + oy) pen.line(a[5] + ox, a[6] + oy);
      break;
    }
    default:
      pen.close();
  }
}

/**
 * Reads SVG path data into absolute move, line, cubic and close commands. Null when it is malformed;
 * anything read up to the fault is dropped so a half-read shape is never drawn.
 */
export function parsePathData(d: string, budget: Budget): PathCmd[] | null {
  const tokens = tokenize(d);
  if (!tokens || tokens.length === 0) return tokens ? [] : null;
  const pen = new Pen();
  let at = 0;
  let command = "";
  let first = true;
  while (at < tokens.length) {
    const token = tokens[at];
    if ("command" in token) {
      command = token.command;
      at += 1;
      if (first && command.toUpperCase() !== "M") return null;
      first = false;
      if (command.toUpperCase() === "Z") {
        run(pen, command, []);
        continue;
      }
    } else if (command === "" || command.toUpperCase() === "Z") {
      return null;
    }
    const count = ARGS[command.toUpperCase()];
    const args = tokens.slice(at, at + count).map((t) => ("value" in t ? t.value : Number.NaN));
    if (args.length < count || args.some(Number.isNaN)) return null;
    at += count;
    // Flags in an arc are 0 or 1 only.
    if (command.toUpperCase() === "A" && ![args[3], args[4]].every((flag) => flag === 0 || flag === 1)) return null;
    run(pen, command, args);
    // After a move, further pairs are lines.
    if (command === "M") command = "L";
    else if (command === "m") command = "l";
    budget.pathCommands(1);
  }
  return pen.out.map(roundCommand);
}

const roundCommand = (cmd: PathCmd): PathCmd => (cmd[0] === "Z" ? cmd : ([cmd[0], ...cmd.slice(1).map((v) => round(v as number))] as unknown as PathCmd));

const circle = (cx: number, cy: number, rx: number, ry: number): PathCmd[] => {
  const k = 0.5522847498307936;
  return [
    ["M", cx + rx, cy],
    ["C", cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry],
    ["C", cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy],
    ["C", cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry],
    ["C", cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy],
    ["Z"],
  ].map((cmd) => roundCommand(cmd as unknown as PathCmd));
};

/** A rounded rectangle, or a plain one when `rx` and `ry` are zero. */
const rectangle = (x: number, y: number, w: number, h: number, rxIn: number, ryIn: number): PathCmd[] => {
  const rx = Math.min(rxIn, w / 2);
  const ry = Math.min(ryIn, h / 2);
  const cmds: PathCmd[] =
    rx <= 0 || ry <= 0
      ? [["M", x, y], ["L", x + w, y], ["L", x + w, y + h], ["L", x, y + h], ["Z"]]
      : (() => {
          const k = 0.5522847498307936;
          return [
            ["M", x + rx, y],
            ["L", x + w - rx, y],
            ["C", x + w - rx + rx * k, y, x + w, y + ry - ry * k, x + w, y + ry],
            ["L", x + w, y + h - ry],
            ["C", x + w, y + h - ry + ry * k, x + w - rx + rx * k, y + h, x + w - rx, y + h],
            ["L", x + rx, y + h],
            ["C", x + rx - rx * k, y + h, x, y + h - ry + ry * k, x, y + h - ry],
            ["L", x, y + ry],
            ["C", x, y + ry - ry * k, x + rx - rx * k, y, x + rx, y],
            ["Z"],
          ] as PathCmd[];
        })();
  return cmds.map(roundCommand);
};

export const shapePath = { circle, rectangle };

/** The corners of an `x,y x,y ...` list as lines. Null when the list is odd or empty. */
export function polyPath(points: string, closed: boolean): PathCmd[] | null {
  const values = points.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)?.map(Number) ?? [];
  if (values.length < 4 || values.length % 2 !== 0 || values.some((v) => !Number.isFinite(v))) return null;
  const cmds: PathCmd[] = [];
  for (let i = 0; i < values.length; i += 2) cmds.push([i === 0 ? "M" : "L", round(values[i]), round(values[i + 1])]);
  if (closed) cmds.push(["Z"]);
  return cmds;
}

