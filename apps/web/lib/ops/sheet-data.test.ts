import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import type { StoredRelease } from "@/lib/releases/service";
import { ROSTER_3, SAMPLE_BATCH } from "./factory-sheet/fixtures";
import { releaseFilesOf, loadBatchSources, sheetInputOf, type SourceDeps } from "./sheet-data";
import { DEFAULT_OPS_SETTINGS } from "./settings";

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const orderRow = (n: number, over: Record<string, unknown> = {}) => ({
  id: ID(n), release_id: ID(900 + n), brand_id: ID(800), project_id: ID(700), external_ref: `S-${n}`, factory_profile_id: "f1", fabric_key: "mesh", article_id: "team-jersey",
  sizes: { M: 2 }, pieces: 2, value_minor: null, currency: null, release_snapshot: { label: "R", number: 1 }, status: "batched", batch_id: ID(100),
  cutoff_at: "2026-10-23T17:00:00+00:00", lead_time_days: null, promised_on: null, created_at: "2026-10-21T09:00:00+00:00", ...over,
});

const admin = (brands: unknown[]) => {
  const chain = (rows: unknown[]) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "order", "limit"]) q[m] = () => q;
    q.maybeSingle = async () => ({ data: rows[0] ?? null, error: null });
    q.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null });
    return q;
  };
  const tables: Record<string, unknown[]> = {
    batches: [{ id: ID(100), factory_profile_id: "knitwright-default", fabric_key: "mesh-140", article_id: "team-jersey", cutoff_at: "2026-10-23T17:00:00+00:00" }],
    ops_orders: [orderRow(1), orderRow(2)],
    brands,
  };
  return { from: (t: string) => chain(tables[t] ?? []) } as never;
};

const release = (orderId: string | null): StoredRelease => ({
  id: ID(901), number: 1, label: "R", createdAt: "2026-10-20T00:00:00Z", orderId, fileSpecs: [{ pieceId: "front" } as never],
  snapshot: { specVersion: 1, patternBlockId: "blk", patternBlockVersion: 3, fabricTestIds: [], printProfile: {} as never, rosterHash: null, files: [{ path: "print/front-M.pdf", sha256: "a".repeat(64) }] },
});

describe("loadBatchSources", () => {
  const deps = (orderId: string | null, failWith?: unknown): SourceDeps => ({
    getRelease: async () => release(orderId),
    getTeamOrder: async () => {
      if (failWith) throw failWith;
      return { rows: ROSTER_3 };
    },
  });
  const brands = [{ id: ID(800), name: "Bayside FC" }];

  it("reads each order with its brand name, release and team list", async () => {
    const { batch, sources } = await loadBatchSources(admin(brands), ID(100), deps(ID(500)));
    expect(batch.id).toBe(ID(100));
    expect(sources).toHaveLength(2);
    expect(sources[0]).toMatchObject({ brandName: "Bayside FC", roster: ROSTER_3 });
  });

  it("has no team list for a release made without one", async () => {
    expect((await loadBatchSources(admin(brands), ID(100), deps(null))).sources[0]?.roster).toBeNull();
  });

  it("treats an erased team list as missing, but passes other failures on", async () => {
    expect((await loadBatchSources(admin(brands), ID(100), deps(ID(500), new AppError("not_found", "gone")))).sources[0]?.roster).toBeNull();
    await expect(loadBatchSources(admin(brands), ID(100), deps(ID(500), new AppError("internal", "boom")))).rejects.toMatchObject({ code: "internal" });
  });

  it("names a brand it cannot find rather than failing the sheet", async () => {
    expect((await loadBatchSources(admin([]), ID(100), deps(null))).sources[0]?.brandName).toBe("Unknown brand");
  });
});

describe("sheetInputOf and releaseFilesOf", () => {
  it("shapes the sources for the sheet and the zip", async () => {
    const { sources } = await loadBatchSources(admin([{ id: ID(800), name: "Bayside FC" }]), ID(100), { getRelease: async () => release(ID(500)), getTeamOrder: async () => ({ rows: ROSTER_3 }) });
    expect(sheetInputOf(SAMPLE_BATCH, sources, DEFAULT_OPS_SETTINGS).orders[0]).toMatchObject({ brandName: "Bayside FC", roster: ROSTER_3 });
    const made: unknown[] = [];
    const files = releaseFilesOf(sources, (brandId) => (context) => (made.push([brandId, context.patternBlockId, context.patternBlockVersion, context.projectId]), { build: async () => { throw new Error("not called"); } }));
    expect(made[0]).toEqual([ID(800), "blk", 3, ID(700)]);
    expect(files[0]).toMatchObject({ orderRef: "S-1", roster: ROSTER_3 });
    expect(files[0]?.frozen.get("print/front-M.pdf")).toBe("a".repeat(64));
  });
});
