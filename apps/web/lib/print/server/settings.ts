import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { FileReader } from "@/lib/storage/read";
import { TOO_LARGE } from "@/lib/storage/read";
import { AppError } from "@/lib/server/core/errors";
import { DEFAULT_SETTINGS, type PrintSettings } from "../layout/context";
import type { PrintProfileInput } from "./schemas";

const profileRow = z.object({
  bleed_mm: z.coerce.number(),
  dpi: z.number().int(),
  min_dpi: z.number().int(),
  max_print_width_mm: z.coerce.number().nullable(),
  icc_file_id: z.uuid().nullable(),
});

/** The biggest colour profile file read, in bytes. Real profiles are tens of kilobytes to a few megabytes. */
export const MAX_ICC_BYTES = 8_000_000;

export const ICC_NOT_FOUND = "That colour profile is not in your files. Upload it again.";

/** The profile's own name, from its description tag, for the margin. Null when it cannot be read. */
export function iccName(bytes: Uint8Array): string | null {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.length < 132 || String.fromCharCode(...bytes.subarray(36, 40)) !== "acsp") return null;
    const count = view.getUint32(128);
    for (let i = 0; i < Math.min(count, 200); i += 1) {
      const at = 132 + i * 12;
      if (String.fromCharCode(...bytes.subarray(at, at + 4)) !== "desc") continue;
      const offset = view.getUint32(at + 4);
      const type = String.fromCharCode(...bytes.subarray(offset, offset + 4));
      if (type === "desc") {
        const length = view.getUint32(offset + 8);
        return String.fromCharCode(...bytes.subarray(offset + 12, offset + 12 + Math.max(0, length - 1))).trim() || null;
      }
      if (type === "mluc") {
        // Records start at byte 16: language, country, length and offset of the first name.
        const [count, length, from] = [view.getUint32(offset + 8), view.getUint32(offset + 20), view.getUint32(offset + 24)];
        if (count < 1) return null;
        const text: number[] = [];
        for (let k = 0; k < length; k += 2) text.push(view.getUint16(offset + from + k));
        return String.fromCharCode(...text).trim() || null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * The brand's print settings. A brand that has not set a profile gets Knitwright's defaults, and the files say so; a
 * profile that names a colour profile file has that file read through the brand's own file reader.
 */
export async function loadPrintSettings(client: SupabaseClient, reader: FileReader, brandId: string): Promise<PrintSettings> {
  const { data, error } = await client.from("print_profiles").select("bleed_mm, dpi, min_dpi, max_print_width_mm, icc_file_id").eq("brand_id", brandId).maybeSingle();
  if (error) throw new Error("The print profile could not be read.", { cause: error });
  if (data === null || data === undefined) return DEFAULT_SETTINGS;
  const row = profileRow.parse(data);
  const icc = row.icc_file_id === null ? null : await reader.read(row.icc_file_id, MAX_ICC_BYTES);
  const bytes = icc === null || icc === TOO_LARGE ? null : icc.bytes;
  return {
    bleedMm: row.bleed_mm,
    dpi: row.dpi,
    minDpi: row.min_dpi,
    maxPrintWidthMm: row.max_print_width_mm,
    iccFileId: row.icc_file_id,
    source: "print-house",
    iccBytes: bytes,
    iccName: bytes === null ? null : iccName(bytes),
  };
}

type Who = Readonly<{ brandId: string; userId: string }>;

/** Saves the brand's print profile (one per brand). The colour profile must be one of the brand's own files. */
export async function savePrintProfile(admin: SupabaseClient, who: Who, input: PrintProfileInput): Promise<void> {
  if (input.iccFileId !== null) {
    const file = await admin.from("files").select("id").eq("id", input.iccFileId).eq("brand_id", who.brandId).maybeSingle();
    if (file.error) throw new Error("The colour profile could not be looked up.", { cause: file.error });
    if (!file.data) throw new AppError("invalid_input", ICC_NOT_FOUND);
  }
  const fields = {
    bleed_mm: input.bleedMm,
    dpi: input.dpi,
    min_dpi: input.minDpi,
    max_print_width_mm: input.maxPrintWidthMm,
    icc_file_id: input.iccFileId,
    updated_by: who.userId,
    updated_at: new Date().toISOString(),
  };
  const existing = await admin.from("print_profiles").select("id").eq("brand_id", who.brandId).maybeSingle();
  if (existing.error) throw new Error("The print profile could not be read.", { cause: existing.error });
  let { error } = existing.data
    ? await admin.from("print_profiles").update(fields).eq("brand_id", who.brandId)
    : await admin.from("print_profiles").insert({ brand_id: who.brandId, created_by: who.userId, ...fields });
  // Two people saving a first profile at once: the second finds it there, and changes it instead.
  if (error?.code === "23505") ({ error } = await admin.from("print_profiles").update(fields).eq("brand_id", who.brandId));
  if (error) throw new Error("The print profile could not be saved.", { cause: error });
}
