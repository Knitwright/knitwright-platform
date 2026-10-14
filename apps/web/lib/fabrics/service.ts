import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { SizeLabelMap } from "@/lib/production/contract";
import { DEFAULT_SIZE_LABEL_MAPS } from "@/lib/sizing";
import { AppError } from "@/lib/server/core/errors";
import { fabricFromRow, fabricRowSchema, mapRowSchema, testFromRow, testRowSchema, type StoredFabric } from "./rows";
import { BENCHMARK_FABRICS } from "./seed";
import { MAX_FABRICS_PER_BRAND, type FabricInput, type FabricTestInput, type SizeMapEntry } from "./schemas";
import { profileFromSheet } from "./sheet";
import { sizeMapKey } from "./size-maps";

/**
 * Fabrics, fabric tests and size label maps in the database. Reads for a person go through their own
 * client, so the database's rules decide what they see. Every write goes through the server's client,
 * and the brand always comes from the session, never from the request.
 */

const failIf = (error: { message: string } | null, what: string): void => {
  if (error) throw new Error(what, { cause: error });
};

const read = <T>(schema: z.ZodType<T>, data: unknown, what: string): T[] => {
  const parsed = z.array(schema).safeParse(data ?? []);
  if (!parsed.success) throw new Error(`The database gave an unexpected answer for ${what}.`);
  return parsed.data;
};

export const FABRIC_NOT_FOUND = "That fabric does not exist.";
export const FABRIC_NAME_TAKEN = "You already have a fabric with that name.";
export const TOO_MANY_FABRICS = `A brand can keep ${MAX_FABRICS_PER_BRAND} fabrics. Remove one you no longer use before adding another.`;
export const PHOTO_NOT_FOUND = "One of the photos is not in your files. Upload it again.";

export async function listFabrics(client: SupabaseClient, brandId: string): Promise<readonly StoredFabric[]> {
  const fabrics = await client.from("base_fabrics").select("*").eq("brand_id", brandId).order("name");
  failIf(fabrics.error, "The fabrics could not be read.");
  const tests = await client.from("fabric_tests").select("*").eq("brand_id", brandId);
  failIf(tests.error, "The fabric tests could not be read.");
  const parsedTests = read(testRowSchema, tests.data, "fabric tests").map(testFromRow);
  return read(fabricRowSchema, fabrics.data, "fabrics").map((row) => fabricFromRow(row, parsedTests));
}

type Who = Readonly<{ brandId: string; userId: string }>;

const fabricFields = (input: FabricInput) => ({
  name: input.name,
  composition: input.composition,
  construction: input.construction,
  notes: input.notes,
  profile: profileFromSheet(input.supplier),
});

const fabricRow = (who: Who, input: FabricInput) => ({ brand_id: who.brandId, created_by: who.userId, ...fabricFields(input) });

export async function createFabric(admin: SupabaseClient, who: Who, input: FabricInput): Promise<string> {
  const count = await admin.from("base_fabrics").select("id").eq("brand_id", who.brandId);
  failIf(count.error, "The fabrics could not be counted.");
  if ((count.data ?? []).length >= MAX_FABRICS_PER_BRAND) throw new AppError("invalid_input", TOO_MANY_FABRICS);
  const { data, error } = await admin.from("base_fabrics").insert(fabricRow(who, input)).select("id").single();
  if (error?.code === "23505") throw new AppError("conflict", FABRIC_NAME_TAKEN);
  failIf(error, "The fabric could not be saved.");
  return z.object({ id: z.uuid() }).parse(data).id;
}

/** Puts the three benchmark fabrics in a brand's library the first time it is opened. Does nothing if it has any. */
export async function seedBenchmarkFabrics(admin: SupabaseClient, who: Who): Promise<boolean> {
  const existing = await admin.from("base_fabrics").select("id").eq("brand_id", who.brandId);
  failIf(existing.error, "The fabrics could not be read.");
  if ((existing.data ?? []).length > 0) return false;
  const { error } = await admin.from("base_fabrics").insert(BENCHMARK_FABRICS.map((f) => fabricRow(who, f)));
  // Two people opening the page at once: the second finds the names taken, which is fine.
  if (error?.code === "23505") return false;
  failIf(error, "The starting fabrics could not be saved.");
  return true;
}

/** Replaces what a fabric's supplier sheet states. Tested numbers are not touched: they live in tests. */
export async function updateFabric(admin: SupabaseClient, who: Who, fabricId: string, input: FabricInput): Promise<void> {
  const found = await admin.from("base_fabrics").select("id").eq("id", fabricId).eq("brand_id", who.brandId).maybeSingle();
  failIf(found.error, "The fabric could not be read.");
  if (!found.data) throw new AppError("not_found", FABRIC_NOT_FOUND);
  const { error } = await admin
    .from("base_fabrics")
    .update({ ...fabricFields(input), updated_at: new Date().toISOString() })
    .eq("id", fabricId)
    .eq("brand_id", who.brandId);
  if (error?.code === "23505") throw new AppError("conflict", FABRIC_NAME_TAKEN);
  failIf(error, "The fabric could not be saved.");
}

/** Adds a test record. The fabric and every photo must belong to the brand. */
export async function addFabricTest(admin: SupabaseClient, who: Who, fabricId: string, input: FabricTestInput): Promise<string> {
  const found = await admin.from("base_fabrics").select("id").eq("id", fabricId).eq("brand_id", who.brandId).maybeSingle();
  failIf(found.error, "The fabric could not be read.");
  if (!found.data) throw new AppError("not_found", FABRIC_NOT_FOUND);
  const wanted = [...new Set(input.photoFileIds)];
  if (wanted.length > 0) {
    const files = await admin.from("files").select("id").eq("brand_id", who.brandId).in("id", wanted);
    failIf(files.error, "The photos could not be read.");
    if ((files.data ?? []).length !== wanted.length) throw new AppError("not_found", PHOTO_NOT_FOUND);
  }
  const { data, error } = await admin
    .from("fabric_tests")
    .insert({
      brand_id: who.brandId,
      fabric_id: fabricId,
      tested_by: input.testedBy,
      tested_on: input.testedOn,
      method: input.method,
      load_newtons: input.loadNewtons ?? null,
      stretch_length_pct: input.stretchLengthPct ?? null,
      stretch_width_pct: input.stretchWidthPct ?? null,
      recovery_pct: input.recoveryPct ?? null,
      shrink_length_pct: input.shrinkLengthPct ?? null,
      shrink_width_pct: input.shrinkWidthPct ?? null,
      press_temp_c: input.pressTempC ?? null,
      press_seconds: input.pressSeconds ?? null,
      reduction_pct: input.reductionPct ?? null,
      photo_file_ids: wanted,
      created_by: who.userId,
    })
    .select("id")
    .single();
  failIf(error, "The fabric test could not be saved.");
  return z.object({ id: z.uuid() }).parse(data).id;
}

/** A brand's own choices of pattern size, not the suggested defaults. */
export async function listSavedSizeMaps(client: SupabaseClient, brandId: string): Promise<readonly SizeLabelMap[]> {
  const { data, error } = await client.from("size_label_maps").select("label, wearer, cut, pattern_size, source").eq("brand_id", brandId);
  failIf(error, "The size map could not be read.");
  return read(mapRowSchema, data, "the size map").map((r) => ({ label: r.label, wearer: r.wearer, cut: r.cut, patternSize: r.pattern_size, source: r.source }));
}

/** Saves a brand's choice of pattern size for one label. Only a label the shipped map knows can be chosen. */
export async function saveSizeMap(admin: SupabaseClient, who: Who, entry: SizeMapEntry): Promise<void> {
  const known = DEFAULT_SIZE_LABEL_MAPS.some((m) => sizeMapKey(m) === sizeMapKey(entry));
  if (!known) throw new AppError("invalid_input", "That size label is not in the size runs. Choose one from the list.");
  const { error } = await admin.from("size_label_maps").upsert(
    {
      brand_id: who.brandId,
      label: entry.label,
      wearer: entry.wearer,
      cut: entry.cut,
      pattern_size: entry.patternSize,
      source: entry.source,
      updated_by: who.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "brand_id,wearer,cut,label" },
  );
  failIf(error, "The size map could not be saved.");
}

/** Goes back to the suggested pattern size for one label. */
export async function resetSizeMap(admin: SupabaseClient, who: Who, entry: Pick<SizeMapEntry, "label" | "wearer" | "cut">): Promise<void> {
  const { error } = await admin
    .from("size_label_maps")
    .delete()
    .eq("brand_id", who.brandId)
    .eq("label", entry.label)
    .eq("wearer", entry.wearer)
    .eq("cut", entry.cut);
  failIf(error, "The size map could not be reset.");
}
