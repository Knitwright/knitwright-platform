import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { deleteAccount, deleteDesign } from "@/lib/deletion/service";
import type { DeletionClient } from "@/lib/deletion/client";
import { uploadArtwork } from "@/lib/artwork-intake/service";
import { leagueRulesInputSchema, printProfileInputSchema, saveLeagueRules, savePrintProfile } from "@/lib/print/profiles";
import { storeImage } from "@/lib/storage/store";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * Plan step 26, task 5: deleting a design and deleting an account, with their stored files, against
 * local Supabase. Needs `pnpm db:start`, supabase/migrations/20260930010000_deletion.sql and
 * 20260930020000_deletion_integration.sql (photoreal jobs and brand charts).
 *
 * Written on 2026-09-30 while Docker was down: NOT RUN YET. Run with
 *   npx vitest run --project db tests/integration/deletion.test.ts
 */

const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_knitwright-platform";

const psql = (sql: string): string =>
  execFileSync("docker", ["exec", CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15_000,
  });

const dockerReachable = (() => {
  try {
    psql("select 1");
    return true;
  } catch {
    return false;
  }
})();

const admin = () => adminClient() as unknown as DeletionClient;

const png = () =>
  sharp({ create: { width: 16, height: 16, channels: 4, background: "#2b46f0" } }).png().toBuffer();

const upload = async (owner: Person, brandId: string) =>
  storeImage({
    admin: adminClient(),
    brandId,
    userId: owner.userId,
    kind: "artwork",
    bytes: await png(),
    statedType: "image/png",
  });

const artworkSpec = (fileIds: readonly string[]) => ({
  artwork: fileIds.map((fileId) => ({ id: randomUUID(), name: "Logo", source: { kind: "file", fileId } })),
});

const makeDesign = async (owner: Person, brandId: string, fileIds: readonly string[] = []) => {
  const id = must(
    await adminClient().rpc("create_project", {
      p_brand_id: brandId,
      p_user_id: owner.userId,
      p_name: "To delete",
      p_style_number: "",
      p_season: "",
      p_garment_type: "crew-tee",
      p_spec: artworkSpec(fileIds),
      p_schema_version: 1,
    }),
  ) as string;
  must(
    await adminClient().rpc("record_export_download", {
      p_project_id: id,
      p_user_id: owner.userId,
      p_spec_version: 1,
      p_format: "pdf",
      p_view: null,
    }),
  );
  return id;
};

const pathOf = async (fileId: string): Promise<string> =>
  must(await adminClient().from("files").select("path").eq("id", fileId).single()).path as string;

const objectExists = async (path: string, bucket = "uploads"): Promise<boolean> => {
  const folder = path.split("/").slice(0, -1).join("/");
  const name = path.split("/").at(-1);
  const { data } = await adminClient().storage.from(bucket).list(folder, { search: name });
  return (data ?? []).some((entry) => entry.name === name);
};

const count = async (table: string, column: string, value: string): Promise<number> => {
  const { count: rows, error } = await adminClient()
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  if (error) throw new Error(error.message);
  return rows ?? 0;
};

let alice: Person;
let bob: Person;
let aliceBrand: string;
let bobBrand: string;

beforeAll(async () => {
  [alice, bob] = await Promise.all([person("alice-del"), person("bob-del")]);
  aliceBrand = await brandOf(alice, "Alice Deletes");
  bobBrand = await brandOf(bob, "Bob Keeps");
});

describe("the deletion functions", () => {
  it("cannot be called by a browser, signed in or not", async () => {
    const args = { p_project_id: randomUUID(), p_brand_id: aliceBrand, p_user_id: alice.userId };
    for (const client of [anonClient(), alice.client]) {
      expect((await client.rpc("project_deletion_files", args)).error).not.toBeNull();
      expect((await client.rpc("delete_project", args)).error).not.toBeNull();
      expect((await client.rpc("account_deletion_brands", { p_user_id: alice.userId })).error).not.toBeNull();
      expect((await client.rpc("delete_account_data", { p_user_id: alice.userId })).error).not.toBeNull();
    }
  });
});

describe("deleteDesign", () => {
  it("removes the design, its versions, its download records and the pictures only it uses", async () => {
    const own = await upload(alice, aliceBrand);
    const shared = await upload(alice, aliceBrand);
    const unused = await upload(alice, aliceBrand);
    const doomed = await makeDesign(alice, aliceBrand, [own.id, shared.id]);
    const other = await makeDesign(alice, aliceBrand, [shared.id]);
    const ownPath = await pathOf(own.id);

    expect(await deleteDesign(admin(), { brandId: aliceBrand, userId: alice.userId, projectId: doomed })).toEqual({
      removedFiles: 1,
    });

    expect(await count("projects", "id", doomed)).toBe(0);
    expect(await count("spec_versions", "project_id", doomed)).toBe(0);
    expect(await count("export_downloads", "project_id", doomed)).toBe(0);
    expect(await count("files", "id", own.id)).toBe(0);
    expect(await objectExists(ownPath)).toBe(false);
    // Kept: a picture another design uses, a picture no design uses, and the other design.
    expect(await count("files", "id", shared.id)).toBe(1);
    expect(await objectExists(await pathOf(shared.id))).toBe(true);
    expect(await count("files", "id", unused.id)).toBe(1);
    expect(await count("projects", "id", other)).toBe(1);
  });

  it("refuses another brand's design, and a design named under the wrong brand, the same way", async () => {
    const bobs = await makeDesign(bob, bobBrand);
    await expect(
      deleteDesign(admin(), { brandId: aliceBrand, userId: alice.userId, projectId: bobs }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      deleteDesign(admin(), { brandId: bobBrand, userId: alice.userId, projectId: bobs }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      deleteDesign(admin(), { brandId: aliceBrand, userId: alice.userId, projectId: randomUUID() }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(await count("projects", "id", bobs)).toBe(1);
  });

  it("never removes another brand's file, even when a design's artwork names it", async () => {
    const bobsFile = await upload(bob, bobBrand);
    const design = await makeDesign(alice, aliceBrand, [bobsFile.id]);
    await deleteDesign(admin(), { brandId: aliceBrand, userId: alice.userId, projectId: design });
    expect(await count("files", "id", bobsFile.id)).toBe(1);
    expect(await objectExists(await pathOf(bobsFile.id))).toBe(true);
  });
});

/** A generated picture of a design, as a finished photoreal job leaves it. */
const photorealJob = async (owner: Person, brandId: string, projectId: string, startedBy: Person = owner) => {
  const picture = await storeImage({
    admin: adminClient(),
    brandId,
    userId: owner.userId,
    kind: "render",
    bytes: await png(),
    statedType: "image/png",
  });
  must(
    await adminClient().from("jobs").insert({
      brand_id: brandId,
      project_id: projectId,
      version: 1,
      kind: "photoreal",
      status: "succeeded",
      finished_at: new Date().toISOString(),
      front_file_id: picture.id,
      created_by: startedBy.userId,
    }),
  );
  return picture;
};

describe("deleting with photoreal pictures and brand charts (integration of steps 14, 25, 26)", () => {
  it("removes the pictures generated for a design with it, from the images bucket", async () => {
    const design = await makeDesign(alice, aliceBrand);
    const picture = await photorealJob(alice, aliceBrand, design);
    const path = await pathOf(picture.id);
    expect(await objectExists(path, "images")).toBe(true);

    expect(await deleteDesign(admin(), { brandId: aliceBrand, userId: alice.userId, projectId: design })).toEqual({
      removedFiles: 1,
    });

    expect(await count("jobs", "project_id", design)).toBe(0);
    expect(await count("files", "id", picture.id)).toBe(0);
    expect(await objectExists(path, "images")).toBe(false);
  });

  it("deletes an account whose person started photoreal jobs and imported a size chart", async () => {
    const frank = await person("frank-del");
    const brand = await brandOf(frank, "Frank Makes");
    const design = await makeDesign(frank, brand);
    await photorealJob(frank, brand, design);
    must(
      await adminClient().rpc("replace_brand_chart", {
        p_brand_id: brand,
        p_user_id: frank.userId,
        p_wearer: "men",
        p_garment_type: "crew-tee",
        p_fit: "any",
        p_chart: { seeded: true },
        p_run: { seeded: true },
        p_file_id: null,
      }),
    );

    expect(await deleteAccount(admin(), { userId: frank.userId })).toEqual({ deletedBrands: 1 });

    expect(await count("jobs", "brand_id", brand)).toBe(0);
    expect(await count("brand_size_charts", "brand_id", brand)).toBe(0);
    expect(await count("usage_events", "user_id", frank.userId)).toBe(0);
    const { data } = await adminClient().auth.admin.getUserById(frank.userId);
    expect(data.user).toBeNull();
  });

  // When brands have other members, a person's jobs and charts stay with the brand. Shown here
  // at the database level, since the MVP refuses to delete an account whose brand is shared.
  it.skipIf(!dockerReachable)("keeps a brand's jobs and charts when the person who made them is removed", async () => {
    const gina = await person("gina-del");
    const brand = await brandOf(bob, `Bob Keeps ${randomUUID().slice(0, 8)}`);
    const design = await makeDesign(bob, brand);
    await photorealJob(bob, brand, design, gina);
    psql(`delete from auth.users where id = '${gina.userId}'`);
    const kept = must(await adminClient().from("jobs").select("created_by").eq("project_id", design)) as { created_by: string | null }[];
    expect(kept).toEqual([{ created_by: null }]);
  });
});

describe("deleteAccount", () => {
  it("removes every brand, design, file row and stored object, then the user", async () => {
    const carol = await person("carol-del");
    const first = await brandOf(carol, "Carol One");
    const second = await brandOf(carol, "Carol Two");
    const file = await upload(carol, first);
    const path = await pathOf(file.id);
    const design = await makeDesign(carol, second, []);

    expect(await deleteAccount(admin(), { userId: carol.userId })).toEqual({ deletedBrands: 2 });

    for (const brand of [first, second]) expect(await count("brands", "id", brand)).toBe(0);
    expect(await count("memberships", "user_id", carol.userId)).toBe(0);
    expect(await count("projects", "id", design)).toBe(0);
    expect(await count("files", "id", file.id)).toBe(0);
    expect(await objectExists(path)).toBe(false);
    const { data } = await adminClient().auth.admin.getUserById(carol.userId);
    expect(data.user).toBeNull();
    // Nothing of anyone else's went with it.
    expect(await count("brands", "id", bobBrand)).toBe(1);
  });

  it("removes artwork, print settings, league rules and design imports with their files, so the user can go", async () => {
    const gina = await person("gina-del");
    const brand = await brandOf(gina, "Gina Artwork");
    const who = { brandId: brand, userId: gina.userId };
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><circle cx="50" cy="25" r="20" fill="#c8102e"/></svg>');
    const given = (bytes: Uint8Array, fileName: string) => uploadArtwork(adminClient(), who, { bytes, fileName, rightsConfirmed: true, now: new Date() });
    const raster = await given(new Uint8Array(await png()), "Crest.png");
    const vector = await given(svg, "Badge.svg");
    await savePrintProfile(adminClient(), who, printProfileInputSchema.parse({ bleedMm: 12, dpi: 200, minDpi: 100, iccFileId: null, maxPrintWidthMm: null }));
    await saveLeagueRules(adminClient(), who, leagueRulesInputSchema.parse({ name: "League", source: "Rule book", rules: { minTextHeightMm: 50, minLineMm: null, coloursToAvoid: [], numberRules: null } }));
    const imports = [
      { status: "ready" },
      { status: "accepted", accepted_stack: {}, accepted_at: new Date().toISOString(), accepted_by: gina.userId },
    ].map((over) => ({ brand_id: brand, source_file_id: randomUUID(), rights_accepted_at: new Date().toISOString(), reading: {}, report: {}, overlay: {}, result: {}, created_by: gina.userId, ...over }));
    must(await adminClient().from("design_imports").insert(imports));

    const copies = must(await adminClient().from("files").select("id, bucket, path, kind").eq("brand_id", brand).in("kind", ["artwork-print", "artwork-vector"])).map((row) => row as { id: string; bucket: string; path: string; kind: string });
    expect(copies.map((copy) => copy.kind).sort()).toEqual(["artwork-print", "artwork-vector"]);
    for (const copy of copies) expect(await objectExists(copy.path, copy.bucket)).toBe(true);

    expect(await deleteAccount(admin(), { userId: gina.userId })).toEqual({ deletedBrands: 1 });

    for (const table of ["user_artworks", "design_imports", "print_profiles", "league_rule_sets", "files"]) expect(await count(table, "brand_id", brand), table).toBe(0);
    for (const copy of copies) expect(await objectExists(copy.path, copy.bucket), copy.path).toBe(false);
    for (const record of [raster, vector]) expect(await count("user_artworks", "id", record.id)).toBe(0);
    const { data } = await adminClient().auth.admin.getUserById(gina.userId);
    expect(data.user).toBeNull();
  });

  // The allow list is in the private schema, which the API does not expose, so this reads it as
  // the database owner through psql in the local container, as append-only-owner.test.ts does.
  it.skipIf(!dockerReachable)("removes the address from the sign-up allow list", async () => {
    const dave = await person("dave-del");
    must(await adminClient().rpc("allow_signup_email", { p_email: dave.email, p_note: "test" }));
    const listed = () =>
      psql(`select count(*) from private.signup_allowlist where email = lower('${dave.email}')`).trim();
    expect(listed()).toBe("1");
    await deleteAccount(admin(), { userId: dave.userId });
    expect(listed()).toBe("0");
  });

  it("refuses an account that does not exist", async () => {
    await expect(deleteAccount(admin(), { userId: randomUUID() })).rejects.toMatchObject({ code: "not_found" });
  });

  it("leaves no way to sign in afterwards", async () => {
    const erin = await person("erin-del");
    await deleteAccount(admin(), { userId: erin.userId });
    const { error } = await anonClient().auth.signInWithPassword({
      email: erin.email,
      password: "correct-horse-battery",
      options: { captchaToken: "local-test-token" },
    });
    expect(error).not.toBeNull();
  });
});
