import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { storeProductionFile } from "@/lib/storage/store";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * Migration 20261015010000: the pattern library. Blocks are numbered in turn, stored with all
 * of their sizes or not at all, read by the brand's members, and never changed or removed. Rows
 * of other brands are covered by isolation.test.ts.
 */

let alice: Person;
let bob: Person;
let aliceBrand: string;

const sizeRows = (sizes: string[]) =>
  sizes.map((size, position) => ({ size, position, pieces: [{ id: "front" }], measurements: [], skipped: [], checks: [] }));

const create = async (key: string, sizes: string[] = ["S", "M"], overrides: Record<string, unknown> = {}) =>
  adminClient().rpc("create_pattern_block", {
    p_brand_id: aliceBrand, p_user_id: alice.userId, p_product_key: key, p_wearer: "men", p_cut: "mens", p_name: "Crew tee", p_kind: "pieces",
    p_source: "technician-upload", p_sizes: sizes, p_overrides: {}, p_derived: ["Notches added."], p_warnings: [], p_questions: [],
    p_size_map: null, p_programme_note: null, p_set_file: null, p_size_rows: sizeRows(sizes), ...overrides,
  });

beforeAll(async () => {
  [alice, bob] = await Promise.all([person("lib-alice"), person("lib-bob")]);
  aliceBrand = await brandOf(alice, "Alice Athletic");
});

describe("create_pattern_block", () => {
  it("numbers versions of one product, wearer and cut in turn, and starts again for another product", async () => {
    const [first] = must(await create("tee-a")) as { block_id: string; block_version: number }[];
    const [second] = must(await create("tee-a")) as { block_id: string; block_version: number }[];
    const [other] = must(await create("tee-b")) as { block_id: string; block_version: number }[];
    expect([first.block_version, second.block_version, other.block_version]).toEqual([1, 2, 1]);
  });

  it("stores every size with the block, which its brand's members can read", async () => {
    const [made] = must(await create("tee-c", ["S", "M", "L"])) as { block_id: string }[];
    const seen = must(await alice.client.from("pattern_block_sizes").select("size_label, position").eq("block_id", made.block_id).order("position"));
    expect(seen.map((row) => row.size_label)).toEqual(["S", "M", "L"]);
    expect(must(await bob.client.from("pattern_blocks").select("id").eq("id", made.block_id))).toEqual([]);
  });

  it("stores nothing when a size is bad", async () => {
    const before = must(await adminClient().from("pattern_blocks").select("id").eq("product_key", "tee-d"));
    const { error } = await create("tee-d", ["S", "S"]);
    expect(error).not.toBeNull();
    expect(must(await adminClient().from("pattern_blocks").select("id").eq("product_key", "tee-d"))).toEqual(before);
  });

  it("stores a knit programme with a size map and no pieces, and refuses one with pieces", async () => {
    const programme = await create("socks", [], { p_kind: "knit-programme", p_size_map: { M: "42-45" }, p_programme_note: "Stoll file", p_size_rows: [] });
    expect(programme.error).toBeNull();
    const bad = await create("socks", ["M"], { p_kind: "knit-programme", p_size_map: { M: "42-45" } });
    expect(bad.error).not.toBeNull();
  });

  it("refuses someone who is not in the brand, and a browser", async () => {
    const stranger = await create("tee-e", ["M"], { p_user_id: bob.userId });
    expect(stranger.error).not.toBeNull();
    const browser = await alice.client.rpc("create_pattern_block", { p_brand_id: aliceBrand });
    expect(browser.error).not.toBeNull();
  });
});

describe("review_pattern_block", () => {
  it("records a named review that the brand's members read", async () => {
    const [made] = must(await create("tee-f")) as { block_id: string }[];
    must(await adminClient().rpc("review_pattern_block", { p_brand_id: aliceBrand, p_user_id: alice.userId, p_block_id: made.block_id, p_name: " A. Tailor ", p_role: "", p_note: "Looks right.", p_on: "2026-10-20" }));
    const [row] = must(await alice.client.from("pattern_reviews").select("reviewer_name, reviewer_role, reviewed_on").eq("block_id", made.block_id));
    expect(row).toEqual({ reviewer_name: "A. Tailor", reviewer_role: "technician", reviewed_on: "2026-10-20" });
  });

  it("refuses a block of another brand and a person outside the brand", async () => {
    const [made] = must(await create("tee-g")) as { block_id: string }[];
    const bobBrand = await brandOf(bob, "Bob's Boots");
    const wrongBrand = await adminClient().rpc("review_pattern_block", { p_brand_id: bobBrand, p_user_id: bob.userId, p_block_id: made.block_id, p_name: "B", p_role: "", p_note: "", p_on: "2026-10-20" });
    expect(wrongBrand.error).not.toBeNull();
    const outsider = await adminClient().rpc("review_pattern_block", { p_brand_id: aliceBrand, p_user_id: bob.userId, p_block_id: made.block_id, p_name: "B", p_role: "", p_note: "", p_on: "2026-10-20" });
    expect(outsider.error).not.toBeNull();
  });
});

describe("the history", () => {
  it("can never be changed or removed, even by the server", async () => {
    const [made] = must(await create("tee-h")) as { block_id: string }[];
    const review = must(await adminClient().rpc("review_pattern_block", { p_brand_id: aliceBrand, p_user_id: alice.userId, p_block_id: made.block_id, p_name: "A", p_role: "", p_note: "", p_on: "2026-10-20" })) as string;
    const admin = adminClient();
    for (const attempt of [
      admin.from("pattern_blocks").update({ name: "Changed" }).eq("id", made.block_id),
      admin.from("pattern_blocks").delete().eq("id", made.block_id),
      admin.from("pattern_block_sizes").update({ size_label: "XL" }).eq("block_id", made.block_id),
      admin.from("pattern_block_sizes").delete().eq("block_id", made.block_id),
      admin.from("pattern_reviews").update({ reviewer_name: "Changed" }).eq("id", review),
      admin.from("pattern_reviews").delete().eq("id", review),
    ]) {
      const { error } = await attempt;
      expect(error?.message).toMatch(/can never be changed or removed|permission denied/);
    }
    expect(must(await admin.from("pattern_blocks").select("name").eq("id", made.block_id))[0].name).toBe("Crew tee");
  });

  it("lets a stored file be removed, which only empties the file column", async () => {
    const stored = await storeProductionFile("pattern-source", { admin: adminClient(), brandId: aliceBrand, userId: alice.userId, bytes: new TextEncoder().encode("0\nSECTION\n2\nHEADER\n"), contentType: "application/dxf" });
    const [made] = must(await create("tee-i", ["M"], { p_set_file: stored.id })) as { block_id: string }[];
    const removal = await adminClient().from("files").delete().eq("id", stored.id);
    expect(removal.error).toBeNull();
    expect(must(await adminClient().from("pattern_blocks").select("set_dxf_file_id, name").eq("id", made.block_id))[0]).toEqual({ set_dxf_file_id: null, name: "Crew tee" });
  });
});

describe("pattern jobs for a size run", () => {
  it("default to one size, accept a size run, and refuse another kind", async () => {
    const admin = adminClient();
    const projectId = must(await admin.rpc("create_project", { p_brand_id: aliceBrand, p_user_id: alice.userId, p_name: "Home shirt", p_style_number: "", p_season: "", p_garment_type: "crew-tee", p_spec: { made: "for the test" }, p_schema_version: 1 })) as string;
    const row = { brand_id: aliceBrand, project_id: projectId, version: 1, provider: "claude-bridge", request: { typeId: "crew-tee" }, size_label: "M", created_by: alice.userId };
    expect(must(await admin.from("pattern_jobs").insert(row).select("kind").single()).kind).toBe("single");
    expect(must(await admin.from("pattern_jobs").insert({ ...row, kind: "size-set" }).select("kind").single()).kind).toBe("size-set");
    expect((await admin.from("pattern_jobs").insert({ ...row, kind: "nope" })).error).not.toBeNull();
    expect((await admin.from("pattern_jobs").insert({ ...row, block_id: randomUUID() })).error).not.toBeNull();
  });
});
