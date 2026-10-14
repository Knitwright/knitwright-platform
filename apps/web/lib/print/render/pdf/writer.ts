import { zlibSync } from "fflate";

const encode = (text: string): Uint8Array => new Uint8Array(Buffer.from(text, "latin1"));

export const concat = (chunks: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
};

/** The same compression every time: level 6, nothing that depends on the clock. */
export const deflate = (data: Uint8Array): Uint8Array => zlibSync(data, { level: 6 });

/** A stream object body. `dict` holds the entries other than /Length. */
export const streamBody = (dict: string, data: Uint8Array): Uint8Array =>
  concat([encode(`<< ${dict} /Length ${data.length} >>\nstream\n`), data, encode("\nendstream")]);

export const textBody = (text: string): Uint8Array => encode(text);

/** A PDF literal string holding only printable ASCII. */
export function pdfString(text: string): string {
  const ascii = text.replace(/[\r\n\t]+/g, " ").replace(/[^\x20-\x7e]/g, "?");
  return `(${ascii.replace(/[\\()]/g, (char) => `\\${char}`)})`;
}

const pad = (value: number, width: number): string => String(value).padStart(width, "0");

/**
 * The finished file. Object `n` is `bodies[n - 1]`. The table of byte offsets is worked out from
 * what is written, and there is no file id and no date.
 */
export function assemble(bodies: readonly Uint8Array[], rootId: number, infoId: number): Uint8Array {
  const chunks: Uint8Array[] = [new Uint8Array([...encode("%PDF-1.7\n%"), 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])];
  let length = chunks[0]?.length ?? 0;
  const offsets: number[] = [];
  bodies.forEach((body, index) => {
    offsets.push(length);
    const piece = concat([encode(`${index + 1} 0 obj\n`), body, encode("\nendobj\n")]);
    chunks.push(piece);
    length += piece.length;
  });
  const entries = offsets.map((offset) => `${pad(offset, 10)} 00000 n \n`);
  const table = `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n${entries.join("")}`;
  const trailer = `trailer\n<< /Size ${bodies.length + 1} /Root ${rootId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${length}\n%%EOF\n`;
  chunks.push(encode(table + trailer));
  return concat(chunks);
}
