/**
 * Marks a PNG as AI generated in its own metadata, as text chunks (PNG spec section 11.3.4.3). Deterministic: no date.
 * The chunks go right after the header chunk, so a viewer finds them before the picture data.
 */

export const AI_LABEL_KEYWORD = "Knitwright-AI-Generated";
const DESCRIPTION_KEYWORD = "Description";

const SIGNATURE_LENGTH = 8;
const HEADER_END = SIGNATURE_LENGTH + 4 + 4 + 13 + 4; // length, type, 13 bytes of header, crc

const TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let c = 0xffffffff;
  for (const byte of bytes) c = (TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Uint8Array): Uint8Array => {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
};

const text = (keyword: string, value: string): Uint8Array => chunk("tEXt", new Uint8Array(Buffer.from(`${keyword}\0${value}`, "latin1")));

/** Latin-1 only, as the chunk requires. */
const plain = (value: string): string => value.replace(/[^\x20-\x7e]/g, "?");

export function labelAsAi(png: Uint8Array, source: Readonly<{ provider: string; scene: string }>): Uint8Array {
  const description = plain(`AI generated picture made by Knitwright from the design's own render. Scene: ${source.scene}. Provider: ${source.provider}.`);
  const added = [text(AI_LABEL_KEYWORD, "true"), text(DESCRIPTION_KEYWORD, description)];
  const length = added.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(png.length + length);
  out.set(png.subarray(0, HEADER_END), 0);
  let at = HEADER_END;
  for (const part of added) {
    out.set(part, at);
    at += part.length;
  }
  out.set(png.subarray(HEADER_END), at);
  return out;
}

/** The text chunks of a PNG, by keyword. Used by tests and by anything that must confirm the label. */
export function readTextChunks(png: Uint8Array): Readonly<Record<string, string>> {
  const found: Record<string, string> = {};
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let at = SIGNATURE_LENGTH;
  while (at + 12 <= png.length) {
    const length = view.getUint32(at);
    const type = Buffer.from(png.subarray(at + 4, at + 8)).toString("latin1");
    if (type === "tEXt") {
      const [keyword = "", ...rest] = Buffer.from(png.subarray(at + 8, at + 8 + length)).toString("latin1").split("\0");
      found[keyword] = rest.join("\0");
    }
    if (type === "IEND") break;
    at += 12 + length;
  }
  return found;
}

export const isLabelledAi = (png: Uint8Array): boolean => readTextChunks(png)[AI_LABEL_KEYWORD] === "true";
