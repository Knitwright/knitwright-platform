import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * Share invites and who may open a link (plan v5 Y8, decision 0081). An invite's token opens one
 * open invite and nothing else; a link set to "Only invited people" opens nothing at all; one brand
 * never sees another's invites; and a browser can neither make, change nor withdraw one.
 */

const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_knitwright-platform";

/**
 * Runs SQL as the owner of the tables, which no API role is: the table takes no update from anyone
 * (there is no update policy and no update grant, on purpose), so only its owner can age an invite.
 * The same shape as `job-packets.test.ts`, which ages a factory link for the same reason.
 */
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

const token = (): string => randomBytes(32).toString("base64url");
const address = (): string => `chair-${randomUUID().slice(0, 8)}@northside.test`;

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
      p_spec: { made: "for the invite test", version: 1 },
      p_schema_version: 1,
    }),
  ) as string;

type Invited = { id: string; expires_at: string; replaced: boolean };

const invite = async (
  projectId: string,
  owner: Person,
  patch: Record<string, unknown> = {},
): Promise<Invited & { token: string; email: string }> => {
  const secret = (patch.p_token as string) ?? token();
  const email = (patch.p_email as string) ?? address();
  const rows = must(
    await adminClient().rpc("create_share_invite", {
      p_project_id: projectId,
      p_user_id: owner.userId,
      p_email: email,
      p_access: "comment",
      p_message: "Have a look at the away kit.",
      p_days: 30,
      ...patch,
      p_token: secret,
    }),
  ) as Invited[];
  return { ...(rows[0] as Invited), token: secret, email };
};

const share = async (projectId: string, owner: Person): Promise<{ id: string; token: string }> => {
  const secret = token();
  const rows = must(
    await adminClient().rpc("create_share_link", { p_project_id: projectId, p_user_id: owner.userId, p_token: secret, p_days: 30 }),
  ) as { id: string }[];
  return { id: (rows[0] as { id: string }).id, token: secret };
};

const openInvite = async (secret: string) => must(await adminClient().rpc("open_share_invite", { p_token: secret })) as Record<string, unknown>[];
const openLink = async (secret: string) => must(await adminClient().rpc("open_share", { p_token: secret })) as Record<string, unknown>[];

beforeAll(async () => {
  [alice, bob] = await Promise.all([person("invite-alice"), person("invite-bob")]);
  aliceBrand = await brandOf(alice, "Invite Hockey Club");
  bobBrand = await brandOf(bob, "Invite Soccer Club");
});

describe("create_share_invite", () => {
  it("keeps only the token's hash, so the token cannot be read back", async () => {
    const designId = await project(aliceBrand, alice);
    const made = await invite(designId, alice);
    const row = must(await adminClient().from("share_invites").select("token_hash, email, access, message, email_sent_at, accepted_at").eq("id", made.id).single());
    expect(String(row.token_hash)).not.toContain(made.token);
    expect(row).toMatchObject({ email: made.email, access: "comment", email_sent_at: null, accepted_at: null });
    expect(row.message).toBe("Have a look at the away kit.");
  });

  it("keeps one address lower case, so the same person cannot be invited twice under two spellings", async () => {
    const designId = await project(aliceBrand, alice);
    const first = await invite(designId, alice, { p_email: "Chair@Northside.TEST" });
    expect(first.replaced).toBe(false);
    const again = await invite(designId, alice, { p_email: "  chair@northside.test  ", p_access: "view" });
    expect(again.replaced).toBe(true);
    expect(again.id).toBe(first.id);
    const rows = must(await adminClient().from("share_invites").select("id, email, access").eq("project_id", designId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: "chair@northside.test", access: "view" });
  });

  it("gives a replaced invite the new token, and the one sent before stops working", async () => {
    const designId = await project(aliceBrand, alice);
    const first = await invite(designId, alice, { p_email: "chair@northside.test" });
    expect(await openInvite(first.token)).toHaveLength(1);
    const again = await invite(designId, alice, { p_email: "chair@northside.test", p_access: "edit" });
    expect(await openInvite(first.token)).toEqual([]);
    const opened = await openInvite(again.token);
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({ invite_id: first.id, access: "edit" });
  });

  it("refuses another brand's design, an address that is not one, and an access level that is not offered", async () => {
    const designId = await project(aliceBrand, alice);
    expect((await adminClient().rpc("create_share_invite", { p_project_id: designId, p_user_id: bob.userId, p_email: address(), p_access: "view", p_message: "", p_token: token(), p_days: 30 })).error).not.toBeNull();
    for (const bad of ["chair", "chair@northside", "", "a b@c.test"]) {
      expect((await adminClient().rpc("create_share_invite", { p_project_id: designId, p_user_id: alice.userId, p_email: bad, p_access: "view", p_message: "", p_token: token(), p_days: 30 })).error, bad).not.toBeNull();
    }
    expect((await adminClient().rpc("create_share_invite", { p_project_id: designId, p_user_id: alice.userId, p_email: address(), p_access: "owner", p_message: "", p_token: token(), p_days: 30 })).error).not.toBeNull();
    expect((await adminClient().rpc("create_share_invite", { p_project_id: designId, p_user_id: alice.userId, p_email: address(), p_access: "view", p_message: "", p_token: "short", p_days: 30 })).error).not.toBeNull();
    expect((await adminClient().rpc("create_share_invite", { p_project_id: designId, p_user_id: alice.userId, p_email: address(), p_access: "view", p_message: "", p_token: token(), p_days: 5 })).error).not.toBeNull();
  });
});

describe("open_share_invite", () => {
  it("opens the design's newest version and records that the invite was taken up", async () => {
    const designId = await project(aliceBrand, alice);
    const made = await invite(designId, alice);
    const rows = await openInvite(made.token);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ invite_id: made.id, brand_id: aliceBrand, project_name: "Home kit 2027", access: "comment", version: 1 });
    const row = must(await adminClient().from("share_invites").select("accepted_at").eq("id", made.id).single());
    expect(row.accepted_at).not.toBeNull();
  });

  it.skipIf(!dockerReachable)(
    "opens nothing for an unknown token, a withdrawn invite or one that has run out, and says the same about each",
    async () => {
      const designId = await project(aliceBrand, alice);
      expect(await openInvite(token())).toEqual([]);
      const withdrawn = await invite(designId, alice);
      must(await adminClient().rpc("revoke_share_invite", { p_invite_id: withdrawn.id, p_user_id: alice.userId }));
      expect(await openInvite(withdrawn.token)).toEqual([]);
      const over = await invite(designId, alice);
      asOwner(`update public.share_invites set expires_at = now() - interval '1 second' where id = '${over.id}'`);
      expect(await openInvite(over.token)).toEqual([]);
    },
  );

  it("is open to the server's own key alone", async () => {
    const designId = await project(aliceBrand, alice);
    const made = await invite(designId, alice);
    expect((await anonClient().rpc("open_share_invite", { p_token: made.token })).error).not.toBeNull();
    expect((await alice.client.rpc("open_share_invite", { p_token: made.token })).error).not.toBeNull();
  });
});

describe("set_share_link_audience", () => {
  it("starts every link at anyone with the link, which is what was built before", async () => {
    const designId = await project(aliceBrand, alice);
    const link = await share(designId, alice);
    const row = must(await adminClient().from("share_links").select("audience").eq("id", link.id).single());
    expect(row.audience).toBe("anyone");
    expect(await openLink(link.token)).toHaveLength(1);
  });

  it("makes a link set to only invited people open nothing at all, and opens it again when it is widened", async () => {
    const designId = await project(aliceBrand, alice);
    const link = await share(designId, alice);
    must(await adminClient().rpc("set_share_link_audience", { p_link_id: link.id, p_user_id: alice.userId, p_audience: "invited" }));
    expect(await openLink(link.token)).toEqual([]);
    must(await adminClient().rpc("set_share_link_audience", { p_link_id: link.id, p_user_id: alice.userId, p_audience: "anyone" }));
    expect(await openLink(link.token)).toHaveLength(1);
  });

  it("refuses another brand's link, an audience that is not offered, and a browser", async () => {
    const designId = await project(aliceBrand, alice);
    const link = await share(designId, alice);
    expect((await adminClient().rpc("set_share_link_audience", { p_link_id: link.id, p_user_id: bob.userId, p_audience: "invited" })).error).not.toBeNull();
    expect((await adminClient().rpc("set_share_link_audience", { p_link_id: link.id, p_user_id: alice.userId, p_audience: "everyone" })).error).not.toBeNull();
    expect((await alice.client.rpc("set_share_link_audience", { p_link_id: link.id, p_user_id: alice.userId, p_audience: "invited" })).error).not.toBeNull();
  });
});

describe("revoke_share_invite and share_invite_emailed", () => {
  it("withdraws an invite once, and withdrawing it again changes nothing", async () => {
    const designId = await project(aliceBrand, alice);
    const made = await invite(designId, alice);
    must(await adminClient().rpc("revoke_share_invite", { p_invite_id: made.id, p_user_id: alice.userId }));
    const first = must(await adminClient().from("share_invites").select("revoked_at").eq("id", made.id).single());
    must(await adminClient().rpc("revoke_share_invite", { p_invite_id: made.id, p_user_id: alice.userId }));
    const second = must(await adminClient().from("share_invites").select("revoked_at").eq("id", made.id).single());
    expect(second.revoked_at).toBe(first.revoked_at);
  });

  it("records an email only when it is told one went out", async () => {
    const designId = await project(aliceBrand, alice);
    const made = await invite(designId, alice);
    must(await adminClient().rpc("share_invite_emailed", { p_invite_id: made.id, p_user_id: alice.userId }));
    expect(must(await adminClient().from("share_invites").select("email_sent_at").eq("id", made.id).single()).email_sent_at).not.toBeNull();
  });

  it("gives another brand's invite and a missing one the same answer", async () => {
    const designId = await project(aliceBrand, alice);
    const made = await invite(designId, alice);
    expect((await adminClient().rpc("revoke_share_invite", { p_invite_id: made.id, p_user_id: bob.userId })).error).not.toBeNull();
    expect((await adminClient().rpc("revoke_share_invite", { p_invite_id: randomUUID(), p_user_id: alice.userId })).error).not.toBeNull();
    expect((await adminClient().rpc("share_invite_emailed", { p_invite_id: made.id, p_user_id: bob.userId })).error).not.toBeNull();
  });
});

describe("who may read an invite", () => {
  it("lets a member read their own brand's invites and never another brand's", async () => {
    const mine = await project(aliceBrand, alice);
    const theirs = await project(bobBrand, bob);
    const made = await invite(mine, alice);
    await invite(theirs, bob);
    const read = must(await alice.client.from("share_invites").select("id, email").eq("project_id", mine));
    expect(read.map((row: { id: string }) => row.id)).toContain(made.id);
    expect(must(await alice.client.from("share_invites").select("id").eq("project_id", theirs))).toEqual([]);
    expect((await anonClient().from("share_invites").select("id")).error).not.toBeNull();
  });
});
