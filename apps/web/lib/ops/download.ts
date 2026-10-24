import type { Batch } from "./rows";

const safe = (text: string): string => text.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 40) || "batch";

/** `team-jersey-2026-10-23-factory-sheet.pdf`: the article, the cut-off date and the kind of file. */
export const sheetFileName = (batch: Pick<Batch, "articleId" | "cutoffAt">, kind: string): string => `${safe(batch.articleId)}-${batch.cutoffAt.slice(0, 10)}-${kind}`;

/** A download that is never stored or cached and cannot be run by the browser. */
export function fileResponse(bytes: Uint8Array, contentType: string, fileName: string): Response {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "content-length": String(bytes.byteLength),
    },
  });
}
