/**
 * A zip writer that stores files as they are (no compression), with a fixed date and a fixed order, so two runs give the
 * same bytes. Print files are PDF and TIFF, which are compressed already, so storing loses little. Names are UTF-8.
 */

const TABLE = ((): Uint32Array => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  readonly path: string;
  readonly bytes: Uint8Array;
}

/** 1 January 1980, midnight: the earliest date a zip can hold. */
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1;
const LIMIT = 0xffffffff;

const u16 = (v: number): number[] => [v & 0xff, (v >>> 8) & 0xff];
const u32 = (v: number): number[] => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];

function safePath(path: string): string {
  if (path.startsWith("/") || path.split("/").some((part) => part === ".." || part === "")) throw new RangeError(`"${path}" is not a safe path for a file in a zip.`);
  return path;
}

export function buildZip(entries: readonly ZipEntry[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: number[][] = [];
  const names = new Set<string>();
  let offset = 0;
  for (const entry of entries) {
    const name = new TextEncoder().encode(safePath(entry.path));
    if (names.has(entry.path)) throw new RangeError(`Two files would be called "${entry.path}".`);
    names.add(entry.path);
    if (entry.bytes.length >= LIMIT || offset >= LIMIT) throw new RangeError("This set of files is too big for one zip. Ask for fewer sizes or formats.");
    const crc = crc32(entry.bytes);
    const common = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(DOS_TIME), ...u16(DOS_DATE), ...u32(crc), ...u32(entry.bytes.length), ...u32(entry.bytes.length), ...u16(name.length), ...u16(0)];
    parts.push(Uint8Array.from([...u32(0x04034b50), ...common]), name, entry.bytes);
    central.push([...u32(0x02014b50), ...u16(20), ...common.slice(0, 26), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...Array.from(name)]);
    offset += 30 + name.length + entry.bytes.length;
  }
  const directory = Uint8Array.from(central.flat());
  const end = Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length), ...u32(directory.length), ...u32(offset), ...u16(0)]);
  const out = new Uint8Array(offset + directory.length + end.length);
  let at = 0;
  for (const part of [...parts, directory, end]) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
