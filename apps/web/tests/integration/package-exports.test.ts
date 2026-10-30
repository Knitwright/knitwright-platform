import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { CREDIT_SETTINGS } from "@/lib/credits/settings";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * Migration 20261101040000: the record of production package exports, and the `production_package`
 * credit kind (plan v5 X5b, decision 0070). It follows export_downloads exactly: one function that
 * only the server's own key may run, rows a member reads only for their own brand, and a row that
 * can never be changed or removed.
 */

let alice: Person;
let bob: Person;
let aliceBrand: string;
let bobBrand: string;

const project = async (brandId: string, owner: Person): Promise<string> =>
  must(
    await adminClient().rpc("create_project", {
      p_brand_id: brandId,
      p_user_id: owner.userId,
      p_name: "Home kit",
      p_style_number: "HK-01",
      p_season: "",
      p_garment_type: "crew-tee",
      p_spec: { made: "for the test" },
      p_schema_version: 1,
    }),
  ) as string;

const record = (projectId: string, user: Person, patch: Record<string, unknown> = {}) =>
  adminClient().rpc("record_package_export", {
    p_project_id: projectId,
    p_user_id: user.userId,
    p_spec_version: 1,
    p_design_code: "Home_Kit",
    p_root: "KPP_Home_Kit_v1_SKT-01",
    p_file_name: "KPP_Home_Kit_v1_SKT-01.zip",
    p_design_hash: "a".repeat(64),
    p_factory_code: "SKT-01",
    p_kind: "sample",
    p_generator_version: "kpp-1.0.0",
    p_zip_sha256: "b".repeat(64),
    p_zip_bytes: 204_800,
    p_file_count: 34,
    p_built_for: "2026-10-25T09:30:00Z",
    ...patch,
  });

const rowsOf = async (projectId: string) =>
  must(await adminClient().from("package_exports").select("*").eq("project_id", projectId).order("created_at"));

beforeAll(async () => {
  [alice, bob] = await Promise.all([person("pkg-alice"), person("pkg-bob")]);
  aliceBrand = await brandOf(alice, "Alice Packages");
  bobBrand = await brandOf(bob, "Bob Packages");
});

describe("record_package_export", () => {
  it("records the design, the brand, the version, the factory, the ZIP hash and the user", async () => {
    const id = await project(aliceBrand, alice);

    const rowId = must(await record(id, alice));

    expect(typeof rowId).toBe("string");
    expect(await rowsOf(id)).toMatchObject([
      {
        id: rowId,
        brand_id: aliceBrand,
        project_id: id,
        spec_version: 1,
        design_code: "Home_Kit",
        root: "KPP_Home_Kit_v1_SKT-01",
        factory_code: "SKT-01",
        kind: "sample",
        generator_version: "kpp-1.0.0",
        zip_sha256: "b".repeat(64),
        file_count: 34,
      },
    ]);
  });

  it("records a batch package beside a sample one for the same version", async () => {
    const id = await project(aliceBrand, alice);

    must(await record(id, alice));
    must(await record(id, alice, { p_kind: "batch", p_file_name: "KPP_Home_Kit_v1_SKT-01_batch.zip", p_zip_sha256: "c".repeat(64) }));

    expect((await rowsOf(id)).map((row) => row.kind).sort()).toEqual(["batch", "sample"]);
  });

  it("refuses a user who does not belong to the design's brand, and records nothing", async () => {
    const id = await project(aliceBrand, alice);

    expect((await record(id, bob)).error?.code).toBe("P0002");
    expect(await rowsOf(id)).toEqual([]);
  });

  it("gives the same answer for a design that does not exist", async () => {
    expect((await record(randomUUID(), alice)).error?.code).toBe("P0002");
  });

  it("refuses a version the design does not have", async () => {
    const id = await project(aliceBrand, alice);

    expect((await record(id, alice, { p_spec_version: 2 })).error?.code).toBe("P0002");
    expect(await rowsOf(id)).toEqual([]);
  });

  it("refuses a kind it does not know, a hash that is not a sha256, and an empty package", async () => {
    const id = await project(aliceBrand, alice);

    expect((await record(id, alice, { p_kind: "export" })).error).not.toBeNull();
    expect((await record(id, alice, { p_zip_sha256: "not-a-hash" })).error).not.toBeNull();
    expect((await record(id, alice, { p_zip_sha256: "B".repeat(64) })).error).not.toBeNull();
    expect((await record(id, alice, { p_file_count: 0 })).error).not.toBeNull();
    expect((await record(id, alice, { p_zip_bytes: 0 })).error).not.toBeNull();
    expect(await rowsOf(id)).toEqual([]);
  });

  it("cannot be run by a browser, signed in or not", async () => {
    const id = await project(aliceBrand, alice);
    const args = {
      p_project_id: id,
      p_user_id: alice.userId,
      p_spec_version: 1,
      p_design_code: "Home_Kit",
      p_root: "KPP_Home_Kit_v1_SKT-01",
      p_file_name: "KPP_Home_Kit_v1_SKT-01.zip",
      p_design_hash: "a".repeat(64),
      p_factory_code: "SKT-01",
      p_kind: "sample",
      p_generator_version: "kpp-1.0.0",
      p_zip_sha256: "b".repeat(64),
      p_zip_bytes: 1024,
      p_file_count: 3,
      p_built_for: "2026-10-25T09:30:00Z",
    };

    expect((await alice.client.rpc("record_package_export", args)).error).not.toBeNull();
    expect((await anonClient().rpc("record_package_export", args)).error).not.toBeNull();
    expect(await rowsOf(id)).toEqual([]);
  });
});

describe("what a member may see", () => {
  it("shows a member the exports of their own brand and none of another", async () => {
    const mine = await project(aliceBrand, alice);
    const theirs = await project(bobBrand, bob);
    must(await record(mine, alice));
    must(await record(theirs, bob));

    const seen = must(await alice.client.from("package_exports").select("project_id"));

    expect(seen.map((row) => row.project_id)).toContain(mine);
    expect(seen.map((row) => row.project_id)).not.toContain(theirs);
  });
});

describe("the record cannot be changed", () => {
  it("lets the server's own key update or delete nothing, and insert nothing directly", async () => {
    const id = await project(aliceBrand, alice);
    must(await record(id, alice));
    const admin = adminClient();

    expect((await admin.from("package_exports").update({ file_count: 1 }).eq("project_id", id)).error).not.toBeNull();
    expect((await admin.from("package_exports").delete().eq("project_id", id)).error).not.toBeNull();
    expect(
      (
        await admin.from("package_exports").insert({
          brand_id: aliceBrand,
          project_id: id,
          spec_version: 1,
          design_code: "Made_Directly",
          root: "KPP_Made_Directly_v1_X",
          file_name: "KPP_Made_Directly_v1_X.zip",
          design_hash: "d".repeat(64),
          factory_code: "X",
          kind: "sample",
          generator_version: "kpp-1.0.0",
          zip_sha256: "e".repeat(64),
          zip_bytes: 1,
          file_count: 1,
          built_for: "2026-10-25T09:30:00Z",
          user_id: alice.userId,
        })
      ).error,
    ).not.toBeNull();
    expect(await rowsOf(id)).toHaveLength(1);
  });
});

describe("the production_package credit kind", () => {
  it("is seeded in credit_prices as a placeholder, at the price lib/credits/settings.ts holds", async () => {
    const row = must(await adminClient().from("credit_prices").select("*").eq("output_kind", "production_package").single()) as Record<string, unknown>;

    expect(row.credits).toBe(CREDIT_SETTINGS.prices.production_package);
    expect(row.is_placeholder).toBe(true);
  });

  it("can be spent and shows up on the ledger, which the credit kind's constraint would otherwise refuse", async () => {
    const owner = await person(`pkg-spend-${randomUUID().slice(0, 8)}`);
    const brand = await brandOf(owner, "Package Spender");
    const versionHash = `h-${randomUUID()}`;
    must(await adminClient().rpc("credit_grant", { p_brand_id: brand, p_amount: 5, p_key: randomUUID(), p_note: "" }));

    const answer = must(
      await adminClient().rpc("credit_spend", { p_brand_id: brand, p_user_id: owner.userId, p_kind: "production_package", p_version_hash: versionHash }),
    ) as Record<string, unknown>;

    expect(answer).toMatchObject({ ok: true, charged: true });
    const ledger = must(await adminClient().from("credit_ledger").select("output_kind, kind").eq("brand_id", brand).order("seq"));
    expect(ledger.map((line) => line.output_kind)).toContain("production_package");
  });
});

const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_knitwright-platform";

const psql = (sql: string): { ok: boolean; output: string } => {
  try {
    const output = execFileSync("docker", ["exec", CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15_000,
    });
    return { ok: true, output };
  } catch (error) {
    const failure = error as { stderr?: string; message: string };
    return { ok: false, output: failure.stderr ?? failure.message };
  }
};

const dockerReachable = psql("select 1").ok;

describe.skipIf(!dockerReachable)("the record, as seen by the owner of the table", () => {
  const REFUSED = /can never be changed or removed/;

  it("refuses to update, delete or empty, inside transactions that are rolled back", async () => {
    const id = await project(aliceBrand, alice);
    must(await record(id, alice));

    for (const sql of [
      `begin; update public.package_exports set file_count = 1 where project_id = '${id}'; rollback;`,
      `begin; delete from public.package_exports where project_id = '${id}'; rollback;`,
      "begin; truncate public.package_exports; rollback;",
    ]) {
      const result = psql(sql);
      expect(result.ok, sql).toBe(false);
      expect(result.output, sql).toMatch(REFUSED);
    }
    expect(await rowsOf(id)).toHaveLength(1);
  });

  it("removes the records when their design is deleted", async () => {
    const id = await project(aliceBrand, alice);
    must(await record(id, alice));

    const result = psql(
      `begin; delete from public.projects where id = '${id}'; select count(*) from public.package_exports where project_id = '${id}'; rollback;`,
    );

    expect(result.ok).toBe(true);
    expect(result.output).toMatch(/^0$/m);
    expect(await rowsOf(id)).toHaveLength(1);
  });
});
