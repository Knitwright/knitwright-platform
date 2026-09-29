import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * The isolation suite. Plan step 3, task 7, and acceptance criterion M5: one brand can
 * never read another brand's designs, files or images.
 *
 * The suite asks the database which tables, buckets and functions exist. A new one
 * that is not described below makes the suite fail, so nothing can be added without
 * deciding who may reach it.
 */

type Row = Record<string, unknown>;

type TableSpec = Readonly<{
  /** What a browser may do to the table at all, before any policy is considered. */
  privileges: readonly string[];
  /** The column that says which brand a row belongs to. */
  brandColumn: string;
  /** A row of the given brand, made by the server. Returns the columns that identify it. */
  seed: (brandId: string, ownerId: string) => Promise<Row>;
  /** A row someone might try to insert for the given brand. */
  attempt: (brandId: string, userId: string) => Row;
  /** A change someone might try to make. */
  change: Row;
}>;

/** An allowance no test will reach. */
const UNLIMITED = 1_000_000_000_000;

const filePath = (brandId: string) => `${brandId}/artwork/${randomUUID()}.png`;

const TABLES: Readonly<Record<string, TableSpec>> = {
  brands: {
    privileges: ["SELECT"],
    brandColumn: "id",
    seed: async (brandId) => ({ id: brandId }),
    attempt: (_brandId, userId) => ({ name: "Made directly", created_by: userId }),
    change: { name: "Changed by a stranger" },
  },
  memberships: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => ({ brand_id: brandId, user_id: ownerId }),
    attempt: (brandId, userId) => ({ brand_id: brandId, user_id: userId, role: "owner" }),
    change: { role: "owner" },
  },
  files: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const row = {
        id: randomUUID(),
        brand_id: brandId,
        bucket: "uploads",
        path: filePath(brandId),
        kind: "artwork",
        content_type: "image/png",
        bytes: 10,
        created_by: ownerId,
      };
      must(await adminClient().from("files").insert(row).select("id"));
      return { id: row.id };
    },
    attempt: (brandId, userId) => ({
      brand_id: brandId,
      bucket: "uploads",
      path: filePath(brandId),
      kind: "artwork",
      content_type: "image/png",
      bytes: 10,
      created_by: userId,
    }),
    change: { kind: "photo" },
  },
  projects: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => ({ id: await seedProject(brandId, ownerId) }),
    attempt: (brandId, userId) => ({
      brand_id: brandId,
      name: "Made directly",
      garment_type: "crew-tee",
      created_by: userId,
    }),
    change: { name: "Changed by a stranger" },
  },
  spec_versions: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const projectId = await seedProject(brandId, ownerId);
      return must(
        await adminClient().from("spec_versions").select("id").eq("project_id", projectId).single(),
      );
    },
    attempt: (brandId, userId) => ({
      project_id: randomUUID(),
      brand_id: brandId,
      version: 1,
      spec: { made: "directly" },
      schema_version: 1,
      note: "Made directly.",
      created_by: userId,
    }),
    change: { note: "Changed by a stranger." },
  },
  export_downloads: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const projectId = await seedProject(brandId, ownerId);
      must(
        await adminClient().rpc("record_export_download", {
          p_project_id: projectId,
          p_user_id: ownerId,
          p_spec_version: 1,
          p_format: "pdf",
          p_view: null,
        }),
      );
      return { project_id: projectId };
    },
    attempt: (brandId, userId) => ({
      brand_id: brandId,
      project_id: randomUUID(),
      spec_version: 1,
      format: "pdf",
      user_id: userId,
    }),
    change: { format: "xlsx" },
  },
  // Plan step 10: a member can neither change a limit nor delete a usage event.
  usage_events: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const reserved = must(
        await adminClient().rpc("usage_reserve", {
          p_user_id: ownerId,
          p_brand_id: brandId,
          p_feature: "ai",
          p_cost: 1,
          p_route: "POST /api/isolation",
          p_user_allowance: UNLIMITED,
          p_brand_allowance: UNLIMITED,
          p_global_ceiling: UNLIMITED,
        }),
      ) as { event_id: string };
      return { id: reserved.event_id };
    },
    attempt: (brandId, userId) => ({
      brand_id: brandId,
      user_id: userId,
      feature: "ai",
      cost: 1,
      day: "2026-01-01",
      route: "made directly",
    }),
    change: { cost: 1_000_000, refunded_at: "2026-01-01T00:00:00Z" },
  },
  usage_limits: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId) => ({
      id: must(
        await adminClient().rpc("usage_set_limit", {
          p_subject: "brand",
          p_subject_id: brandId,
          p_feature: "photoreal",
          p_daily_allowance: 5,
        }),
      ),
    }),
    attempt: (brandId) => ({ brand_id: brandId, feature: "ai", daily_allowance: UNLIMITED }),
    change: { daily_allowance: UNLIMITED },
  },
  // Plan step 14: a member reads the brand's jobs; only the server starts or finishes one.
  jobs: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const projectId = await seedProject(brandId, ownerId);
      return must(
        await adminClient()
          .from("jobs")
          .insert({ brand_id: brandId, project_id: projectId, version: 1, kind: "photoreal", created_by: ownerId })
          .select("id")
          .single(),
      );
    },
    attempt: (brandId, userId) => ({
      brand_id: brandId,
      project_id: randomUUID(),
      version: 1,
      kind: "photoreal",
      created_by: userId,
    }),
    change: { status: "failed", error: "Changed by a stranger.", finished_at: "2026-01-01T00:00:00Z" },
  },
};

/** A project made the way the server makes one. Returns its id. */
const seedProject = async (brandId: string, ownerId: string): Promise<string> =>
  must(
    await adminClient().rpc("create_project", {
      p_brand_id: brandId,
      p_user_id: ownerId,
      p_name: "Seeded design",
      p_style_number: "",
      p_season: "",
      p_garment_type: "crew-tee",
      p_spec: { seeded: true },
      p_schema_version: 1,
    }),
  );

const BUCKETS = ["exports", "images", "uploads"] as const;

/** Functions a browser may call, and who may call them. Everything else is refused. */
const CALLABLE = {
  "public.signup_is_open()": { anon: true, authenticated: true },
  "public.create_brand(p_name text)": { anon: false, authenticated: true },
  "public.rename_brand(p_brand_id uuid, p_name text)": { anon: false, authenticated: true },
  // Used inside access rules. They cannot be called through the API.
  "private.is_member(p_brand_id uuid)": { anon: false, authenticated: true },
  "private.brand_id_from(p_text text)": { anon: false, authenticated: true },
} as const;

type Report = Readonly<{
  tables: { name: string; rls_enabled: boolean; client_privileges: string[] }[];
  buckets: { id: string; public: boolean }[];
  storage_policies: { name: string; command: string }[];
  storage_tables: { name: string; rls_enabled: boolean }[];
  functions: {
    signature: string;
    security_definer: boolean;
    fixed_search_path: boolean;
    anon: boolean;
    authenticated: boolean;
  }[];
}>;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

let report: Report;
let alice: Person;
let bob: Person;
let aliceBrand: string;
let bobBrand: string;

const rowsAsServer = async (table: string, keys: Row): Promise<Row[]> =>
  must(await adminClient().from(table).select("*").match(keys));

const rowAsServer = async (table: string, keys: Row): Promise<Row | undefined> =>
  (await rowsAsServer(table, keys))[0];

beforeAll(async () => {
  report = must(await adminClient().rpc("security_report")) as Report;
  [alice, bob] = await Promise.all([person("alice"), person("bob")]);
  aliceBrand = await brandOf(alice, "Alice Athletic");
  bobBrand = await brandOf(bob, "Bob's Boots");
});

describe("what exists", () => {
  it("has row level security on every table", () => {
    expect(report.tables.filter((table) => !table.rls_enabled).map((table) => table.name)).toEqual(
      [],
    );
  });

  it("has a test below for every table, and no test for a table that is gone", () => {
    expect(report.tables.map((table) => table.name).sort()).toEqual(Object.keys(TABLES).sort());
  });

  it("lets a browser do to each table only what is written down here", () => {
    for (const table of report.tables) {
      expect([table.name, table.client_privileges]).toEqual([
        table.name,
        [...TABLES[table.name].privileges].sort(),
      ]);
    }
  });

  it("has only private buckets, each with a test below", () => {
    expect(report.buckets).toEqual(BUCKETS.map((id) => ({ id, public: false })));
  });

  it("gives browsers no way to write to storage", () => {
    expect(report.storage_policies.map((policy) => policy.command)).toEqual(["select"]);
  });

  it("lets a browser call only the functions written down here", () => {
    const callable = Object.fromEntries(
      report.functions
        .filter((fn) => fn.anon || fn.authenticated)
        .map((fn) => [fn.signature, { anon: fn.anon, authenticated: fn.authenticated }]),
    );

    expect(callable).toEqual(CALLABLE);
  });

  it("fixes the search path of every function that runs with its owner's rights", () => {
    expect(
      report.functions
        .filter((fn) => fn.security_definer && !fn.fixed_search_path)
        .map((fn) => fn.signature),
    ).toEqual([]);
  });

  it("counts two functions with one name as two, so a second cannot hide behind the first", () => {
    const signatures = report.functions.map((fn) => fn.signature);

    expect(new Set(signatures).size).toBe(signatures.length);
    expect(signatures.every((signature) => /^\w+\.\w+\(.*\)$/.test(signature))).toBe(true);
  });

  it("has row level security on every table of the file store", () => {
    expect(report.storage_tables.length).toBeGreaterThan(0);
    expect(
      report.storage_tables.filter((table) => !table.rls_enabled).map((table) => table.name),
    ).toEqual([]);
  });

  it("keeps stored exports to formats a browser will not run", async () => {
    const { data } = await adminClient().storage.getBucket("exports");

    expect(data?.allowed_mime_types).not.toContain("image/svg+xml");
  });

  it("does not show this report to a browser", async () => {
    expect((await anonClient().rpc("security_report")).error).not.toBeNull();
    expect((await alice.client.rpc("security_report")).error).not.toBeNull();
  });
});

describe.each(Object.entries(TABLES))("table %s", (table, spec) => {
  let theirs: Row;
  let before: Row | undefined;

  beforeAll(async () => {
    theirs = await spec.seed(bobBrand, bob.userId);
    await spec.seed(aliceBrand, alice.userId);
    before = await rowAsServer(table, theirs);
    expect(before).toBeDefined();
  });

  it("shows a member their own brand's rows", async () => {
    const rows = must(await alice.client.from(table).select("*"));

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row[spec.brandColumn] === aliceBrand)).toBe(true);
  });

  it("shows a member nothing of another brand", async () => {
    const all = must(await alice.client.from(table).select("*"));
    const asked = must(await alice.client.from(table).select("*").match(theirs));

    expect(all.some((row) => row[spec.brandColumn] === bobBrand)).toBe(false);
    expect(asked).toEqual([]);
  });

  it("shows a visitor who is not signed in nothing", async () => {
    const { data, error } = await anonClient().from(table).select("*");

    expect(error !== null || data?.length === 0).toBe(true);
  });

  it("lets a member add nothing to another brand", async () => {
    const { error } = await alice.client.from(table).insert(spec.attempt(bobBrand, alice.userId));

    expect(error).not.toBeNull();
  });

  it("lets a member add nothing directly, even to their own brand", async () => {
    const { error } = await alice.client
      .from(table)
      .insert(spec.attempt(aliceBrand, alice.userId));

    expect(error).not.toBeNull();
  });

  it("lets a member change nothing of another brand", async () => {
    await alice.client.from(table).update(spec.change).match(theirs);

    expect(await rowAsServer(table, theirs)).toEqual(before);
  });

  it("lets a member delete nothing of another brand", async () => {
    await alice.client.from(table).delete().match(theirs);

    expect(await rowAsServer(table, theirs)).toEqual(before);
  });

  it("lets a member change or delete nothing of their own brand directly", async () => {
    const mine = { [spec.brandColumn]: aliceBrand };
    const mineBefore = await rowsAsServer(table, mine);

    await alice.client.from(table).update(spec.change).match(mine);
    await alice.client.from(table).delete().match(mine);

    expect(await rowsAsServer(table, mine)).toEqual(mineBefore);
  });
});

describe("memberships", () => {
  it("does not let a member join another brand", async () => {
    await alice.client
      .from("memberships")
      .insert({ brand_id: bobBrand, user_id: alice.userId, role: "owner" });

    expect(must(await alice.client.from("brands").select("id"))).toEqual([{ id: aliceBrand }]);
  });

  it("does not let a member change their own role", async () => {
    await alice.client
      .from("memberships")
      .update({ role: "admin" })
      .eq("brand_id", aliceBrand)
      .eq("user_id", alice.userId);

    expect(
      await rowAsServer("memberships", { brand_id: aliceBrand, user_id: alice.userId }),
    ).toMatchObject({ role: "owner" });
  });

  it("does not show a member who else belongs to other brands", async () => {
    const rows = must(await alice.client.from("memberships").select("user_id"));

    expect(rows).toEqual([{ user_id: alice.userId }]);
  });
});

describe.each(BUCKETS)("bucket %s", (bucket) => {
  const type = bucket === "exports" ? "application/pdf" : "image/png";
  let theirs: string;
  let mine: string;

  beforeAll(async () => {
    theirs = `${bobBrand}/test/${randomUUID()}`;
    mine = `${aliceBrand}/test/${randomUUID()}`;
    for (const path of [theirs, mine]) {
      must(await adminClient().storage.from(bucket).upload(path, PNG, { contentType: type }));
    }
  });

  it("lets a member read their own brand's file", async () => {
    const { data, error } = await alice.client.storage.from(bucket).download(mine);

    expect(error).toBeNull();
    expect(data?.size).toBe(PNG.byteLength);
  });

  it("does not let a member read another brand's file", async () => {
    const { data, error } = await alice.client.storage.from(bucket).download(theirs);

    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("does not give a member a link to another brand's file", async () => {
    const { data, error } = await alice.client.storage.from(bucket).createSignedUrl(theirs, 60);

    expect(error).not.toBeNull();
    expect(data?.signedUrl).toBeUndefined();
  });

  it("does not list another brand's files", async () => {
    const { data } = await alice.client.storage.from(bucket).list(`${bobBrand}/test`);

    expect(data ?? []).toEqual([]);
  });

  it("serves nothing at a public address", async () => {
    const { data } = adminClient().storage.from(bucket).getPublicUrl(theirs);

    expect((await fetch(data.publicUrl)).ok).toBe(false);
  });

  it("lets a browser upload nothing, not even into its own brand's folder", async () => {
    const into = (brandId: string) =>
      alice.client.storage
        .from(bucket)
        .upload(`${brandId}/test/${randomUUID()}`, PNG, { contentType: type });

    expect((await into(bobBrand)).error).not.toBeNull();
    expect((await into(aliceBrand)).error).not.toBeNull();
  });

  it("lets a member replace, move or delete nothing of another brand", async () => {
    const files = alice.client.storage.from(bucket);

    await files.update(theirs, Buffer.from("replaced"), { contentType: type });
    await files.move(theirs, `${aliceBrand}/test/stolen-${randomUUID()}`);
    await files.remove([theirs]);

    const kept = must(await adminClient().storage.from(bucket).download(theirs));
    expect(Buffer.from(await kept.arrayBuffer())).toEqual(PNG);
  });

  it("shows a visitor who is not signed in nothing", async () => {
    expect((await anonClient().storage.from(bucket).download(mine)).error).not.toBeNull();
  });

  it("treats a path that does not start with a brand id as belonging to nobody", async () => {
    const stray = `not-a-brand/${randomUUID()}`;
    must(await adminClient().storage.from(bucket).upload(stray, PNG, { contentType: type }));

    expect((await alice.client.storage.from(bucket).download(stray)).error).not.toBeNull();
  });
});
