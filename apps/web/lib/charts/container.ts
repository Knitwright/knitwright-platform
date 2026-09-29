import { CHART_IMPORT_LIMITS } from "./limits";

/**
 * What kind of file a brand sent, judged from its bytes and never from its name or the
 * type the browser stated. A spreadsheet is a zip archive, so its table of contents is
 * read first and an archive that would unpack to far more than it holds is refused
 * before anything unpacks it.
 */
export type SheetKind =
  | { readonly ok: true; readonly kind: "xlsx" }
  | { readonly ok: true; readonly kind: "csv"; readonly text: string }
  | { readonly ok: false; readonly message: string };

const refuse = (message: string): SheetKind => ({ ok: false, message });

const ZIP_LOCAL = [0x50, 0x4b, 0x03, 0x04];
const OLD_EXCEL = [0xd0, 0xcf, 0x11, 0xe0];
const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
const END_RECORD_LENGTH = 22;
const ENTRY_HEADER_LENGTH = 46;
const MAX_COMMENT_LENGTH = 0xffff;
const ZIP64_MARK = 0xffffffff;
/** Small parts may pack very tightly without meaning harm. The ratio is checked above this. */
const RATIO_CHECKED_FROM = 64 * 1024;
const REQUIRED_PARTS = ["[Content_Types].xml", "xl/workbook.xml"];

const startsWith = (bytes: Uint8Array, prefix: readonly number[]): boolean =>
  prefix.every((byte, index) => bytes[index] === byte);

const NOT_A_SPREADSHEET = "This file is not a spreadsheet we can read. Save it as .xlsx or .csv and try again.";
const UNPACKS_TOO_BIG = "This spreadsheet would unpack to far more than a size chart needs, so it is not opened.";

function findEndOfDirectory(view: DataView): number | null {
  const lowest = Math.max(0, view.byteLength - END_RECORD_LENGTH - MAX_COMMENT_LENGTH);
  for (let at = view.byteLength - END_RECORD_LENGTH; at >= lowest; at -= 1) {
    if (view.getUint32(at, true) === END_OF_DIRECTORY) return at;
  }
  return null;
}

interface Entry {
  readonly name: string;
  readonly packed: number;
  readonly unpacked: number;
}

function readEntries(view: DataView, bytes: Uint8Array): readonly Entry[] | string {
  const end = findEndOfDirectory(view);
  if (end === null) return NOT_A_SPREADSHEET;
  const count = view.getUint16(end + 10, true);
  const start = view.getUint32(end + 16, true);
  if (count > CHART_IMPORT_LIMITS.maxZipEntries) {
    return `This spreadsheet has ${count} parts inside. A size chart needs far fewer, so it is not opened.`;
  }
  const decoder = new TextDecoder();
  const entries: Entry[] = [];
  let at = start;
  for (let index = 0; index < count; index += 1) {
    if (at + ENTRY_HEADER_LENGTH > end || view.getUint32(at, true) !== DIRECTORY_ENTRY) return NOT_A_SPREADSHEET;
    const packed = view.getUint32(at + 20, true);
    const unpacked = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const skip = nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    if (packed === ZIP64_MARK || unpacked === ZIP64_MARK) return UNPACKS_TOO_BIG;
    const name = decoder.decode(bytes.subarray(at + ENTRY_HEADER_LENGTH, at + ENTRY_HEADER_LENGTH + nameLength));
    entries.push({ name, packed, unpacked });
    at += ENTRY_HEADER_LENGTH + skip;
  }
  return entries;
}

function checkArchive(bytes: Uint8Array): SheetKind {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < END_RECORD_LENGTH) return refuse(NOT_A_SPREADSHEET);
  const entries = readEntries(view, bytes);
  if (typeof entries === "string") return refuse(entries);
  const total = entries.reduce((sum, entry) => sum + entry.unpacked, 0);
  const swollen = entries.some(
    (entry) =>
      entry.unpacked > RATIO_CHECKED_FROM &&
      entry.unpacked / Math.max(entry.packed, 1) > CHART_IMPORT_LIMITS.maxPackingRatio,
  );
  if (swollen || total > CHART_IMPORT_LIMITS.maxUnpackedBytes) return refuse(UNPACKS_TOO_BIG);
  const names = new Set(entries.map((entry) => entry.name));
  if (!REQUIRED_PARTS.every((part) => names.has(part))) return refuse(NOT_A_SPREADSHEET);
  return { ok: true, kind: "xlsx" };
}

function readText(bytes: Uint8Array): SheetKind {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    return refuse("This file is not text we can read. Save it as .xlsx, or as CSV in UTF-8, and try again.");
  }
  if (text.includes("\u0000")) return refuse(NOT_A_SPREADSHEET);
  return { ok: true, kind: "csv", text };
}

export function sheetKind(bytes: Uint8Array): SheetKind {
  if (bytes.byteLength === 0) return refuse("The file is empty.");
  if (bytes.byteLength > CHART_IMPORT_LIMITS.maxBytes) {
    return refuse(`The file is too large. A size chart file may be at most ${CHART_IMPORT_LIMITS.maxBytes / 1024} KB.`);
  }
  if (startsWith(bytes, OLD_EXCEL)) {
    return refuse("This is the old Excel format. Save it as .xlsx or .csv and try again.");
  }
  if (startsWith(bytes, ZIP_LOCAL)) return checkArchive(bytes);
  return readText(bytes);
}
