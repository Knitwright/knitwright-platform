/**
 * Test support: reads back a PDF the way a person's viewer would, so a test can check
 * the text and the page size of what a renderer produced.
 */
import { OPS, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface PdfText {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  /** The text matrix: a, b, c, d, e, f. The direction the text runs is (a, b). */
  readonly matrix: readonly number[];
}

const OPERATION_NAMES: Readonly<Record<number, string>> = Object.fromEntries(
  Object.entries(OPS).map(([name, code]) => [code as number, name]),
);

export interface PdfFacts {
  readonly pageCount: number;
  /** The size of the first page in points, 72 to the inch. */
  readonly widthPoints: number;
  readonly heightPoints: number;
  readonly text: string;
  /** Each piece of text with the position of its baseline start, in points from the bottom left. */
  readonly positions: readonly PdfText[];
  /** What page one draws, in order: the name of each operation and its arguments. */
  readonly operations: readonly { readonly name: string; readonly args: readonly unknown[] }[];
  readonly startsAsPdf: boolean;
}

export async function readPdf(bytes: Uint8Array): Promise<PdfFacts> {
  const startsAsPdf = new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, verbosity: 0 });
  const document = await task.promise;
  const first = await document.getPage(1);
  const [, , widthPoints = 0, heightPoints = 0] = first.view;
  const pieces: string[] = [];
  const positions: PdfText[] = [];
  const operations: { name: string; args: unknown[] }[] = [];
  for (let number = 1; number <= document.numPages; number += 1) {
    const page = await document.getPage(number);
    const content = await page.getTextContent();
    pieces.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    if (number === 1) {
      const list = await page.getOperatorList();
      list.fnArray.forEach((code, index) => operations.push({ name: OPERATION_NAMES[code] ?? String(code), args: list.argsArray[index] ?? [] }));
      for (const item of content.items) {
        if ("str" in item && item.str.trim() !== "") positions.push({ text: item.str, x: item.transform[4] ?? 0, y: item.transform[5] ?? 0, width: item.width, matrix: item.transform });
      }
    }
  }
  const pageCount = document.numPages;
  await task.destroy();
  return { pageCount, widthPoints, heightPoints, text: pieces.join("\n"), positions, operations, startsAsPdf };
}
