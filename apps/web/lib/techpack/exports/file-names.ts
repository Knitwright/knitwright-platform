import { EXTENSIONS, type ExportFormat } from "./formats";
import type { View } from "@/lib/flat/model";

/** The longest the name part of a file name may be, in characters. */
export const MAX_NAME_LENGTH = 60;

const FALLBACK = "design";
const NOT_SAFE = /[^A-Za-z0-9_-]/g;
/** Control characters, marks that change the direction of text, and the characters a path is made of. */
const NOT_KEPT = /[\p{Cc}\p{Cf}\p{Cs}\/\\:*?"<>|]/gu;

export interface FileNameInput {
  readonly styleNumber: string;
  readonly designName: string;
  readonly version: number;
  readonly format: ExportFormat;
  /** Which drawing, for an SVG. Null for the other formats. */
  readonly view: View | null;
}

export interface FileName {
  /** Letters, digits, hyphen and underscore only. Safe in any header. */
  readonly plain: string;
  /** The same name with the original words kept, for the UTF-8 form. Holds no control or path characters. */
  readonly original: string;
}

const kind = (input: FileNameInput): string => (input.format === "svg" && input.view ? input.view : "tech-pack");

const nameOf = (input: FileNameInput): string =>
  input.styleNumber.trim() !== "" ? input.styleNumber.trim() : input.designName.trim();

const plainPart = (text: string): string => {
  const safe = text.replace(NOT_SAFE, "-").replace(/^-+|-+$/g, "").slice(0, MAX_NAME_LENGTH).replace(/-+$/g, "");
  return safe === "" ? FALLBACK : safe;
};

const originalPart = (text: string): string => {
  const kept = Array.from(text.replace(NOT_KEPT, "-").replace(/^-+|-+$/g, "")).slice(0, MAX_NAME_LENGTH).join("");
  return kept === "" ? FALLBACK : kept;
};

/**
 * The name of a downloaded file: the style number, or the design name when there is none,
 * then the version and the kind, such as `KW-001-v3-tech-pack.pdf`. The plain name is made
 * only of characters that are safe in a header and in every file system.
 */
export function exportFileName(input: FileNameInput): FileName {
  const tail = `-v${input.version}-${kind(input)}.${EXTENSIONS[input.format]}`;
  const name = nameOf(input);
  return { plain: `${plainPart(name)}${tail}`, original: `${originalPart(name)}${tail}` };
}

/** RFC 5987 encoding: everything except letters, digits and a few marks is written as percent-bytes. */
const encoded = (text: string): string =>
  encodeURIComponent(text).replace(/['()*]/g, (mark) => `%${mark.charCodeAt(0).toString(16).toUpperCase()}`);

/** The content-disposition header: always an attachment, with the plain name and, when it differs, the UTF-8 name. */
export function contentDisposition(name: FileName): string {
  const base = `attachment; filename="${name.plain}"`;
  return name.original === name.plain ? base : `${base}; filename*=UTF-8''${encoded(name.original)}`;
}
