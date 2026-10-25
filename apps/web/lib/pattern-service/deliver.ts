import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/server/core/errors";
import { storeProductionFile } from "@/lib/storage/store";
import { attachFiles, getRequest } from "./service";

export type DeliveredUpload = Readonly<{ name: string; bytes: Uint8Array }>;

export const MAX_DELIVERED_BYTES = 10 * 1024 * 1024;

/** A DXF file is plain text that starts with a section marker. A name alone proves nothing, so the bytes are looked at. */
export function looksLikeDxf(bytes: Uint8Array): boolean {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_DELIVERED_BYTES) return false;
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 64));
  return /^\s*0\s*\r?\n\s*SECTION\b/.test(head);
}

/**
 * Stores each file as a pattern-source file of the request's brand and lists them on the request. The request must exist and be in progress;
 * the database checks the actor and the status again. Nothing is attached when any file is not a DXF.
 */
export async function attachDelivered(
  admin: SupabaseClient,
  client: SupabaseClient,
  actor: string,
  requestId: string,
  uploads: readonly DeliveredUpload[],
): Promise<Readonly<{ fileIds: readonly string[] }>> {
  const request = await getRequest(client, requestId);
  if (!request) throw new AppError("not_found", "That request does not exist.");
  if (request.status !== "in_progress") throw new AppError("conflict", "Files can be attached while the request is being drafted.");
  if (!uploads.every((u) => looksLikeDxf(u.bytes))) throw new AppError("invalid_input", "Only DXF files up to 10 MB can be attached.");

  const fileIds: string[] = [];
  for (const upload of uploads) {
    const stored = await storeProductionFile("pattern-source", { admin, brandId: request.brandId, userId: actor, bytes: upload.bytes, contentType: "application/dxf" });
    fileIds.push(stored.id);
  }
  await attachFiles(admin, actor, requestId, fileIds);
  return { fileIds };
}
