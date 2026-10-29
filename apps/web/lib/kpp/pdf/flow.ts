import { Canvas, wrapText } from "./canvas";
import { writePdf, type PdfImage } from "./writer";

/** Page sizes in millimetres, portrait. */
export const PAGE_SIZES = {
  A4: [210, 297],
  A0: [841, 1189],
} as const;

export interface FlowOptions {
  readonly title: string;
  readonly createdIso: string;
  readonly landscape?: boolean;
  /** Printed at the top of every page. */
  readonly header: string;
  /** Printed at the foot of every page, before "Page x of y". */
  readonly footer: string;
}

export interface Column {
  readonly title: string;
  /** A share of the text width; the shares of a table add up to 1. */
  readonly share: number;
}

const MARGIN = 15;
const BODY = 9;
const LINE = 4.2;
const GREY = 0.38;

/**
 * A document that flows down the page: headings, paragraphs and tables with a repeated header
 * row. Every page has the header line and "Page x of y" in the footer. A table row is never split.
 */
export class FlowDoc {
  private readonly pages: Canvas[] = [];
  private y = 0;
  private readonly width: number;
  private readonly height: number;

  constructor(private readonly options: FlowOptions) {
    const [w, h] = PAGE_SIZES.A4;
    this.width = options.landscape ? h : w;
    this.height = options.landscape ? w : h;
    this.newPage();
  }

  private get canvas(): Canvas {
    return this.pages[this.pages.length - 1];
  }

  private get textWidth(): number {
    return this.width - 2 * MARGIN;
  }

  private newPage(): void {
    const canvas = new Canvas(this.width, this.height);
    canvas.text(MARGIN, MARGIN - 4, this.options.header, { size: 8, grey: GREY });
    canvas.line([MARGIN, MARGIN - 2], [this.width - MARGIN, MARGIN - 2], { widthPt: 0.3, grey: 0.6 });
    this.pages.push(canvas);
    this.y = MARGIN + 4;
  }

  private room(mm: number): void {
    if (this.y + mm > this.height - MARGIN - 6) this.newPage();
  }

  heading(text: string, size = 13): this {
    this.room(size * 0.6 + LINE * 2);
    this.y += size * 0.45;
    this.canvas.text(MARGIN, this.y, text, { size, bold: true });
    this.y += LINE;
    return this;
  }

  paragraph(text: string, options: { size?: number; muted?: boolean; bold?: boolean } = {}): this {
    const size = options.size ?? BODY;
    for (const line of wrapText(text, this.textWidth, size)) {
      this.room(LINE);
      this.y += LINE;
      this.canvas.text(MARGIN, this.y, line, { size, grey: options.muted ? GREY : 0, bold: options.bold });
    }
    this.y += 1.5;
    return this;
  }

  bullets(items: readonly string[]): this {
    for (const item of items) this.paragraph(`- ${item}`);
    return this;
  }

  space(mm: number): this {
    this.y += mm;
    return this;
  }

  private row(columns: readonly Column[], cells: readonly string[], bold: boolean): void {
    const wrapped = columns.map((c, i) => wrapText(cells[i] ?? "", c.share * this.textWidth - 2, 8));
    const height = Math.max(...wrapped.map((w) => w.length)) * 3.6 + 1.6;
    let x = MARGIN;
    wrapped.forEach((lines, i) => {
      lines.forEach((line, k) => this.canvas.text(x + 0.5, this.y + 3.4 + k * 3.6, line, { size: 8, bold }));
      x += columns[i].share * this.textWidth;
    });
    this.y += height;
    this.canvas.line([MARGIN, this.y], [this.width - MARGIN, this.y], { widthPt: bold ? 0.6 : 0.25, grey: bold ? 0 : 0.6 });
  }

  private rowHeight(columns: readonly Column[], cells: readonly string[]): number {
    return Math.max(...columns.map((c, i) => wrapText(cells[i] ?? "", c.share * this.textWidth - 2, 8).length)) * 3.6 + 1.6;
  }

  table(columns: readonly Column[], rows: readonly (readonly string[])[]): this {
    const header = columns.map((c) => c.title);
    this.room(this.rowHeight(columns, header) + (rows[0] ? this.rowHeight(columns, rows[0]) : 0));
    this.row(columns, header, true);
    for (const cells of rows) {
      const h = this.rowHeight(columns, cells);
      if (this.y + h > this.height - MARGIN - 6) {
        this.newPage();
        this.row(columns, header, true);
      }
      this.row(columns, cells, false);
    }
    this.y += 3;
    return this;
  }

  /** A picture scaled to fit the text width and at most `maxHeight` millimetres. */
  picture(image: PdfImage, maxHeight: number, caption: string): this {
    const scale = Math.min(this.textWidth / image.width, maxHeight / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    this.room(h + LINE * 2);
    this.canvas.image(image, MARGIN + (this.textWidth - w) / 2, this.y + 2, w, h);
    this.y += h + 2;
    return this.paragraph(caption, { muted: true });
  }

  build(): Uint8Array {
    const total = this.pages.length;
    this.pages.forEach((canvas, i) => {
      canvas.text(MARGIN, this.height - MARGIN + 6, this.options.footer, { size: 8, grey: GREY });
      canvas.text(this.width - MARGIN, this.height - MARGIN + 6, `Page ${i + 1} of ${total}`, { size: 8, grey: GREY, align: "right" });
    });
    return writePdf({ title: this.options.title, createdIso: this.options.createdIso, pages: this.pages.map((c) => c.page()) });
  }
}
