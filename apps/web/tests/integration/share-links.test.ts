import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * Share links and the answers left through them. Decision 0026. A token opens one open link and
 * nothing else; one brand never sees another's links or answers; one browser keeps one answer.
 */

const token = (): string => randomBytes(32).toString("base64url");

const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_knitwright-platform";

/** Runs SQL as the owner of the tables, which no API role is. */
const asOwner = (sql: string): string =>
  execFileSync("docker", ["exec", CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15_000,
  });

const dockerReachable = (() => {
  try {
    asOwner("select 1");
    return true;
  } catch {
    return false;
  }
})();

let alice: Person;
let bob: Person;
let aliceBrand: string;
let bobBrand: string;

const project = async (brandId: string, owner: Person): Promise<string> =>
  must(
    await adminClient().rpc("create_project", {
      p_brand_id: brandId,
      p_user_id: owner.userId,
      p_name: "Home kit 2027",
      p_style_number: "",
      p_season: "",
      p_garment_type: "crew-tee",
      p_spec: { made: "for the test", version: 1 },
      p_schema_version: 1,
    }),
  ) as string;

const nextVersion = async (projectId: string, owner: Person, expected: number) =>
  must(
    await adminClient().rpc("append_spec_version", {
      p_project_id: projectId,
      p_user_id: owner.userId,
      p_expected_version: expected,
      p_spec: { made: "again", version: expected + 1 },
      p_schema_version: 1,
      p_note: "Changed.",
      p_restored_from: null,
    }),
  );

type Created = { id: string; version: number; expires_at: string };

const share = async (projectId: string, owner: Person, secret = token(), days = 30): Promise<Created & { token: string }> => {
  const rows = must(
    await adminClient().rpc("create_share_link", {
      p_project_id: projectId,
      p_user_id: owner.userId,
      p_token: secret,
      p_days: days,
    }),
  ) as Created[];
  return { ...rows[0], token: secret };
};

const open = async (secret: string) => must(await adminClient().rpc("open_share", { p_token: secret })) as Record<string, unknown>[];

const respond = (secret: string, visitor: string, patch: Record<string, unknown> = {}) =>
  adminClient().rpc("share_respond", {
    p_token: secret,
    p_visitor_key: visitor,
    p_name: "Sam",
    p_vote: "yes",
    p_comment: null,
    ...patch,
  });

const answersOf = async (linkId: string) =>
  must(await adminClient().from("share_responses").select("*").eq("link_id", linkId));

beforeAll(async () => {
  [alice, bob] = await Promise.all([person("share-alice"), person("share-bob")]);
  aliceBrand = await brandOf(alice, "Alice Hockey Club");
  bobBrand = await brandOf(bob, "Bob Soccer Club");
});

describe("create_share_link", () => {
  it("points at the newest version, keeps only a hash of the token and expires after the days chosen", async () => {
    const id = await project(aliceBrand, alice);
    await nextVersion(id, alice, 1);
    const link = await share(id, alice, token(), 7);

    expect(link.version).toBe(2);
    const row = must(await adminClient().from("share_links").select("*").eq("id", link.id).single()) as Record<string, unknown>;
    expect(row).toMatchObject({ brand_id: aliceBrand, project_id: id, version: 2, created_by: alice.userId, revoked_at: null });
    expect(JSON.stringify(row)).not.toContain(link.token);
    const days = (Date.parse(String(row.expires_at)) - Date.parse(String(row.created_at))) / 86_400_000;
    expect(Math.round(days)).toBe(7);
  });

  it("refuses another brand's design, a missing design, a bad token and a length other than 7, 30 or 90 days", async () => {
    const theirs = await project(bobBrand, bob);
    const call = (patch: Record<string, unknown>) =>
      adminClient().rpc("create_share_link", { p_project_id: theirs, p_user_id: bob.userId, p_token: token(), p_days: 30, ...patch });

    expect((await call({ p_user_id: alice.userId })).error?.message).toBe("That design does not exist.");
    expect((await call({ p_project_id: crypto.randomUUID() })).error?.message).toBe("That design does not exist.");
    expect((await call({ p_token: "short" })).error).not.toBeNull();
    expect((await call({ p_days: 31 })).error).not.toBeNull();
  });

  it("cannot be run by a browser, signed in or not", async () => {
    const id = await project(aliceBrand, alice);
    const args = { p_project_id: id, p_user_id: alice.userId, p_token: token(), p_days: 30 };

    expect((await alice.client.rpc("create_share_link", args)).error).not.toBeNull();
    expect((await anonClient().rpc("create_share_link", args)).error).not.toBeNull();
  });
});

describe("open_share", () => {
  it("returns the version the link points at, with the design's and the brand's names", async () => {
    const id = await project(aliceBrand, alice);
    const link = await share(id, alice);
    await nextVersion(id, alice, 1);

    const [row] = await open(link.token);
    expect(row).toMatchObject({
      link_id: link.id,
      brand_id: aliceBrand,
      brand_name: "Alice Hockey Club",
      project_name: "Home kit 2027",
      version: 1,
      is_current: false,
      spec: { made: "for the test", version: 1 },
    });
  });

  it("returns nothing for a wrong token, a revoked link and an expired link", async () => {
    const id = await project(aliceBrand, alice);
    const revoked = await share(id, alice);
    must(await adminClient().rpc("revoke_share_link", { p_link_id: revoked.id, p_user_id: alice.userId }));

    expect(await open(token())).toEqual([]);
    expect(await open("")).toEqual([]);
    expect(await open(revoked.token)).toEqual([]);
  });

  // No role the API offers may change a link's dates, so the table's owner ages one through psql
  // in the database container, as append-only-owner.test.ts does. Skipped without Docker.
  it.skipIf(!dockerReachable)("returns nothing for an expired link", async () => {
    const expired = await share(await project(aliceBrand, alice), alice);
    expect(await open(expired.token)).toHaveLength(1);

    asOwner(
      `update public.share_links set created_at = now() - interval '40 days', expires_at = now() - interval '1 second' where id = '${expired.id}'`,
    );

    expect(await open(expired.token)).toEqual([]);
    expect((await respond(expired.token, token())).error?.message).toBe("That link does not exist.");
  });

  it("cannot be run by a browser, signed in or not", async () => {
    const link = await share(await project(aliceBrand, alice), alice);

    expect((await anonClient().rpc("open_share", { p_token: link.token })).error).not.toBeNull();
    expect((await alice.client.rpc("open_share", { p_token: link.token })).error).not.toBeNull();
  });
});

describe("revoke_share_link and move_share_link", () => {
  it("lets only a member of the brand revoke or move a link, with one answer for missing and theirs", async () => {
    const link = await share(await project(bobBrand, bob), bob);

    const revoke = await adminClient().rpc("revoke_share_link", { p_link_id: link.id, p_user_id: alice.userId });
    const move = await adminClient().rpc("move_share_link", { p_link_id: link.id, p_user_id: alice.userId });
    const missing = await adminClient().rpc("revoke_share_link", { p_link_id: crypto.randomUUID(), p_user_id: bob.userId });

    expect(revoke.error?.message).toBe("That link does not exist.");
    expect(move.error?.message).toBe("That link does not exist.");
    expect(missing.error?.message).toBe("That link does not exist.");
    expect(await open(link.token)).toHaveLength(1);
  });

  it("moves an open link to the newest version, and refuses to move a revoked one", async () => {
    const id = await project(aliceBrand, alice);
    const link = await share(id, alice);
    await nextVersion(id, alice, 1);
    await nextVersion(id, alice, 2);

    expect(must(await adminClient().rpc("move_share_link", { p_link_id: link.id, p_user_id: alice.userId }))).toBe(3);
    expect((await open(link.token))[0]).toMatchObject({ version: 3, is_current: true });

    must(await adminClient().rpc("revoke_share_link", { p_link_id: link.id, p_user_id: alice.userId }));
    const moved = await adminClient().rpc("move_share_link", { p_link_id: link.id, p_user_id: alice.userId });
    expect(moved.error?.message).toBe("That link no longer works. Make a new one.");
  });
});

describe("share_respond", () => {
  it("keeps one answer per browser: a second vote replaces the first, a comment is added to it", async () => {
    const link = await share(await project(aliceBrand, alice), alice);
    const visitor = token();

    must(await respond(link.token, visitor, { p_vote: "yes" }));
    must(await respond(link.token, visitor, { p_vote: "not_yet", p_name: "Sam K" }));
    must(await respond(link.token, visitor, { p_vote: null, p_name: "Sam K", p_comment: "  Navy sleeves please.  " }));

    const rows = await answersOf(link.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ brand_id: aliceBrand, name: "Sam K", vote: "not_yet", comment: "Navy sleeves please." });
    expect(JSON.stringify(rows[0])).not.toContain(visitor);
  });

  it("keeps the answers of two browsers apart", async () => {
    const link = await share(await project(aliceBrand, alice), alice);

    must(await respond(link.token, token(), { p_vote: "yes" }));
    must(await respond(link.token, token(), { p_vote: "not_yet" }));

    expect((await answersOf(link.id)).map((row) => row.vote).sort()).toEqual(["not_yet", "yes"]);
  });

  it("refuses a wrong token and a revoked link with the same message, and keeps nothing", async () => {
    const link = await share(await project(aliceBrand, alice), alice);
    must(await adminClient().rpc("revoke_share_link", { p_link_id: link.id, p_user_id: alice.userId }));

    expect((await respond(token(), token())).error?.message).toBe("That link does not exist.");
    expect((await respond(link.token, token())).error?.message).toBe("That link does not exist.");
    expect(await answersOf(link.id)).toEqual([]);
  });

  it("refuses an empty answer, a long name, a long comment, an unknown vote and a bad visitor key", async () => {
    const link = await share(await project(aliceBrand, alice), alice);

    expect((await respond(link.token, token(), { p_vote: null, p_comment: "   " })).error).not.toBeNull();
    expect((await respond(link.token, token(), { p_name: "x".repeat(61) })).error).not.toBeNull();
    expect((await respond(link.token, token(), { p_name: "  " })).error).not.toBeNull();
    expect((await respond(link.token, token(), { p_comment: "x".repeat(1001) })).error).not.toBeNull();
    expect((await respond(link.token, token(), { p_vote: "maybe" })).error).not.toBeNull();
    expect((await respond(link.token, "not-a-key")).error).not.toBeNull();
    expect(await answersOf(link.id)).toEqual([]);
  });

  it("cannot be run by a browser, signed in or not", async () => {
    const link = await share(await project(aliceBrand, alice), alice);
    const args = { p_token: link.token, p_visitor_key: token(), p_name: "Sam", p_vote: "yes", p_comment: null };

    expect((await anonClient().rpc("share_respond", args)).error).not.toBeNull();
    expect((await alice.client.rpc("share_respond", args)).error).not.toBeNull();
  });
});

describe("what members see", () => {
  it("shows a member their own brand's links and answers, and nothing of another brand's", async () => {
    const mine = await share(await project(aliceBrand, alice), alice);
    const theirs = await share(await project(bobBrand, bob), bob);
    must(await respond(mine.token, token()));
    must(await respond(theirs.token, token()));

    const links = must(await alice.client.from("share_links").select("id, brand_id"));
    const answers = must(await alice.client.from("share_responses").select("link_id, brand_id"));

    expect(links.some((row) => row.id === mine.id)).toBe(true);
    expect(links.every((row) => row.brand_id === aliceBrand)).toBe(true);
    expect(answers.some((row) => row.link_id === mine.id)).toBe(true);
    expect(answers.every((row) => row.brand_id === aliceBrand)).toBe(true);
    expect(must(await alice.client.from("share_responses").select("id").eq("link_id", theirs.id))).toEqual([]);
  });
});

describe("deletion", () => {
  it("deleting a design removes its links and their answers", async () => {
    const id = await project(aliceBrand, alice);
    const link = await share(id, alice);
    must(await respond(link.token, token()));

    must(await adminClient().rpc("delete_project", { p_project_id: id, p_brand_id: aliceBrand, p_user_id: alice.userId }));

    expect(must(await adminClient().from("share_links").select("id").eq("id", link.id))).toEqual([]);
    expect(await answersOf(link.id)).toEqual([]);
  });

  it("deleting an account removes its brands' links and answers", async () => {
    const carol = await person("share-carol");
    const brand = await brandOf(carol, "Carol Netball");
    const link = await share(await project(brand, carol), carol);
    must(await respond(link.token, token()));

    must(await adminClient().rpc("delete_account_data", { p_user_id: carol.userId }));

    expect(must(await adminClient().from("share_links").select("id").eq("brand_id", brand))).toEqual([]);
    expect(must(await adminClient().from("share_responses").select("id").eq("brand_id", brand))).toEqual([]);
  });
});
