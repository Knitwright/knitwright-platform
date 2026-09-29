import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { adminClient, brandOf, must, person } from "./support";

/**
 * The history of a design is protected twice. The grants stop every role a browser or the
 * server can use. A trigger stops the owner of the table too. The grants are tested through
 * the API elsewhere. This file connects as the owner, which the API cannot, by running
 * psql inside the local database container. It is skipped when Docker is not reachable.
 */

const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_knitwright-platform";

type Psql = Readonly<{ ok: boolean; output: string }>;

const psql = (sql: string): Psql => {
  try {
    const output = execFileSync(
      "docker",
      ["exec", CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15_000 },
    );
    return { ok: true, output };
  } catch (error) {
    const failure = error as { stderr?: string; message: string };
    return { ok: false, output: failure.stderr ?? failure.message };
  }
};

const dockerReachable = psql("select 1").ok;
if (!dockerReachable) {
  console.warn(`Skipping the owner-level append-only test: cannot reach the database container "${CONTAINER}" through Docker.`);
}

const REFUSED = /can never be changed or removed/;

describe.skipIf(!dockerReachable)("the history, as seen by the owner of the table", () => {
  const setup = async () => {
    const owner = await person("owner-level");
    const brand = await brandOf(owner, "Owner Level FC");
    const id = must(
      await adminClient().rpc("create_project", {
        p_brand_id: brand,
        p_user_id: owner.userId,
        p_name: "Design",
        p_style_number: "",
        p_season: "",
        p_garment_type: "crew-tee",
        p_spec: { made: "for the test" },
        p_schema_version: 1,
      }),
    ) as string;
    must(
      await adminClient().rpc("append_spec_version", {
        p_project_id: id,
        p_user_id: owner.userId,
        p_expected_version: 1,
        p_spec: { made: "again" },
        p_schema_version: 1,
        p_note: "Second.",
        p_restored_from: null,
      }),
    );
    return { brand, id };
  };

  it("refuses to update a version, inside a transaction that is rolled back", async () => {
    const { id } = await setup();

    const result = psql(`begin; update public.spec_versions set note = 'Edited.' where project_id = '${id}'; rollback;`);

    expect(result.ok).toBe(false);
    expect(result.output).toMatch(REFUSED);
    expect(must(await adminClient().from("spec_versions").select("note").eq("project_id", id).eq("version", 1)))
      .toEqual([{ note: "Design created." }]);
  });

  it("refuses to delete a version while its project exists", async () => {
    const { id } = await setup();

    const result = psql(`begin; delete from public.spec_versions where project_id = '${id}'; rollback;`);

    expect(result.ok).toBe(false);
    expect(result.output).toMatch(REFUSED);
    expect(must(await adminClient().from("spec_versions").select("id").eq("project_id", id))).toHaveLength(2);
  });

  it("refuses to empty the table", async () => {
    const { id } = await setup();

    const result = psql("begin; truncate public.spec_versions; rollback;");

    expect(result.ok).toBe(false);
    expect(result.output).toMatch(REFUSED);
    expect(must(await adminClient().from("spec_versions").select("id").eq("project_id", id))).toHaveLength(2);
  });

  it("removes the versions when their project is deleted", async () => {
    const { id } = await setup();

    const result = psql(
      `begin; delete from public.projects where id = '${id}'; select count(*) from public.spec_versions where project_id = '${id}'; rollback;`,
    );

    expect(result.ok).toBe(true);
    expect(result.output).toMatch(/^0$/m);
    expect(must(await adminClient().from("spec_versions").select("id").eq("project_id", id))).toHaveLength(2);
  });

  it("removes the versions when the whole brand is deleted", async () => {
    const { brand, id } = await setup();

    const result = psql(
      `begin; delete from public.brands where id = '${brand}'; select count(*) from public.spec_versions where project_id = '${id}'; rollback;`,
    );

    expect(result.ok).toBe(true);
    expect(result.output).toMatch(/^0$/m);
  });
});
