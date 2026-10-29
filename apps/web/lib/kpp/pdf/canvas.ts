import { num, pdfString, PT_PER_MM, winAnsi, type PdfImage, type PdfPage } from "./writer";

/** A point in millimetres, measured from the top left of the page. */
export type Mm = readonly [number, number];

export interface TextStyle {
  readonly size?: number;
  readonly bold?: boolean;
  readonly align?: "left" | "right" | "center";
  /** 0 is black, 1 is white. */
  readonly grey?: number;
}

export interface StrokeStyle {
  readonly widthPt?: number;
  /** Dash and gap lengths in millimetres. */
  readonly dash?: readonly number[];
  readonly grey?: number;
}

/** Helvetica's average advance is about half the font size; 0.55 keeps wrapped text inside its box. */
const AVERAGE_ADVANCE = 0.55;

/** The width a line of text takes, estimated, in millimetres. */
export const textWidthMm = (text: string, sizePt: number): number => (winAnsi(text).length * sizePt * AVERAGE_ADVANCE) / PT_PER_MM;

/** Breaks text into lines no wider than `widthMm`. A word longer than the width is cut. */
export function wrapText(text: string, widthMm: number, sizePt: number): string[] {
  const maxChars = Math.max(1, Math.floor((widthMm * PT_PER_MM) / (sizePt * AVERAGE_ADVANCE)));
  const lines: string[] = [];
  let line = "";
  for (const raw of text.split(/\s+/).filter((w) => w !== "")) {
    let word = raw;
    while (word.length > maxChars) {
      if (line !== "") lines.push(line);
      lines.push(word.slice(0, maxChars));
      word = word.slice(maxChars);
      line = "";
    }
    const joined = line === "" ? word : `${line} ${word}`;
    if (joined.length <= maxChars) line = joined;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== "") lines.push(line);
  return lines.length === 0 ? [""] : lines;
}

/**
 * Draws on one page in millimetres, from the top left. Every operator is written with two
 * decimals, so the same drawing gives the same content stream.
 */
export class Canvas {
  private readonly ops: string[] = [];
  private readonly images: PdfImage[] = [];
  private dx = 0;
  private dy = 0;

  constructor(
    readonly widthMm: number,
    readonly heightMm: number,
  ) {}

  private px(mm: number): string {
    return num((mm + this.dx) * PT_PER_MM);
  }

  private py(mm: number): string {
    return num((this.heightMm - (mm + this.dy)) * PT_PER_MM);
  }

  private stroke(style: StrokeStyle): void {
    const dash = style.dash ? `[${style.dash.map((d) => num(d * PT_PER_MM)).join(" ")}] 0 d` : "[] 0 d";
    this.ops.push(`${num(style.widthPt ?? 0.5)} w ${dash} ${num(style.grey ?? 0)} G`);
  }

  /** Draws inside `fn` moved by (dx, dy) millimetres. */
  offset(dx: number, dy: number, fn: () => void): void {
    this.dx += dx;
    this.dy += dy;
    fn();
    this.dx -= dx;
    this.dy -= dy;
  }

  /** Draws inside `fn` only within the rectangle. */
  clip(x: number, y: number, w: number, h: number, fn: () => void): void {
    this.ops.push(`q ${this.px(x)} ${this.py(y + h)} ${num(w * PT_PER_MM)} ${num(h * PT_PER_MM)} re W n`);
    fn();
    this.ops.push("Q");
  }

  text(x: number, y: number, value: string, style: TextStyle = {}): void {
    const size = style.size ?? 9;
    const width = textWidthMm(value, size);
    const left = style.align === "right" ? x - width : style.align === "center" ? x - width / 2 : x;
    this.ops.push(`BT /${style.bold ? "F2" : "F1"} ${num(size)} Tf ${num(style.grey ?? 0)} g ${this.px(left)} ${this.py(y)} Td ${pdfString(value)} Tj ET`);
  }

  path(points: readonly Mm[], closed: boolean, style: StrokeStyle = {}): void {
    if (points.length < 2) return;
    this.stroke(style);
    const [first, ...rest] = points;
    const moves = [`${this.px(first[0])} ${this.py(first[1])} m`, ...rest.map((p) => `${this.px(p[0])} ${this.py(p[1])} l`)];
    this.ops.push(`${moves.join(" ")} ${closed ? "s" : "S"}`);
  }

  line(a: Mm, b: Mm, style: StrokeStyle = {}): void {
    this.path([a, b], false, style);
  }

  rect(x: number, y: number, w: number, h: number, style: StrokeStyle & { fill?: number } = {}): void {
    const box = `${this.px(x)} ${this.py(y + h)} ${num(w * PT_PER_MM)} ${num(h * PT_PER_MM)} re`;
    if (style.fill !== undefined) {
      this.ops.push(`${num(style.fill)} g ${box} f`);
      return;
    }
    this.stroke(style);
    this.ops.push(`${box} S`);
  }

  image(image: PdfImage, x: number, y: number, w: number, h: number): void {
    if (!this.images.some((i) => i.name === image.name)) this.images.push(image);
    this.ops.push(`q ${num(w * PT_PER_MM)} 0 0 ${num(h * PT_PER_MM)} ${this.px(x)} ${this.py(y + h)} cm /${image.name} Do Q`);
  }

  page(): PdfPage {
    return { widthMm: this.widthMm, heightMm: this.heightMm, content: this.ops.join("\n"), images: [...this.images] };
  }
}
