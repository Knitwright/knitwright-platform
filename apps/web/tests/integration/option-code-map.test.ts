import { beforeAll, describe, expect, it } from "vitest";
import { optionCodeMap } from "@/lib/option-codes";
import { OPTION_CODE_MAP_SEED } from "@/lib/option-codes/seed/rows";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * Migration 20261201040000: the map from the garment registry's option keys to the catalogue's option codes
 * (plan v5 section 6 item 3, decision 0099). Members read it; nobody writes it from a browser; the server writes
 * through the service client. The seed reads back exactly as `lib/option-codes/seed/rows.ts` gives it.
 *
 * The test that matters most is the last one: the database itself refuses a mapped row that names a code the
 * catalogue never approved, and refuses a row that claims to be mapped while quoting no source at all. A guessed
 * mapping cannot be stored, not just cannot be written by our code.
 *
 * Written without local Supabase (one database on the machine is shared by every agent), so this file first runs
 * in CI. The migration, its constraints and its seed were checked against the generated SQL first.
 */

let member: Person;
let loner: Person;

const articleId = async (): Promise<string> =>
  must(await adminClient().from("base_articles").select("id").eq("code", "JSY-SS-01").single()).id as string;

beforeAll(async () => {
  [member, loner] = await Promise.all([person("ocm-member"), person("ocm-loner")]);
  await brandOf(member, "Option Code Club");
});

describe("the seeded map", () => {
  it("reads back exactly as its seed gives it, in order", async () => {
    expect(await optionCodeMap(member.client, "JSY-SS-01")).toEqual(OPTION_CODE_MAP_SEED);
  });

  it("is empty for an article with no option codes to map, and for an unknown code", async () => {
    expect(await optionCodeMap(member.client, "TEE-TR-01")).toEqual([]);
    expect(await optionCodeMap(member.client, "ZZZ-ZZ-99")).toEqual([]);
  });

  it("gives every mapped row a source and every gap a note", async () => {
    const rows = must(await adminClient().from("option_code_map").select("kind, option_code, sources, note")) as {
      kind: string;
      option_code: string | null;
      sources: unknown[];
      note: string | null;
    }[];
    expect(rows.length).toBe(OPTION_CODE_MAP_SEED.length);
    for (const row of rows) {
      if (row.kind === "mapped") expect([row.option_code !== null, row.sources.length > 0, row.note]).toEqual([true, true, null]);
      else expect([row.option_code, row.note === null]).toEqual([null, false]);
      if (row.kind === "no_code_yet") expect(row.sources).toEqual([]);
    }
  });
});

describe("who reads and writes the map", () => {
  it("is refused to a visitor and shows nothing to a person with no brand", async () => {
    expect((await anonClient().from("option_code_map").select("*").limit(1)).error).not.toBeNull();
    expect(must(await loner.client.from("option_code_map").select("*").limit(1))).toEqual([]);
  });

  it("refuses a browser write from a member", async () => {
    const id = await articleId();
    const row = { article_id: id, position: 90, registry_key: "neckline", registry_choice: "crew", option_group: "collar", option_code: "C03", kind: "mapped", rule_id: "R-CON-006" };
    expect((await member.client.from("option_code_map").insert(row)).error).not.toBeNull();
    await member.client.from("option_code_map").update({ option_code: "C03" }).eq("registry_choice", "crew");
    await member.client.from("option_code_map").delete().eq("registry_choice", "crew");
    expect(await optionCodeMap(member.client, "JSY-SS-01")).toEqual(OPTION_CODE_MAP_SEED);
  });
});

describe("what the database refuses even from the server", () => {
  const sources = [{ file: "docs/spec/articles/JSY-SS-01/rulebook.md", quote: "Collar C03 | Crew neck with 15 mm self-fabric binding" }];
  const mapped = async () => ({
    article_id: await articleId(),
    position: 90,
    registry_key: "neckline",
    registry_choice: "henley",
    option_group: "collar",
    option_code: "C03",
    kind: "mapped",
    sources,
    rule_id: "R-CON-006",
  });

  it("refuses a code the catalogue never approved, and one approved in another group", async () => {
    const row = await mapped();
    expect((await adminClient().from("option_code_map").insert({ ...row, option_code: "C99" })).error).not.toBeNull();
    expect((await adminClient().from("option_code_map").insert({ ...row, option_group: "sleeve_finish", option_code: "C03" })).error).not.toBeNull();
  });

  it("refuses a mapped row that quotes no source, and a gap that quotes one", async () => {
    const row = await mapped();
    expect((await adminClient().from("option_code_map").insert({ ...row, sources: [] })).error).not.toBeNull();
    expect((await adminClient().from("option_code_map").insert({ ...row, kind: "no_code_yet", option_code: null, note: "none yet", sources })).error).not.toBeNull();
  });

  it("refuses a gap with no note, and a kind the map does not know", async () => {
    const row = await mapped();
    expect((await adminClient().from("option_code_map").insert({ ...row, kind: "no_code_yet", option_code: null, sources: [] })).error).not.toBeNull();
    expect((await adminClient().from("option_code_map").insert({ ...row, kind: "guessed" })).error).not.toBeNull();
  });

  it("refuses a rule id that is not one, and sources that are not a list", async () => {
    const row = await mapped();
    expect((await adminClient().from("option_code_map").insert({ ...row, rule_id: "con-6" })).error).not.toBeNull();
    expect((await adminClient().from("option_code_map").insert({ ...row, sources: { file: "x" } })).error).not.toBeNull();
  });

  it("lets the server add a sourced row and take it away again", async () => {
    const row = await mapped();
    const created = must(await adminClient().from("option_code_map").insert(row).select("id").single()) as { id: string };
    expect(must(await adminClient().from("option_code_map").select("option_code").eq("id", created.id))).toEqual([{ option_code: "C03" }]);
    must(await adminClient().from("option_code_map").delete().eq("id", created.id).select("id"));
    expect(await optionCodeMap(member.client, "JSY-SS-01")).toEqual(OPTION_CODE_MAP_SEED);
  });
});
