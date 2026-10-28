import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { productionFailure, throwIfFailed } from "@/lib/orders/errors";
import { printFileSpecSchema, releaseSnapshotSchema, type PrintFileSpec, type ReleaseSnapshot } from "@/lib/production/contract";
import { AppError } from "@/lib/server/core/errors";

export const RELEASE_NOT_FOUND = "That release does not exist.";
const DESIGN_NOT_FOUND = "That design does not exist.";

export interface ReleaseSummary {
  readonly id: string;
  readonly number: number;
  readonly label: string;
  readonly createdAt: string;
}

export interface StoredRelease extends ReleaseSummary {
  readonly snapshot: ReleaseSnapshot;
  readonly fileSpecs: readonly PrintFileSpec[];
  readonly orderId: string | null;
}

const summaryRow = z.object({ id: z.uuid(), number: z.number().int(), label: z.string(), created_at: z.string() });
const fullRow = summaryRow.extend({
  snapshot: releaseSnapshotSchema,
  file_specs: z.array(printFileSpecSchema),
  order_id: z.uuid().nullable(),
});

const summaryOf = (row: z.output<typeof summaryRow>): ReleaseSummary => ({ id: row.id, number: row.number, label: row.label, createdAt: row.created_at });

export async function listReleases(client: SupabaseClient, brandId: string, projectId: string): Promise<readonly ReleaseSummary[]> {
  const { data, error } = await client
    .from("production_releases")
    .select("id, number, label, created_at")
    .eq("brand_id", brandId)
    .eq("project_id", projectId)
    .order("number", { ascending: false })
    .limit(200);
  throwIfFailed(error, DESIGN_NOT_FOUND);
  return z.array(summaryRow).parse(data ?? []).map(summaryOf);
}

export async function getRelease(client: SupabaseClient, brandId: string, projectId: string, releaseId: string): Promise<StoredRelease> {
  const { data, error } = await client
    .from("production_releases")
    .select("id, number, label, created_at, snapshot, file_specs, order_id")
    .eq("id", releaseId)
    .eq("brand_id", brandId)
    .eq("project_id", projectId)
    .maybeSingle();
  throwIfFailed(error, RELEASE_NOT_FOUND);
  if (!data) throw new AppError("not_found", RELEASE_NOT_FOUND);
  const row = fullRow.parse(data);
  return { ...summaryOf(row), snapshot: row.snapshot, fileSpecs: row.file_specs, orderId: row.order_id };
}

type ReleaseToCreate = Readonly<{
  projectId: string;
  brandId: string;
  userId: string;
  label: string;
  snapshot: ReleaseSnapshot;
  fileSpecs: readonly PrintFileSpec[];
  orderId: string | null;
}>;

const createdRow = z.tuple([z.object({ id: z.uuid(), number: z.number().int() })]);

/** Freezes a release. The database numbers it and refuses any later change to it. */
export async function createRelease(admin: SupabaseClient, release: ReleaseToCreate): Promise<{ id: string; number: number }> {
  const { data, error } = await admin.rpc("create_release", {
    p_project_id: release.projectId,
    p_brand_id: release.brandId,
    p_user_id: release.userId,
    p_label: release.label,
    p_snapshot: release.snapshot,
    p_file_specs: release.fileSpecs,
    p_order_id: release.orderId,
  });
  if (error) throw productionFailure(error, DESIGN_NOT_FOUND);
  const [created] = createdRow.parse(data);
  return { id: created.id, number: created.number };
}
