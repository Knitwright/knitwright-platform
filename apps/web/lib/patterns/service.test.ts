import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { writeDxf } from "@/lib/pattern-library/dxf/write";
import { MEN_RUN, syntheticPieces } from "@/lib/pattern-library/fixtures/synthetic-set";
import { buildSet } from "@/lib/pattern-library/set";

vi.mock("@/lib/storage/store", () => ({ storePatternFiles: vi.fn(), storeProductionFile: vi.fn(async () => ({ id: "00000000-0000-4000-8000-000000000009" })) }));

const { completePatternSetJob, createPatternJob } = await import("./service");

const JOB = "11111111-1111-4111-8111-111111111111";
const open = (kind: "single" | "size-set") => ({
  id: JOB, brand_id: "22222222-2222-4222-8222-222222222222", project_id: "33333333-3333-4333-8333-333333333333", version: 2, status: "queued",
  request: { typeId: "crew-tee", wearer: "men", garment: "Crew neck tee" }, size_label: "M", kind, created_by: "44444444-4444-4444-8444-444444444444", created_at: "2026-10-15T00:00:00Z",
});

/** A client for the one job: reads give the job, updates record what was changed and say whether the job moved. */
function fake(kind: "single" | "size-set", moved = true) {
  const updates: Record<string, unknown>[] = [];
  const inserts: Record<string, unknown>[] = [];
  const rpcs: Record<string, unknown>[] = [];
  const client = {
    from() {
      const builder: Record<string, unknown> = {};
      let mode: "read" | "update" | "insert" = "read";
      for (const m of ["select", "eq", "in", "limit", "order"]) builder[m] = () => builder;
      builder.update = (change: Record<string, unknown>) => { mode = "update"; updates.push(change); return builder; };
      builder.insert = (row: Record<string, unknown>) => { mode = "insert"; inserts.push(row); return builder; };
      builder.maybeSingle = async () => ({ data: open(kind), error: null });
      builder.single = async () => ({ data: { id: JOB }, error: null });
      builder.then = (resolve: (r: unknown) => unknown) => Promise.resolve({ data: mode === "update" ? (moved ? [{ id: JOB }] : []) : [], error: null }).then(resolve);
      return builder;
    },
    async rpc(_name: string, args: Record<string, unknown>) {
      rpcs.push(args);
      return { data: [{ block_id: "55555555-5555-4555-8555-555555555555", block_version: 4 }], error: null };
    },
  };
  return { client: client as unknown as SupabaseClient, updates, inserts, rpcs };
}

const built = () => {
  const r = buildSet({ files: MEN_RUN.slice(0, 2).map((s) => ({ name: `${s}.dxf`, text: writeDxf(syntheticPieces(s), { styleName: "t" }) })), outline: "net" });
  if (!r.ok) throw new Error(r.reasons.join());
  return r;
};

describe("completePatternSetJob", () => {
  it("stores the block for the job's product and marks the job done with the block and its set file", async () => {
    const { client, updates, rpcs } = fake("size-set");
    const made = await completePatternSetJob(client, JOB, { set: built(), draft: "men_knit_tee" });
    expect(made).toEqual({ blockId: "55555555-5555-4555-8555-555555555555", version: 4 });
    expect(rpcs[0]).toMatchObject({ p_product_key: "crew-tee", p_wearer: "men", p_cut: "mens", p_name: "Crew neck tee", p_source: "fashioninsta-bridge" });
    expect(updates[0]).toMatchObject({ status: "succeeded", draft: "men_knit_tee", pieces: 4, block_id: "55555555-5555-4555-8555-555555555555", dxf_file_id: "00000000-0000-4000-8000-000000000009" });
    expect((updates[0].notes as string[]).some((n) => n.includes("notches added"))).toBe(true);
  });

  it("refuses a job that asked for one size, and a job given up in the meantime", async () => {
    await expect(completePatternSetJob(fake("single").client, JOB, { set: built(), draft: "x" })).rejects.toThrow("asks for one size");
    await expect(completePatternSetJob(fake("size-set", false).client, JOB, { set: built(), draft: "x" })).rejects.toThrow("given up");
  });
});

describe("createPatternJob", () => {
  it("records whether the job is for one size or a size run", async () => {
    const { client, inserts } = fake("single");
    const request = { typeId: "crew-tee", garment: "Crew neck tee", family: "tops", wearer: "men", size: "M", sizing: null, options: [], measurements: [] };
    await createPatternJob(client, { brandId: "b", projectId: "p", version: 1, userId: "u", provider: "claude-bridge", request });
    await createPatternJob(client, { brandId: "b", projectId: "p", version: 1, userId: "u", provider: "claude-bridge", request, kind: "size-set" });
    expect(inserts.map((i) => i.kind)).toEqual(["single", "size-set"]);
  });
});
