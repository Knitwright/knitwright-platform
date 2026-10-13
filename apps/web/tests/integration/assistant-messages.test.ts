import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { exchangeLines, loadChatHistory, recordLines } from "@/lib/projects/chat-history";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * The conversation with the assistant, kept for each design (the assistant audit, item 3).
 * Members read their own brand's; only the server adds lines; no line is changed or removed
 * while its design exists.
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
      p_style_number: "",
      p_season: "",
      p_garment_type: "crew-tee",
      p_spec: { made: "for the test" },
      p_schema_version: 1,
    }),
  ) as string;

const SLIM = exchangeLines("slim fit", { type: "outcome", outcome: { kind: "applied", explanations: ["Fit changed from Regular to Slim."], notes: [], version: 2 } });

const rowsOf = async (projectId: string) =>
  must(await adminClient().from("assistant_messages").select("*").eq("project_id", projectId).order("id"));

beforeAll(async () => {
  [alice, bob] = await Promise.all([person("chat-alice"), person("chat-bob")]);
  aliceBrand = await brandOf(alice, "Alice Athletic");
  bobBrand = await brandOf(bob, "Bob's Boots");
});

describe("keeping the conversation", () => {
  it("keeps the lines the server writes, in order, and shows them to a member of the brand", async () => {
    const id = await project(aliceBrand, alice);
    await recordLines(adminClient(), { brandId: aliceBrand, projectId: id }, SLIM);
    await recordLines(adminClient(), { brandId: aliceBrand, projectId: id }, exchangeLines("long sleeves", { type: "failed", message: "Try again." }));

    const seen = await loadChatHistory(alice.client, { brandId: aliceBrand, projectId: id });

    expect(seen.map((line) => line.body)).toEqual(["slim fit", "Done. The design is saved as a new version.", "long sleeves", "Try again."]);
    expect(seen[1].lines).toEqual(["Fit changed from Regular to Slim."]);
  });

  it("shows nothing of another brand's conversation", async () => {
    const theirs = await project(bobBrand, bob);
    await recordLines(adminClient(), { brandId: bobBrand, projectId: theirs }, SLIM);

    expect(await loadChatHistory(alice.client, { brandId: bobBrand, projectId: theirs })).toEqual([]);
    expect(await loadChatHistory(anonClient(), { brandId: bobBrand, projectId: theirs })).toEqual([]);
  });

  it("refuses a line for a design of another brand, and a line that breaks the rules", async () => {
    const theirs = await project(bobBrand, bob);
    const admin = adminClient();

    await expect(recordLines(admin, { brandId: aliceBrand, projectId: theirs }, SLIM)).rejects.toThrow();
    const bad = [
      { brand_id: bobBrand, project_id: theirs, role: "assistant", kind: "text", body: "x" },
      { brand_id: bobBrand, project_id: theirs, role: "person", kind: "applied", body: "x" },
      { brand_id: bobBrand, project_id: theirs, role: "person", kind: "text", body: "" },
      { brand_id: bobBrand, project_id: theirs, role: "person", kind: "text", body: "x".repeat(2001) },
    ];
    for (const row of bad) expect((await admin.from("assistant_messages").insert(row)).error, JSON.stringify(row).slice(0, 80)).not.toBeNull();
    expect(await rowsOf(theirs)).toEqual([]);
  });

  it("lets no browser add, change or remove a line", async () => {
    const id = await project(aliceBrand, alice);
    await recordLines(adminClient(), { brandId: aliceBrand, projectId: id }, SLIM);

    const row = { brand_id: aliceBrand, project_id: id, role: "person", kind: "text", body: "Made directly." };
    expect((await alice.client.from("assistant_messages").insert(row)).error).not.toBeNull();
    await alice.client.from("assistant_messages").update({ body: "Edited." }).eq("project_id", id);
    await alice.client.from("assistant_messages").delete().eq("project_id", id);

    expect((await rowsOf(id)).map((line) => line.body)).toEqual(SLIM.map((line) => line.body));
  });

  it("lets the server's own key change or remove nothing", async () => {
    const id = await project(aliceBrand, alice);
    await recordLines(adminClient(), { brandId: aliceBrand, projectId: id }, SLIM);
    const admin = adminClient();

    expect((await admin.from("assistant_messages").update({ body: "Edited." }).eq("project_id", id)).error).not.toBeNull();
    expect((await admin.from("assistant_messages").delete().eq("project_id", id)).error).not.toBeNull();
    expect(await rowsOf(id)).toHaveLength(2);
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

describe.skipIf(!dockerReachable)("the conversation, as seen by the owner of the table", () => {
  const REFUSED = /can never be changed or removed/;

  it("refuses to update, delete or empty, inside transactions that are rolled back", async () => {
    const id = await project(aliceBrand, alice);
    await recordLines(adminClient(), { brandId: aliceBrand, projectId: id }, SLIM);

    for (const sql of [
      `begin; update public.assistant_messages set body = 'Edited.' where project_id = '${id}'; rollback;`,
      `begin; delete from public.assistant_messages where project_id = '${id}'; rollback;`,
      "begin; truncate public.assistant_messages; rollback;",
    ]) {
      const result = psql(sql);
      expect(result.ok, sql).toBe(false);
      expect(result.output, sql).toMatch(REFUSED);
    }
    expect(await rowsOf(id)).toHaveLength(2);
  });

  it("removes the conversation when its design is deleted", async () => {
    const id = await project(aliceBrand, alice);
    await recordLines(adminClient(), { brandId: aliceBrand, projectId: id }, SLIM);

    const result = psql(`begin; delete from public.projects where id = '${id}'; select count(*) from public.assistant_messages where project_id = '${id}'; rollback;`);

    expect(result.ok).toBe(true);
    expect(result.output).toMatch(/^0$/m);
  });
});
