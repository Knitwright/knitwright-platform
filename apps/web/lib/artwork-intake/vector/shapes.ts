import { parsePath, type Segment } from "./path";

/** A length in the drawing's own units. Percentages and other units are not guessed at: they are zero. */
export const toNumber = (value: string | undefined, fallback = 0): number => {
  if (value === undefined) return fallback;
  const match = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(?:px)?\s*$/.exec(value);
  return match ? Number.parseFloat(match[1]) : fallback;
};

const KAPPA = 0.5522847498307936;

const ellipse = (cx: number, cy: number, rx: number, ry: number): Segment[] => [
  ["M", cx + rx, cy],
  ["C", cx + rx, cy + KAPPA * ry, cx + KAPPA * rx, cy + ry, cx, cy + ry],
  ["C", cx - KAPPA * rx, cy + ry, cx - rx, cy + KAPPA * ry, cx - rx, cy],
  ["C", cx - rx, cy - KAPPA * ry, cx - KAPPA * rx, cy - ry, cx, cy - ry],
  ["C", cx + KAPPA * rx, cy - ry, cx + rx, cy - KAPPA * ry, cx + rx, cy],
  ["Z"],
];

const rectangle = (x: number, y: number, w: number, h: number, rxIn: number, ryIn: number): Segment[] => {
  const rx = Math.min(rxIn || ryIn, w / 2);
  const ry = Math.min(ryIn || rxIn, h / 2);
  if (rx <= 0 || ry <= 0) return [["M", x, y], ["L", x + w, y], ["L", x + w, y + h], ["L", x, y + h], ["Z"]];
  const kx = KAPPA * rx;
  const ky = KAPPA * ry;
  return [
    ["M", x + rx, y], ["L", x + w - rx, y], ["C", x + w - rx + kx, y, x + w, y + ry - ky, x + w, y + ry],
    ["L", x + w, y + h - ry], ["C", x + w, y + h - ry + ky, x + w - rx + kx, y + h, x + w - rx, y + h],
    ["L", x + rx, y + h], ["C", x + rx - kx, y + h, x, y + h - ry + ky, x, y + h - ry],
    ["L", x, y + ry], ["C", x, y + ry - ky, x + rx - kx, y, x + rx, y], ["Z"],
  ];
};

const points = (text: string | undefined): number[] =>
  (text ?? "").split(/[\s,]+/).filter((part) => part !== "").map(Number).filter((value) => Number.isFinite(value));

type Attrs = ReadonlyMap<string, string>;

/** The segments of a basic shape or a path, or null when the element has no shape. `commands` totals path commands. */
export const shapeSegments = (name: string, attrs: Attrs, commands: { commands: number }): { segments: Segment[]; clean: boolean } | null => {
  const n = (key: string) => toNumber(attrs.get(key));
  const ok = (segments: Segment[]) => ({ segments, clean: true });
  switch (name) {
    case "path":
      return parsePath(attrs.get("d") ?? "", commands);
    case "rect":
      return n("width") > 0 && n("height") > 0 ? ok(rectangle(n("x"), n("y"), n("width"), n("height"), n("rx"), n("ry"))) : null;
    case "circle":
      return n("r") > 0 ? ok(ellipse(n("cx"), n("cy"), n("r"), n("r"))) : null;
    case "ellipse":
      return n("rx") > 0 && n("ry") > 0 ? ok(ellipse(n("cx"), n("cy"), n("rx"), n("ry"))) : null;
    case "line":
      return ok([["M", n("x1"), n("y1")], ["L", n("x2"), n("y2")]]);
    case "polyline":
    case "polygon": {
      const values = points(attrs.get("points"));
      const pairs = Math.floor(values.length / 2);
      if (pairs < 2) return null;
      const line: Segment[] = Array.from({ length: pairs }, (_, i): Segment => [i === 0 ? "M" : "L", values[2 * i], values[2 * i + 1]]);
      return ok(name === "polygon" ? [...line, ["Z"]] : line);
    }
    default:
      return null;
  }
};

export const SHAPE_NAMES = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);
