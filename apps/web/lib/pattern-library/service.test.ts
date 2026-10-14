import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { writeDxf } from "./dxf/write";
import { MEN_RUN, syntheticPieces } from "./fixtures/synthetic-set";
import { buildSet, type PatternSet } from "./set";

const stored: { kind: string; text: string }[] = [];
vi.mock("@/lib/storage/store", () => ({
  storeProductionFile: vi.fn(async (kind: string, input: { bytes: Uint8Array }) => {
    stored.push({ kind, text: new TextDecoder().decode(input.bytes) });
    return { id: `00000000-0000-4000-8000-${String(stored.length).padStart(12, "0")}` };
  }),
}));

const { blockDxf, createBlock, createProgramme, getBlock, listBlocks, recordReview } = await import("./service");

type Result = { data: unknown; error: { message: string } | null };

/** A client that answers each table with the rows it is given, whatever the filters, and records the calls. */
function fake(tables: Record<string, unknown[]>, rpcResult: Result = { data: null, error: null }, failTable?: string) {
  const calls: { table: string; filters: unknown[][] }[] = [];
  const rpcs: { name: string; args: Record<string, unknown> }[] = [];
  const client = {
    from(table: string) {
      const call = { table, filters: [] as unknown[][] };
      calls.push(call);
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "order", "limit", "range"]) builder[method] = (...args: unknown[]) => { call.filters.push([method, ...args]); return builder; };
      const answer = (): Result => {
        if (table === failTable) return { data: null, error: { message: "boom" } };
        const range = call.filters.find((f) => f[0] === "range");
        const rows = tables[table] ?? [];
        const limit = call.filters.find((f) => f[0] === "limit");
        if (range) return { data: rows.slice(range[1] as number, (range[2] as number) + 1), error: null };
        return { data: limit ? rows.slice(0, limit[1] as number) : rows, error: null };
      };
      builder.maybeSingle = async () => ({ ...answer(), data: (answer().data as unknown[] | null)?.[0] ?? null });
      builder.then = (resolve: (r: Result) => unknown) => Promise.resolve(answer()).then(resolve);
      return builder;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      rpcs.push({ name, args });
      return rpcResult;
    },
  };
  return { client: client as unknown as SupabaseClient, calls, rpcs };
}

const BLOCK = "11111111-1111-4111-8111-111111111111";
const blockRow = {
  id: BLOCK, product_key: "crew-tee", wearer: "men", cut: "mens", name: "Crew tee", kind: "pieces", version: 2, source: "technician-upload",
  sizes: ["M"], derived: [], warnings: [], questions: [], size_map: null, programme_note: null, landmark_overrides: {}, created_at: "2026-10-15T00:00:00Z",
};
const reviewRow = (id: string, name: string) => ({ id, block_id: BLOCK, reviewer_name: name, reviewer_role: "technician", note: "", reviewed_on: "2026-10-20" });

const set = (): PatternSet => {
  const result = buildSet({ files: MEN_RUN.slice(0, 2).map((s) => ({ name: `${s}.dxf`, text: writeDxf(syntheticPieces(s), { styleName: "t" }) })), outline: "net" });
  if (!result.ok) throw new Error(result.reasons.join());
  return result;
};

describe("listBlocks", () => {
  it("gives each block its latest review and says draft when it has none", async () => {
    const other = { ...blockRow, id: "22222222-2222-4222-8222-222222222222", product_key: "polo" };
    const { client } = fake({
      pattern_blocks: [blockRow, other],
      pattern_reviews: [reviewRow("33333333-3333-4333-8333-333333333333", "Newest"), reviewRow("44444444-4444-4444-8444-444444444444", "Older")],
    });
    const blocks = await listBlocks(client, "brand");
    expect(blocks.map((b) => [b.productKey, b.state, b.review?.reviewerName ?? null])).toEqual([["crew-tee", "reviewed", "Newest"], ["polo", "draft", null]]);
    expect(blocks[0].sources).toBe("Uploaded by a technician");
  });

  it("reads every page of reviews, so a block whose review is far back is still reviewed", async () => {
    const filler = Array.from({ length: 1200 }, (_, at) => ({ ...reviewRow(`00000000-0000-4000-8000-${String(at).padStart(12, "0")}`, "Filler"), block_id: "99999999-9999-4999-8999-999999999999" }));
    const far = reviewRow("55555555-5555-4555-8555-555555555555", "Far back");
    const { client } = fake({ pattern_blocks: [blockRow], pattern_reviews: [...filler, far] });
    const [block] = await listBlocks(client, "brand");
    expect(block.review?.reviewerName).toBe("Far back");
    expect(block.state).toBe("reviewed");
  });

  it("says plainly when the library cannot be read", async () => {
    await expect(listBlocks(fake({}, undefined, "pattern_blocks").client, "b")).rejects.toThrow("The pattern library could not be read.");
    await expect(listBlocks(fake({ pattern_blocks: [] }, undefined, "pattern_reviews").client, "b")).rejects.toThrow("reviews could not be read");
  });
});

describe("getBlock", () => {
  it("is null for a block the brand does not have", async () => {
    expect(await getBlock(fake({ pattern_blocks: [] }).client, "b", BLOCK)).toBeNull();
  });

  it("returns the block with its sizes and reviews", async () => {
    const s = set();
    const { client } = fake({
      pattern_blocks: [blockRow],
      pattern_block_sizes: [{ size_label: "XS", position: 0, pieces: s.piecesBySize.XS, measurements: s.measurementsBySize.XS, skipped: [{ pointId: "placket-length", reason: "No placket." }], checks: s.checks.filter((c) => c.size === "XS"), dxf_file_id: null }],
      pattern_reviews: [reviewRow("33333333-3333-4333-8333-333333333333", "A. Tailor")],
    });
    const detail = await getBlock(client, "b", BLOCK);
    expect(detail?.sizes[0].pieces).toHaveLength(4);
    expect(detail?.sizes[0].measurements.length).toBeGreaterThan(15);
    expect(detail?.block.state).toBe("reviewed");
    expect(detail?.reviews).toHaveLength(1);
  });

  it("reports a failed read of the sizes or the reviews", async () => {
    await expect(getBlock(fake({ pattern_blocks: [blockRow] }, undefined, "pattern_block_sizes").client, "b", BLOCK)).rejects.toThrow("sizes of the pattern");
    await expect(getBlock(fake({ pattern_blocks: [blockRow] }, undefined, "pattern_reviews").client, "b", BLOCK)).rejects.toThrow("reviews could not");
    await expect(getBlock(fake({}, undefined, "pattern_blocks").client, "b", BLOCK)).rejects.toThrow("could not be read");
  });
});

describe("createBlock", () => {
  const input = { brandId: "b", userId: "u", productKey: "crew-tee", wearer: "men", cut: "mens", name: "Crew tee", source: "technician-upload", overrides: {} } as const;

  it("stores the DXF of every size and of all, then the record in one call", async () => {
    stored.length = 0;
    const { client, rpcs } = fake({}, { data: [{ block_id: BLOCK, block_version: 3 }], error: null });
    const made = await createBlock(client, { ...input, set: set() });
    expect(made).toMatchObject({ id: BLOCK, version: 3 });
    expect(made.setFileId).toMatch(/^00000000-0000-4000-8000-/);
    expect(stored).toHaveLength(3);
    expect(stored.every((f) => f.kind === "pattern-source" && f.text.includes("STATUS: Draft pattern, not reviewed."))).toBe(true);
    const args = rpcs[0].args;
    expect(rpcs[0].name).toBe("create_pattern_block");
    expect(args.p_kind).toBe("pieces");
    expect(args.p_sizes).toEqual(["XS", "S"]);
    expect((args.p_size_rows as { size: string; position: number; dxfFileId: string }[]).map((r) => [r.size, r.position])).toEqual([["XS", 0], ["S", 1]]);
  });

  it("fails with a sentence when the database refuses", async () => {
    const { client } = fake({}, { data: null, error: { message: "nope" } });
    await expect(createBlock(client, { ...input, set: set() })).rejects.toThrow("The pattern could not be stored.");
  });
});

describe("createProgramme", () => {
  it("stores a size map and no pieces", async () => {
    const { client, rpcs } = fake({}, { data: [{ block_id: BLOCK, block_version: 1 }], error: null });
    await createProgramme(client, { brandId: "b", userId: "u", productKey: "socks", wearer: "men", cut: "unisex", name: "Crew socks", source: "technician-upload", sizeMap: { M: "42-45" }, note: "Stoll file from the factory" });
    expect(rpcs[0].args).toMatchObject({ p_kind: "knit-programme", p_sizes: [], p_size_rows: [], p_size_map: { M: "42-45" } });
    await expect(createProgramme(fake({}, { data: null, error: { message: "x" } }).client, { brandId: "b", userId: "u", productKey: "socks", wearer: "men", cut: "unisex", name: "n", source: "technician-upload", sizeMap: {}, note: "" })).rejects.toThrow("knit programme");
  });
});

describe("recordReview", () => {
  it("records the review through the database function", async () => {
    const id = "55555555-5555-4555-8555-555555555555";
    const { client, rpcs } = fake({}, { data: id, error: null });
    expect(await recordReview(client, { brandId: "b", userId: "u", blockId: BLOCK }, { reviewerName: "A. Tailor", reviewerRole: "technician", note: "", reviewedOn: "2026-10-20" })).toBe(id);
    expect(rpcs[0].args).toMatchObject({ p_name: "A. Tailor", p_on: "2026-10-20" });
    await expect(recordReview(fake({}, { data: null, error: { message: "x" } }).client, { brandId: "b", userId: "u", blockId: BLOCK }, { reviewerName: "A", reviewerRole: "t", note: "", reviewedOn: "2026-10-20" })).rejects.toThrow("review could not");
  });
});

describe("blockDxf", () => {
  const s = set();
  const sizes = ["XS", "S"].map((size, position) => ({ size_label: size, position, pieces: s.piecesBySize[size], measurements: [], skipped: [], checks: [], dxf_file_id: null }));

  it("builds the file now, carrying the draft notice or the latest review", async () => {
    const draft = await blockDxf(fake({ pattern_blocks: [blockRow], pattern_block_sizes: sizes }).client, "b", BLOCK, "S");
    expect(draft?.text).toContain("STATUS: Draft pattern, not reviewed.");
    expect(draft?.name).toBe("crew-tee-v2-S.dxf");
    const reviewed = await blockDxf(fake({ pattern_blocks: [blockRow], pattern_block_sizes: sizes, pattern_reviews: [reviewRow("33333333-3333-4333-8333-333333333333", "A. Tailor")] }).client, "b", BLOCK, "all");
    expect(reviewed?.text).toContain("STATUS: Reviewed by A. Tailor (technician) on 2026-10-20.");
    expect(reviewed?.name).toBe("crew-tee-v2-all-sizes.dxf");
    expect(reviewed?.text.match(/^SIZE: XS$/gm)?.length).toBe(4);
  });

  it("is null for a missing block, a size it lacks, or a knit programme", async () => {
    expect(await blockDxf(fake({ pattern_blocks: [] }).client, "b", BLOCK, "S")).toBeNull();
    expect(await blockDxf(fake({ pattern_blocks: [blockRow], pattern_block_sizes: sizes }).client, "b", BLOCK, "XXL")).toBeNull();
    expect(await blockDxf(fake({ pattern_blocks: [{ ...blockRow, kind: "knit-programme", sizes: [], size_map: { M: "x" } }] }).client, "b", BLOCK, "all")).toBeNull();
  });
});
