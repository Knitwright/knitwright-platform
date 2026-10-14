import { deflateSync } from "node:zlib";

/**
 * Test fixtures: small PDFs written by hand, so a test can have a clean logo, a PDF with a script (plainly
 * written, or hidden in a compressed object stream), an embedded file or a link, and several pages.
 */

export type PdfOptions = Readonly<{
  pages?: number;
  /** A JavaScript action that runs when the file opens. */
  openScript?: string;
  /** Put the catalog and its script in a compressed object stream, where a byte scan cannot read them. */
  hideInStream?: boolean;
  attachment?: boolean;
  link?: string;
  /** Page size in points. */
  size?: readonly [number, number];
  /** What each page draws: a red square and a blue line by default. */
  content?: string;
}>;

const DEFAULT_CONTENT = "q 1 0 0 rg 20 20 100 60 re f Q 0 0 1 RG 4 w 10 10 m 150 90 l S";

const text = (value: string): Uint8Array => new TextEncoder().encode(value);

const concat = (parts: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

export function buildPdf(options: PdfOptions = {}): Uint8Array {
  const { pages = 1, size = [200, 100], content = DEFAULT_CONTENT } = options;
  const pageIds = Array.from({ length: pages }, (_, i) => 10 + i * 2);
  const objects = new Map<number, string>();
  const catalogBody = [
    "<< /Type /Catalog /Pages 2 0 R",
    options.openScript ? " /OpenAction 6 0 R" : "",
    options.attachment ? " /Names << /EmbeddedFiles << /Names [(note.txt) 7 0 R] >> >>" : "",
    " >>",
  ].join("");
  const scriptBody = options.openScript ? `<< /S /JavaScript /JS (${options.openScript}) >>` : "";
  const hidden = options.hideInStream === true;
  if (!hidden) {
    objects.set(1, catalogBody);
    if (scriptBody) objects.set(6, scriptBody);
  }
  objects.set(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages} >>`);
  if (options.attachment) {
    objects.set(7, "<< /Type /Filespec /F (note.txt) /EF << /F 8 0 R >> >>");
    objects.set(8, "<< /Type /EmbeddedFile /Length 5 >>\nstream\nhello\nendstream");
  }
  pageIds.forEach((id) => {
    const annots = options.link ? ` /Annots [<< /Type /Annot /Subtype /Link /Rect [0 0 50 50] /A << /S /URI /URI (${options.link}) >> >>]` : "";
    objects.set(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${size[0]} ${size[1]}] /Contents ${id + 1} 0 R${annots} >>`);
    objects.set(id + 1, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });

  const chunks: Uint8Array[] = [text("%PDF-1.5\n")];
  const offsets = new Map<number, number>();
  let length = chunks[0].length;
  const add = (id: number, body: string | Uint8Array) => {
    offsets.set(id, length);
    const bytes = concat([text(`${id} 0 obj\n`), typeof body === "string" ? text(body) : body, text("\nendobj\n")]);
    chunks.push(bytes);
    length += bytes.length;
  };
  for (const [id, body] of [...objects].sort((a, b) => a[0] - b[0])) add(id, body);

  let inStream = "";
  if (hidden) {
    const first = catalogBody;
    const second = scriptBody || "<< >>";
    const header = `1 0 6 ${first.length + 1} `;
    const packed = deflateSync(text(`${header}${first}\n${second}`));
    add(5, concat([text(`<< /Type /ObjStm /N 2 /First ${header.length} /Filter /FlateDecode /Length ${packed.length} >>\nstream\n`), packed, text("\nendstream")]));
    inStream = "yes";
  }

  const xrefAt = length;
  const maxId = Math.max(...offsets.keys(), 6) + 1;
  if (hidden) {
    const rows = Array.from({ length: maxId + 1 }, (_, id) => {
      if (id === 1) return [2, 5, 0];
      if (id === 6) return [2, 5, 1];
      if (id === maxId) return [1, xrefAt, 0];
      const at = offsets.get(id);
      return at === undefined ? [0, 0, 0] : [1, at, 0];
    });
    const body = Uint8Array.from(rows.flatMap(([type, a, b]) => [type, (a >> 8) & 255, a & 255, b]));
    const packed = deflateSync(body);
    chunks.push(text(`${maxId} 0 obj\n<< /Type /XRef /Size ${maxId + 1} /W [1 2 1] /Root 1 0 R /Filter /FlateDecode /Length ${packed.length} >>\nstream\n`), packed, text("\nendstream\nendobj\n"));
  } else {
    const lines = Array.from({ length: maxId }, (_, id) => {
      if (id === 0) return "0000000000 65535 f \n";
      const at = offsets.get(id);
      return at === undefined ? "0000000000 00000 f \n" : `${String(at).padStart(10, "0")} 00000 n \n`;
    });
    chunks.push(text(`xref\n0 ${maxId}\n${lines.join("")}trailer\n<< /Size ${maxId} /Root 1 0 R >>\n`));
  }
  chunks.push(text(`startxref\n${xrefAt}\n%%EOF`));
  return inStream === "" ? concat(chunks) : concat(chunks);
}
