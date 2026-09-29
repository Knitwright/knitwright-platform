import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * The record of downloads. Its rows are written by one function that only the server's own key
 * may run, and they are never changed or removed. Plan step 9, task 4, and criterion M5.
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
      p_name: "Home shirt",
      p_style_number: "HS-01",
      p_season: "",
      p_garment_type: "crew-tee",
      p_spec: { made: "for the test" },
      p_schema_version: 1,
    }),
  ) as string;

const record = (projectId: string, user: Person, patch: Record<string, unknown> = {}) =>
  adminClient().rpc("record_export_download", {
    p_project_id: projectId,
    p_user_id: user.userId,
    p_spec_version: 1,
    p_format: "pdf",
    p_view: null,
    ...patch,
  });

const rowsOf = async (projectId: string) =>
  must(await adminClient().from("export_downloads").select("*").eq("project_id", projectId).order("created_at"));

beforeAll(async () => {
  [alice, bob] = await Promise.all([person("dl-alice"), person("dl-bob")]);
  aliceBrand = await brandOf(alice, "Alice Athletic");
  bobBrand = await brandOf(bob, "Bob's Boots");
});

describe("record_export_download", () => {
  it("records the design, the brand, the version, the format, the view and the user", async () => {
    const id = await project(aliceBrand, alice);

    must(await record(id, alice));
    must(await record(id, alice, { p_format: "svg", p_view: "front" }));
    must(await record(id, alice, { p_format: "xlsx" }));

    const rows = await rowsOf(id);
    expect(rows).toHaveLength(3);
    expect(rows).toMatchObject([
      { brand_id: aliceBrand, project_id: id, spec_version: 1, format: "pdf", view: null, user_id: alice.userId },
      { brand_id: aliceBrand, project_id: id, spec_version: 1, format: "svg", view: "front", user_id: alice.userId },
      { brand_id: aliceBrand, project_id: id, spec_version: 1, format: "xlsx", view: null, user_id: alice.userId },
    ]);
    expect(rows.every((row) => typeof row.created_at === "string")).toBe(true);
  });

  it("records the version that was asked for, when the design has more than one", async () => {
    const id = await project(aliceBrand, alice);
    must(
      await adminClient().rpc("append_spec_version", {
        p_project_id: id,
        p_user_id: alice.userId,
        p_expected_version: 1,
        p_spec: { made: "again" },
        p_schema_version: 1,
        p_note: "Second.",
        p_restored_from: null,
      }),
    );

    must(await record(id, alice, { p_spec_version: 2 }));

    expect((await rowsOf(id)).map((row) => row.spec_version)).toEqual([2]);
  });

  it("refuses a user who does not belong to the design's brand, and records nothing", async () => {
    const id = await project(aliceBrand, alice);

    const { error } = await record(id, bob);

    expect(error?.code).toBe("P0002");
    expect(await rowsOf(id)).toEqual([]);
  });

  it("gives the same answer for a design that does not exist", async () => {
    const { error } = await record(randomUUID(), alice);

    expect(error?.code).toBe("P0002");
  });

  it("refuses a version the design does not have", async () => {
    const id = await project(aliceBrand, alice);

    expect((await record(id, alice, { p_spec_version: 2 })).error?.code).toBe("P0002");
    expect((await record(id, alice, { p_spec_version: 0 })).error).not.toBeNull();
    expect(await rowsOf(id)).toEqual([]);
  });

  it("refuses a format it does not know, an SVG with no view, and a view on any other format", async () => {
    const id = await project(aliceBrand, alice);

    expect((await record(id, alice, { p_format: "docx" })).error).not.toBeNull();
    expect((await record(id, alice, { p_format: "svg", p_view: null })).error).not.toBeNull();
    expect((await record(id, alice, { p_format: "pdf", p_view: "front" })).error).not.toBeNull();
    expect((await record(id, alice, { p_format: "svg", p_view: "side" })).error).not.toBeNull();
    expect(await rowsOf(id)).toEqual([]);
  });

  it("cannot be run by a browser, signed in or not", async () => {
    const id = await project(aliceBrand, alice);
    const args = { p_project_id: id, p_user_id: alice.userId, p_spec_version: 1, p_format: "pdf", p_view: null };

    expect((await alice.client.rpc("record_export_download", args)).error).not.toBeNull();
    expect((await anonClient().rpc("record_export_download", args)).error).not.toBeNull();
    expect(await rowsOf(id)).toEqual([]);
  });
});

describe("what a member may see", () => {
  it("shows a member the downloads of their own brand and none of another", async () => {
    const mine = await project(aliceBrand, alice);
    const theirs = await project(bobBrand, bob);
    must(await record(mine, alice));
    must(await record(theirs, bob));

    const seen = must(await alice.client.from("export_downloads").select("project_id"));

    expect(seen.map((row) => row.project_id)).toContain(mine);
    expect(seen.map((row) => row.project_id)).not.toContain(theirs);
  });
});

describe("the record cannot be changed", () => {
  it("lets the server's own key update or delete nothing, and insert nothing directly", async () => {
    const id = await project(aliceBrand, alice);
    must(await record(id, alice));
    const admin = adminClient();

    expect((await admin.from("export_downloads").update({ format: "xlsx" }).eq("project_id", id)).error).not.toBeNull();
    expect((await admin.from("export_downloads").delete().eq("project_id", id)).error).not.toBeNull();
    expect(
      (
        await admin
          .from("export_downloads")
          .insert({ brand_id: aliceBrand, project_id: id, spec_version: 1, format: "pdf", user_id: alice.userId })
      ).error,
    ).not.toBeNull();
    expect(await rowsOf(id)).toHaveLength(1);
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
      `begin; update public.export_downloads set format = 'xlsx' where project_id = '${id}'; rollback;`,
      `begin; delete from public.export_downloads where project_id = '${id}'; rollback;`,
      "begin; truncate public.export_downloads; rollback;",
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

    const result = psql(`begin; delete from public.projects where id = '${id}'; select count(*) from public.export_downloads where project_id = '${id}'; rollback;`);

    expect(result.ok).toBe(true);
    expect(result.output).toMatch(/^0$/m);
    expect(await rowsOf(id)).toHaveLength(1);
  });
});
