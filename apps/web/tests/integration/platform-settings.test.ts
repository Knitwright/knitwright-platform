import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, must, person, type Person } from "./support";

/**
 * Platform settings console (decision 0056): only a platform admin sets a setting, every change leaves a history
 * line that can never be changed, and no browser role reads either table. Needs `pnpm db:start`. The test keys
 * start with "test." so they never collide with a real setting; the app never reads them.
 */

let admin: Person;
let member: Person;

const set = (actor: string, key: string, value: unknown) => adminClient().rpc("platform_setting_set", { p_actor: actor, p_key: key, p_value: value });
const current = async (key: string) => (await adminClient().from("platform_settings").select("*").eq("key", key).maybeSingle()).data as Record<string, unknown> | null;
const history = async (key: string) => must(await adminClient().from("platform_settings_history").select("*").eq("key", key).order("seq")) as { value: unknown; set_by: string }[];

beforeAll(async () => {
  [admin, member] = await Promise.all([person("settings-db-admin"), person("settings-db-member")]);
  must(await adminClient().from("platform_admins").insert({ user_id: admin.userId }).select("user_id"));
});

describe("platform_setting_set", () => {
  it("lets a platform admin set a value and records who and when", async () => {
    must(await set(admin.userId, "test.first_setting", { weekday: 5 }));

    const row = await current("test.first_setting");
    expect(row).toMatchObject({ key: "test.first_setting", value: { weekday: 5 }, set_by: admin.userId });
    expect(row?.set_at).toBeTruthy();
    expect(await history("test.first_setting")).toMatchObject([{ value: { weekday: 5 }, set_by: admin.userId }]);
  });

  it("keeps one row per key and one history line per change", async () => {
    must(await set(admin.userId, "test.second_setting", 1));
    must(await set(admin.userId, "test.second_setting", 2));

    expect((await current("test.second_setting"))?.value).toBe(2);
    expect((await history("test.second_setting")).map((h) => h.value)).toEqual([1, 2]);
  });

  it("puts a setting back to the default with a null, and records that too", async () => {
    must(await set(admin.userId, "test.third_setting", 3));
    must(await set(admin.userId, "test.third_setting", null));

    expect(await current("test.third_setting")).toBeNull();
    expect((await history("test.third_setting")).map((h) => h.value)).toEqual([3, null]);
  });

  it("answers 'not found' to a member, and writes nothing", async () => {
    const { error } = await set(member.userId, "test.member_setting", 1);

    expect(error?.code).toBe("P0002");
    expect(await current("test.member_setting")).toBeNull();
    expect(await history("test.member_setting")).toEqual([]);
  });

  it("answers 'not found' with no actor", async () => {
    expect((await set(null as unknown as string, "test.nobody_setting", 1)).error?.code).toBe("P0002");
  });

  it("refuses a key that is not dotted lower case", async () => {
    expect((await set(admin.userId, "BadKey", 1)).error).not.toBeNull();
    expect((await set(admin.userId, "nodot", 1)).error).not.toBeNull();
  });
});

describe("the history", () => {
  it("can never be changed or removed, even by the server's key", async () => {
    must(await set(admin.userId, "test.append_only", 1));
    const before = await history("test.append_only");

    // The server's key holds SELECT only, so these answer "permission denied" before any trigger runs.
    const update = await adminClient().from("platform_settings_history").update({ value: 9 }).eq("key", "test.append_only");
    const remove = await adminClient().from("platform_settings_history").delete().eq("key", "test.append_only");

    expect(update.error).not.toBeNull();
    expect(remove.error).not.toBeNull();
    expect(await history("test.append_only")).toEqual(before);
  });

  it("cannot be written directly", async () => {
    const { error } = await adminClient().from("platform_settings").insert({ key: "test.direct", value: 1 });
    const line = await adminClient().from("platform_settings_history").insert({ key: "test.direct", value: 1 });

    expect(error).not.toBeNull();
    expect(line.error).not.toBeNull();
  });
});

describe("browser access", () => {
  it("shows a member neither table", async () => {
    must(await set(admin.userId, "test.hidden_setting", 1));

    for (const table of ["platform_settings", "platform_settings_history"]) {
      const { data, error } = await member.client.from(table).select("*");
      expect(error !== null || (data ?? []).length === 0, table).toBe(true);
    }
  });

  it("shows an admin signed in as a person neither table: reads go through the server's key", async () => {
    for (const table of ["platform_settings", "platform_settings_history"]) {
      const { data, error } = await admin.client.from(table).select("*");
      expect(error !== null || (data ?? []).length === 0, table).toBe(true);
    }
  });

  it("shows a visitor nothing and refuses the function", async () => {
    const { data, error } = await anonClient().from("platform_settings").select("*");
    expect(error !== null || (data ?? []).length === 0).toBe(true);

    expect((await anonClient().rpc("platform_setting_set", { p_actor: admin.userId, p_key: "test.anon", p_value: 1 })).error).not.toBeNull();
    expect((await member.client.rpc("platform_setting_set", { p_actor: admin.userId, p_key: "test.member_rpc", p_value: 1 })).error).not.toBeNull();
    expect(await current("test.anon")).toBeNull();
    expect(await current("test.member_rpc")).toBeNull();
  });
});
