import { createHash } from "node:crypto";

/**
 * A small PDF 1.4 writer for the package's own documents (decision 0070). It knows two fonts
 * (Helvetica and Helvetica-Bold, which every reader carries, so nothing is embedded), lines,
 * paths, rectangles and JPEG pictures. It has no clock and no random id: the creation date is
 * the one passed in (the design version's creation time) and the file id is a hash of the
 * content, so the same document gives the same bytes.
 */

export const PT_PER_MM = 72 / 25.4;

export interface PdfImage {
  readonly name: string;
  readonly jpeg: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly components: 1 | 3 | 4;
}

export interface PdfPage {
  readonly widthMm: number;
  readonly heightMm: number;
  /** The page's content stream, already in PDF operators. */
  readonly content: string;
  readonly images: readonly PdfImage[];
}

export interface PdfDocument {
  readonly title: string;
  /** Written as the creation and modification date. */
  readonly createdIso: string;
  readonly pages: readonly PdfPage[];
}

/** Characters the standard fonts lack, written as the nearest plain text. */
const SUBSTITUTES: Readonly<Record<string, string>> = {
  "Δ": "d",
  "–": "-",
  "—": "-",
  "−": "-",
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "≤": "<=",
  "≥": ">=",
  "…": "...",
  "•": "-",
  "→": "->",
};

const inWinAnsi = (code: number): boolean => (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff);

/** Text the standard fonts can draw: Latin-1 printable characters only; anything else is a question mark. */
export function winAnsi(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const sub = SUBSTITUTES[ch];
    if (sub !== undefined) out += sub;
    else if (ch === "\n" || ch === "\r" || ch === "\t") out += " ";
    else out += inWinAnsi(ch.codePointAt(0) ?? 0) ? ch : "?";
  }
  return out;
}

/** A PDF literal string. */
export const pdfString = (text: string): string => `(${winAnsi(text).replace(/[\\()]/g, (m) => `\\${m}`)})`;

/** A number with two decimals and no negative zero. */
export const num = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  return (rounded === 0 ? 0 : rounded).toFixed(2);
};

/** `D:YYYYMMDDHHmmssZ` in UTC. */
export function pdfDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Not a date: ${iso}`);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `D:${p(d.getUTCFullYear(), 4)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

/** Width, height and colour components of a baseline or progressive JPEG, read from its frame header. */
export function jpegInfo(bytes: Uint8Array): { width: number; height: number; components: 1 | 3 | 4 } {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("Not a JPEG.");
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) throw new Error("Broken JPEG marker.");
    const marker = bytes[i + 1];
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      const components = bytes[i + 9];
      if (components !== 1 && components !== 3 && components !== 4) throw new Error("Unsupported JPEG colour.");
      return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8], components };
    }
    i += 2 + length;
  }
  throw new Error("JPEG has no frame header.");
}

const latin1 = (text: string): Uint8Array => Uint8Array.from(Buffer.from(text, "latin1"));

const COLOUR_SPACE: Readonly<Record<1 | 3 | 4, string>> = { 1: "/DeviceGray", 3: "/DeviceRGB", 4: "/DeviceCMYK" };

type Body = readonly (string | Uint8Array)[];

function imageObject(image: PdfImage): Body {
  const head = `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace ${COLOUR_SPACE[image.components]} /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.jpeg.length} >>\nstream\n`;
  return [head, image.jpeg, "\nendstream"];
}

function streamObject(content: string): Body {
  const bytes = latin1(content);
  return [`<< /Length ${bytes.length} >>\nstream\n`, bytes, "\nendstream"];
}

/** Objects 1 to 5 are fixed; each page then takes a page object, a content object and one per picture. */
function objectsOf(doc: PdfDocument): Body[] {
  const pageObjects: Body[] = [];
  const kids: number[] = [];
  let next = 6;
  for (const page of doc.pages) {
    const pageId = next;
    const contentId = next + 1;
    const imageIds = page.images.map((_, k) => next + 2 + k);
    next += 2 + page.images.length;
    kids.push(pageId);
    const xobjects = page.images.map((img, k) => `/${img.name} ${imageIds[k]} 0 R`).join(" ");
    pageObjects.push(
      [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(page.widthMm * PT_PER_MM)} ${num(page.heightMm * PT_PER_MM)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xobjects ? ` /XObject << ${xobjects} >>` : ""} >> /Contents ${contentId} 0 R >>`],
      streamObject(page.content),
      ...page.images.map(imageObject),
    );
  }
  const date = pdfDate(doc.createdIso);
  return [
    ["<< /Type /Catalog /Pages 2 0 R >>"],
    [`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`],
    ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"],
    ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"],
    [`<< /Title ${pdfString(doc.title)} /Creator (Knitwright) /Producer (Knitwright KPP) /CreationDate (${date}) /ModDate (${date}) >>`],
    ...pageObjects,
  ];
}

/** The document as PDF bytes. */
export function writePdf(doc: PdfDocument): Uint8Array {
  if (doc.pages.length === 0) throw new Error("A PDF needs at least one page.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? latin1(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  push("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
  const offsets: number[] = [];
  objectsOf(doc).forEach((body, index) => {
    offsets.push(length);
    push(`${index + 1} 0 obj\n`);
    body.forEach(push);
    push("\nendobj\n");
  });
  const hash = createHash("sha256");
  for (const chunk of chunks) hash.update(chunk);
  const id = hash.digest("hex").slice(0, 32);
  const xref = length;
  push(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`);
  for (const offset of offsets) push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R /Info 5 0 R /ID [<${id}> <${id}>] >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
