import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * The database side of projects and their versions. The functions here are the only
 * way to write to either table, and only the server's own key may run them.
 */

const SPEC = { schemaVersion: 3, note: "The database does not read inside this." };

let alice: Person;
let bob: Person;
let aliceBrand: string;
let bobBrand: string;

const create = (brandId: string, user: Person, overrides: Record<string, unknown> = {}) =>
  adminClient().rpc("create_project", {
    p_brand_id: brandId,
    p_user_id: user.userId,
    p_name: "Home shirt",
    p_style_number: "HS-01",
    p_season: "Spring 2027",
    p_garment_type: "crew-tee",
    p_spec: SPEC,
    p_schema_version: 3,
    ...overrides,
  });

const append = (projectId: string, user: Person, expected: number, overrides = {}) =>
  adminClient().rpc("append_spec_version", {
    p_project_id: projectId,
    p_user_id: user.userId,
    p_expected_version: expected,
    p_spec: { ...SPEC, at: expected },
    p_schema_version: 3,
    p_note: "Sleeve length changed to Long.",
    p_restored_from: null,
    ...overrides,
  });

const newProject = async (): Promise<string> => must(await create(aliceBrand, alice));

beforeAll(async () => {
  [alice, bob] = await Promise.all([person("proj-alice"), person("proj-bob")]);
  aliceBrand = await brandOf(alice, "Alice Athletic");
  bobBrand = await brandOf(bob, "Bob's Boots");
});

describe("create_project", () => {
  it("makes the project and its first version", async () => {
    const id = await newProject();

    const project = must(await adminClient().from("projects").select("*").eq("id", id).single());
    const versions = must(await adminClient().from("spec_versions").select("*").eq("project_id", id));

    expect(project).toMatchObject({
      brand_id: aliceBrand,
      name: "Home shirt",
      style_number: "HS-01",
      season: "Spring 2027",
      garment_type: "crew-tee",
      current_version: 1,
      created_by: alice.userId,
    });
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({
      version: 1,
      brand_id: aliceBrand,
      note: "Design created.",
      restored_from: null,
      schema_version: 3,
      spec: SPEC,
    });
  });

  it("trims the name and allows an empty style number and season", async () => {
    const id = must(await create(aliceBrand, alice, { p_name: "  Away  ", p_style_number: "", p_season: "" }));

    expect(must(await adminClient().from("projects").select("name, style_number, season").eq("id", id).single()))
      .toEqual({ name: "Away", style_number: "", season: "" });
  });

  it.each([
    ["an empty name", { p_name: "   " }],
    ["a name of 81 characters", { p_name: "n".repeat(81) }],
    ["a style number of 41 characters", { p_style_number: "s".repeat(41) }],
    ["a season of 41 characters", { p_season: "s".repeat(41) }],
    ["no garment type", { p_garment_type: "" }],
  ])("refuses %s", async (_label, overrides) => {
    const { error } = await create(aliceBrand, alice, overrides);

    expect(error?.code).toBe("22023");
  });

  it("answers not found for a brand the user does not belong to", async () => {
    const { error } = await create(bobBrand, alice);

    expect(error?.code).toBe("P0002");
  });

  it("answers not found for a brand that does not exist", async () => {
    const { error } = await create(randomUUID(), alice);

    expect(error?.code).toBe("P0002");
  });
});

describe("append_spec_version", () => {
  it("stores the next version and moves the project on", async () => {
    const id = await newProject();

    const version = must(await append(id, alice, 1));

    expect(version).toBe(2);
    expect(
      must(await adminClient().from("projects").select("current_version").eq("id", id).single()),
    ).toEqual({ current_version: 2 });
    expect(
      must(await adminClient().from("spec_versions").select("version, note").eq("project_id", id).order("version")),
    ).toEqual([
      { version: 1, note: "Design created." },
      { version: 2, note: "Sleeve length changed to Long." },
    ]);
  });

  it("refuses with version_conflict when the expected version is not the current one", async () => {
    const id = await newProject();
    must(await append(id, alice, 1));

    const { error } = await append(id, alice, 1);

    expect(error?.hint).toBe("version_conflict");
    expect(
      must(await adminClient().from("spec_versions").select("version").eq("project_id", id)),
    ).toHaveLength(2);
  });

  it("lets exactly one of ten saves from the same version succeed", async () => {
    const id = await newProject();

    const results = await Promise.all(Array.from({ length: 10 }, () => append(id, alice, 1)));

    const wins = results.filter((result) => result.error === null);
    const conflicts = results.filter((result) => result.error?.hint === "version_conflict");
    expect(wins).toHaveLength(1);
    expect(conflicts).toHaveLength(9);
    expect(
      must(await adminClient().from("spec_versions").select("version").eq("project_id", id).order("version")),
    ).toEqual([{ version: 1 }, { version: 2 }]);
  });

  it("keeps the project's garment type in step with the design it now holds", async () => {
    const id = await newProject();

    must(await append(id, alice, 1, { p_spec: { ...SPEC, typeId: "polo" } }));
    expect(must(await adminClient().from("projects").select("garment_type").eq("id", id).single())).toEqual({
      garment_type: "polo",
    });

    must(await append(id, alice, 2, { p_spec: { ...SPEC, typeId: "" } }));
    expect(must(await adminClient().from("projects").select("garment_type").eq("id", id).single())).toEqual({
      garment_type: "polo",
    });
  });

  it("keeps the versions in a row when saves follow one another", async () => {
    const id = await newProject();

    for (const expected of [1, 2, 3, 4]) must(await append(id, alice, expected));

    expect(
      must(await adminClient().from("spec_versions").select("version").eq("project_id", id).order("version")).map(
        (row) => row.version,
      ),
    ).toEqual([1, 2, 3, 4, 5]);
  });

  it("records which version a restore came from, and refuses one that does not exist", async () => {
    const id = await newProject();

    expect(must(await append(id, alice, 1, { p_restored_from: 1 }))).toBe(2);
    expect((await append(id, alice, 2, { p_restored_from: 9 })).error?.code).toBe("22023");
    expect(
      must(await adminClient().from("spec_versions").select("restored_from").eq("project_id", id).eq("version", 2).single()),
    ).toEqual({ restored_from: 1 });
  });

  it.each([
    ["an empty note", { p_note: "  " }],
    ["a note of 201 characters", { p_note: "n".repeat(201) }],
    ["a spec that is not an object", { p_spec: [1, 2] }],
    ["a schema version below one", { p_schema_version: 0 }],
  ])("refuses %s", async (_label, overrides) => {
    const id = await newProject();

    expect((await append(id, alice, 1, overrides)).error?.code).toBe("22023");
  });

  it("answers not found for a project of another brand and for one that does not exist", async () => {
    const id = await newProject();

    expect((await append(id, bob, 1)).error?.code).toBe("P0002");
    expect((await append(randomUUID(), alice, 1)).error?.code).toBe("P0002");
  });
});

describe("rename_project", () => {
  const rename = (projectId: string, user: Person, name = "Renamed") =>
    adminClient().rpc("rename_project", {
      p_project_id: projectId,
      p_user_id: user.userId,
      p_name: name,
      p_style_number: "NEW-1",
      p_season: "Autumn",
    });

  it("changes the details and the time of the last change", async () => {
    const id = await newProject();
    const before = must(await adminClient().from("projects").select("updated_at").eq("id", id).single());

    must(await rename(id, alice));

    const after = must(await adminClient().from("projects").select("*").eq("id", id).single());
    expect(after).toMatchObject({ name: "Renamed", style_number: "NEW-1", season: "Autumn", current_version: 1 });
    expect(new Date(after.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(before.updated_at).getTime());
  });

  it("refuses a bad name and a stranger", async () => {
    const id = await newProject();

    expect((await rename(id, alice, "  ")).error?.code).toBe("22023");
    expect((await rename(id, bob)).error?.code).toBe("P0002");
  });
});

describe("who may run the functions", () => {
  it("lets a signed-in browser run none of them", async () => {
    const id = await newProject();
    const calls = [
      alice.client.rpc("create_project", {
        p_brand_id: aliceBrand,
        p_user_id: alice.userId,
        p_name: "Direct",
        p_style_number: "",
        p_season: "",
        p_garment_type: "crew-tee",
        p_spec: SPEC,
        p_schema_version: 3,
      }),
      alice.client.rpc("append_spec_version", {
        p_project_id: id,
        p_user_id: alice.userId,
        p_expected_version: 1,
        p_spec: SPEC,
        p_schema_version: 3,
        p_note: "Direct.",
        p_restored_from: null,
      }),
      alice.client.rpc("rename_project", {
        p_project_id: id,
        p_user_id: alice.userId,
        p_name: "Direct",
        p_style_number: "",
        p_season: "",
      }),
    ];

    for (const { error } of await Promise.all(calls)) expect(error?.code).toBe("42501");
    expect(must(await adminClient().from("projects").select("name").eq("id", id).single()).name).toBe(
      "Home shirt",
    );
  });
});

describe("reading", () => {
  it("shows a member their own projects and versions, and nothing of another brand", async () => {
    const mine = await newProject();
    const theirs = must(await create(bobBrand, bob));

    const projects = must(await alice.client.from("projects").select("id"));
    const versions = must(await alice.client.from("spec_versions").select("project_id"));

    expect(projects.map((row) => row.id)).toContain(mine);
    expect(projects.map((row) => row.id)).not.toContain(theirs);
    expect(versions.map((row) => row.project_id)).not.toContain(theirs);
  });
});

describe("the history is append-only", () => {
  it("refuses to change a version, even for the server's own key", async () => {
    const id = await newProject();

    const { error } = await adminClient().from("spec_versions").update({ note: "Edited." }).eq("project_id", id);

    expect(error).not.toBeNull();
    expect(
      must(await adminClient().from("spec_versions").select("note").eq("project_id", id).single()).note,
    ).toBe("Design created.");
  });

  it("refuses to delete a version, even for the server's own key", async () => {
    const id = await newProject();

    const { error } = await adminClient().from("spec_versions").delete().eq("project_id", id);

    expect(error).not.toBeNull();
    expect(must(await adminClient().from("spec_versions").select("id").eq("project_id", id))).toHaveLength(1);
  });

  it("refuses to write a version directly, so the numbering cannot be skipped", async () => {
    const id = await newProject();

    const { error } = await adminClient()
      .from("spec_versions")
      .insert({ project_id: id, brand_id: aliceBrand, version: 2, spec: SPEC, schema_version: 3, note: "Direct.", created_by: alice.userId });

    expect(error).not.toBeNull();
  });

  it("still removes the versions when the project itself is deleted", async () => {
    const id = await newProject();
    must(await append(id, alice, 1));

    must(await adminClient().from("projects").delete().eq("id", id).select("id"));

    expect(must(await adminClient().from("spec_versions").select("id").eq("project_id", id))).toEqual([]);
  });

  it("still removes the versions when the brand is deleted with its projects", async () => {
    const owner = await person("proj-doomed");
    const brand = await brandOf(owner, "Doomed FC");
    const id = must(await create(brand, owner));

    must(await adminClient().from("brands").delete().eq("id", brand).select("id"));

    expect(must(await adminClient().from("spec_versions").select("id").eq("project_id", id))).toEqual([]);
  });
});
