import { contentDisposition, type FileName } from "@/lib/techpack/exports/file-names";

const MAX = 60;
const NOT_SAFE = /[^A-Za-z0-9_-]/g;
const NOT_KEPT = /[\p{Cc}\p{Cf}\p{Cs}\/\\:*?"<>|]/gu;

const part = (text: string, pattern: RegExp, fallback: string): string => {
  const cleaned = Array.from(text.replace(pattern, "-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "")).slice(0, MAX).join("").replace(/-+$/g, "");
  return cleaned === "" ? fallback : cleaned;
};

/** The name of the zip and of the folder inside it: the style number, else the design's name, then the version. */
export function printZipName(input: { styleNumber: string; designName: string; version: number }): FileName & { folder: string } {
  const base = input.styleNumber.trim() !== "" ? input.styleNumber.trim() : input.designName.trim();
  const plain = `${part(base, NOT_SAFE, "design")}-v${input.version}-print-files`;
  const original = `${part(base, NOT_KEPT, "design")}-v${input.version}-print-files`;
  return { plain: `${plain}.zip`, original: `${original}.zip`, folder: plain };
}

/** Every header of the zip response. A zip is a download, never shown in the page. */
export function zipHeaders(name: FileName, length: number): Record<string, string> {
  return {
    "content-type": "application/zip",
    "content-disposition": contentDisposition(name),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-length": String(length),
    "content-security-policy": "default-src 'none'; sandbox",
  };
}
