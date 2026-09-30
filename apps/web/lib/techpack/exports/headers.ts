import type { FileName } from "./file-names";
import { contentDisposition } from "./file-names";
import type { ExportFormat } from "./formats";

export const CONTENT_TYPES: Readonly<Record<ExportFormat, string>> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  svg: "image/svg+xml; charset=utf-8",
};

/**
 * An SVG can hold script, so it is sent with a policy that allows nothing but its own styles
 * and its embedded pictures, and that puts it in a sandbox. It is also never served inline.
 */
export const SVG_POLICY = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox";

/** Every header of an export response. The route handler sets all of them itself. */
export function exportHeaders(format: ExportFormat, name: FileName, length: number): Record<string, string> {
  if (!Number.isInteger(length) || length < 0) throw new RangeError("A length is a whole number of bytes.");
  return {
    "content-type": CONTENT_TYPES[format],
    "content-disposition": contentDisposition(name),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-length": String(length),
    ...(format === "svg" ? { "content-security-policy": SVG_POLICY } : {}),
  };
}

/** The one response that carries a file. The bytes are in memory and are sent once. */
export function downloadResponse(format: ExportFormat, name: FileName, content: Uint8Array<ArrayBuffer> | string): Response {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
  return new Response(bytes, { status: 200, headers: exportHeaders(format, name, bytes.byteLength) });
}
