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
  /**
   * The colourway an SVG is drawn in, when the design has more than one, so the drawings of two
   * colourways are saved under two names (owner decision 2026-09-30: one drawing per colourway).
   */
  readonly colourway?: string | null;
}

/** The longest the colourway part of a drawing's file name may be, in characters. */
export const MAX_COLOURWAY_LENGTH = 30;

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
 * then the version and the kind, such as `KW-001-v3-tech-pack.pdf`. A drawing of a design with
 * several colourways names its colourway too, such as `KW-001-v3-Away-front.svg`. The plain name is made
 * only of characters that are safe in a header and in every file system.
 */
export function exportFileName(input: FileNameInput): FileName {
  const name = nameOf(input);
  const colourway = input.format === "svg" && input.view ? (input.colourway?.trim() ?? "") : "";
  const tail = (part: (text: string) => string): string => {
    const drawnIn = colourway === "" ? "" : `${Array.from(part(colourway).replace(/-{2,}/g, "-")).slice(0, MAX_COLOURWAY_LENGTH).join("").replace(/-+$/g, "")}-`;
    return `-v${input.version}-${drawnIn}${kind(input)}.${EXTENSIONS[input.format]}`;
  };
  return { plain: `${plainPart(name)}${tail(plainPart)}`, original: `${originalPart(name)}${tail(originalPart)}` };
}

/** RFC 5987 encoding: everything except letters, digits and a few marks is written as percent-bytes. */
const encoded = (text: string): string =>
  encodeURIComponent(text).replace(/['()*]/g, (mark) => `%${mark.charCodeAt(0).toString(16).toUpperCase()}`);

/** The content-disposition header: always an attachment, with the plain name and, when it differs, the UTF-8 name. */
export function contentDisposition(name: FileName): string {
  const base = `attachment; filename="${name.plain}"`;
  return name.original === name.plain ? base : `${base}; filename*=UTF-8''${encoded(name.original)}`;
}
