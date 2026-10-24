import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getTeamOrder, type StoredOrder } from "@/lib/orders/service";
import type { PrintFileBuilder, RosterRow } from "@/lib/production/contract";
import { getRelease, type StoredRelease } from "@/lib/releases/service";
import type { BuilderFor } from "@/lib/releases/use-cases";
import { AppError } from "@/lib/server/core/errors";
import { throwIfOpsFailed } from "./errors";
import type { SheetInput } from "./factory-sheet/model";
import type { ReleaseFiles } from "./factory-sheet/print-zip";
import type { Batch, OpsOrder } from "./rows";
import { loadBatch } from "./service";
import type { OpsSettings } from "./settings";

/** What a batch's files are made from: each order with its release and, when there is one, its team list. */
export interface BatchSource {
  readonly order: OpsOrder;
  readonly brandName: string;
  readonly release: StoredRelease;
  readonly roster: readonly RosterRow[] | null;
}

export interface SourceDeps {
  readonly getRelease: (client: SupabaseClient, brandId: string, projectId: string, releaseId: string) => Promise<StoredRelease>;
  readonly getTeamOrder: (client: SupabaseClient, brandId: string, projectId: string, orderId: string) => Promise<Pick<StoredOrder, "rows">>;
}

const REAL: SourceDeps = { getRelease, getTeamOrder };
const brandRow = z.object({ id: z.uuid(), name: z.string() });

/**
 * Reads a batch for its factory sheet and print files, with the server's own client because ops reads
 * across brands. A team list that was erased is a missing list (null), not a failure: the sheet says so.
 */
export async function loadBatchSources(admin: SupabaseClient, batchId: string, deps: SourceDeps = REAL): Promise<{ batch: Batch; sources: readonly BatchSource[] }> {
  const { batch, orders } = await loadBatch(admin, batchId);
  const ids = [...new Set(orders.map((o) => o.brandId))];
  const brands = await admin.from("brands").select("id, name").in("id", ids);
  throwIfOpsFailed(brands.error);
  const names = new Map(z.array(brandRow).parse(brands.data ?? []).map((b) => [b.id, b.name]));
  const sources: BatchSource[] = [];
  for (const order of orders) {
    const release = await deps.getRelease(admin, order.brandId, order.projectId, order.releaseId);
    sources.push({ order, brandName: names.get(order.brandId) ?? "Unknown brand", release, roster: await rosterOf(admin, order, release, deps) });
  }
  return { batch, sources };
}

async function rosterOf(admin: SupabaseClient, order: OpsOrder, release: StoredRelease, deps: SourceDeps): Promise<readonly RosterRow[] | null> {
  if (release.orderId === null) return null;
  try {
    return (await deps.getTeamOrder(admin, order.brandId, order.projectId, release.orderId)).rows;
  } catch (error) {
    if (error instanceof AppError && error.code === "not_found") return null;
    throw error;
  }
}

export const sheetInputOf = (batch: Batch, sources: readonly BatchSource[], settings: OpsSettings): SheetInput => ({
  batch,
  settings,
  orders: sources.map((s) => ({ order: s.order, brandName: s.brandName, roster: s.roster })),
});

/** The pieces of each release the print zip needs, with a builder made from the release's own settings. */
export const releaseFilesOf = (sources: readonly BatchSource[], builderFor: (brandId: string) => BuilderFor): readonly ReleaseFiles[] =>
  sources.map(({ order, release, roster }): ReleaseFiles => {
    const builder: PrintFileBuilder = builderFor(order.brandId)({
      projectId: order.projectId,
      roster,
      patternBlockId: release.snapshot.patternBlockId,
      patternBlockVersion: release.snapshot.patternBlockVersion,
    });
    return { orderRef: order.externalRef, specs: release.fileSpecs, frozen: new Map(release.snapshot.files.map((f) => [f.path, f.sha256])), roster, builder };
  });
