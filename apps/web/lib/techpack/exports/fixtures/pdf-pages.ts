/**
 * Test support: reads a PDF back page by page, as a person's viewer would, so a test can check
 * the text of each page, the size of the page and what it draws. Nothing here is used by the app.
 */
import { OPS, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface ReadPage {
  readonly number: number;
  readonly widthPoints: number;
  readonly heightPoints: number;
  /** Text items joined by a space, with runs of white space made into one space. */
  readonly text: string;
  /** The names of the drawing operations on the page. */
  readonly operations: readonly string[];
}

const NAMES: Readonly<Record<number, string>> = Object.fromEntries(Object.entries(OPS).map(([name, code]) => [code as number, name]));

const squash = (text: string): string => text.replace(/\s+/g, " ").trim();

/** Reading the drawing operations is slow, so it is done only when asked for. */
export async function readPages(bytes: Uint8Array, options: { readonly operations?: boolean } = {}): Promise<readonly ReadPage[]> {
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, verbosity: 0 });
  const document = await task.promise;
  const pages: ReadPage[] = [];
  for (let number = 1; number <= document.numPages; number += 1) {
    const page = await document.getPage(number);
    const content = await page.getTextContent();
    const list = options.operations ? await page.getOperatorList() : { fnArray: [] as number[] };
    const [, , widthPoints = 0, heightPoints = 0] = page.view;
    pages.push({
      number,
      widthPoints,
      heightPoints,
      text: squash(content.items.map((item) => ("str" in item ? item.str : "")).join(" ")),
      operations: list.fnArray.map((code) => NAMES[code] ?? String(code)),
    });
  }
  await task.destroy();
  return pages;
}

export const allText = (pages: readonly ReadPage[]): string => pages.map((page) => page.text).join(" ");
