import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * Committee links and roster sign-up (spec F-T3 and F-T4, plan v5 Z7, decision 0086).
 *
 * Both are public, unauthenticated links, so this file is mostly about what a token may NOT reach:
 * a committee token opens its design's shared versions and nothing else, a sign-up token opens its
 * season's rules and nothing else, neither opens the other's, and no browser role — signed in or
 * not — may run any of the functions or write any of the rows. An approval and a lock are records:
 * the table's own owner cannot change one.
 *
 * A person may belong to at most 3 brands, so every club here has a person of its own.
 */

const token = (): string => randomBytes(32).toString("base64url");
const visitor = (): string => randomBytes(32).toString("base64url");

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
let viewer: Person;
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

const nextVersion = (projectId: string, owner: Person, expected: number) =>
  adminClient().rpc("append_spec_version", {
    p_project_id: projectId,
    p_user_id: owner.userId,
    p_expected_version: expected,
    p_spec: { made: "again", version: expected + 1 },
    p_schema_version: 1,
    p_note: "Changed.",
    p_restored_from: null,
  });

type MadeLink = { id: string; token: string; projectId: string };

const committeeLink = async (
  projectId: string,
  owner: Person,
  versions: number[] = [1],
  secret = token(),
): Promise<MadeLink> => {
  const rows = must(
    await adminClient().rpc("create_committee_link", {
      p_project_id: projectId,
      p_user_id: owner.userId,
      p_token: secret,
      p_versions: versions,
    }),
  ) as { id: string }[];
  return { id: rows[0]!.id, token: secret, projectId };
};

const openCommittee = async (secret: string) =>
  must(await adminClient().rpc("open_committee", { p_token: secret })) as Record<string, unknown>[];

const pin = (secret: string, key: string, patch: Record<string, unknown> = {}) =>
  adminClient().rpc("committee_pin", {
    p_token: secret,
    p_visitor_key: key,
    p_name: "Sam",
    p_version: 1,
    p_panel_id: "body-front",
    p_x_mm: 10.5,
    p_y_mm: 20,
    p_body: "Navy sleeves please.",
    ...patch,
  });

const vote = (secret: string, key: string, patch: Record<string, unknown> = {}) =>
  adminClient().rpc("committee_vote", { p_token: secret, p_visitor_key: key, p_name: "Kim", p_slot: "A", ...patch });

const approve = (secret: string, key: string, patch: Record<string, unknown> = {}) =>
  adminClient().rpc("committee_approve", { p_token: secret, p_visitor_key: key, p_name: "Dana", p_email: null, p_version: 1, ...patch });

const validate = (projectId: string, brandId: string, owner: Person, version = 1) =>
  adminClient().rpc("set_design_status", {
    p_project_id: projectId,
    p_brand_id: brandId,
    p_user_id: owner.userId,
    p_version: version,
    p_status: "validated",
    p_profile_id: "knitwright-default",
    p_findings_hash: "c".repeat(64),
  });

const statusOf = async (projectId: string, version = 1): Promise<string | undefined> =>
  (
    must(await adminClient().from("design_statuses").select("status").eq("project_id", projectId).eq("version", version).single()) as
      | { status: string }
      | null
  )?.status;

const season = async (brandId: string, owner: Person): Promise<string> =>
  must(
    await adminClient().rpc("create_club_season", {
      p_brand_id: brandId,
      p_user_id: owner.userId,
      p_name: `Season ${randomUUID().slice(0, 8)}`,
      p_starts_on: null,
      p_ends_on: null,
    }),
  ) as string;

const signupLink = async (brandId: string, owner: Person, seasonId: string, sport = "football", secret = token()) => {
  const rows = must(
    await adminClient().rpc("create_roster_signup_link", {
      p_brand_id: brandId,
      p_user_id: owner.userId,
      p_season_id: seasonId,
      p_token: secret,
      p_sport: sport,
    }),
  ) as { id: string }[];
  return { id: rows[0]!.id, token: secret, seasonId };
};

const openSignup = async (secret: string) =>
  must(await adminClient().rpc("open_roster_signup", { p_token: secret })) as Record<string, unknown>[];

const submit = (secret: string, key: string, patch: Record<string, unknown> = {}) =>
  adminClient().rpc("roster_signup_submit", {
    p_token: secret,
    p_visitor_key: key,
    p_name: "MORGAN",
    p_number: "7",
    p_size_label: "M",
    p_wearer_group: "mens",
    ...patch,
  });

/** A viewer of the club, joined the way the club workspace joins one (decision 0042). */
const joinAsViewer = async (brandId: string, ownerId: string, guest: Person): Promise<void> => {
  must(await adminClient().rpc("invite_member", { p_brand_id: brandId, p_user_id: ownerId, p_email: guest.email, p_role: "viewer" }));
  const invitations = must(await guest.client.rpc("my_club_invitations")) as { id: string; brand_id: string }[];
  const mine = invitations.find((invitation) => invitation.brand_id === brandId);
  must(await adminClient().rpc("accept_invitation", { p_user_id: guest.userId, p_invitation_id: mine?.id }));
};

beforeAll(async () => {
  [alice, bob, viewer] = await Promise.all([person("committee-alice"), person("committee-bob"), person("committee-viewer")]);
  aliceBrand = await brandOf(alice, "Alice Hockey Club");
  bobBrand = await brandOf(bob, "Bob Soccer Club");
  await joinAsViewer(aliceBrand, alice.userId, viewer);
});

describe("the rows behind the rules", () => {
  it("carry the rule that explains each one, and a note saying where it came from", async () => {
    const windows = must(await adminClient().from("public_link_windows").select("*")) as { kind: string; days: number; rule_id: string; note: string }[];
    const sports = must(await adminClient().from("sport_number_rules").select("*")) as { sport: string; lowest: number; highest: number; rule_id: string; note: string }[];
    const zones = must(await adminClient().from("shirt_zone_limits").select("*")) as { zone: string; max_characters: number; rule_id: string }[];

    expect(windows.find((row) => row.kind === "committee")).toMatchObject({ days: 30, rule_id: "R-GAP-000" });
    expect(sports.find((row) => row.sport === "default")).toMatchObject({ lowest: 0, highest: 99 });
    // R-PER-001 is a real rulebook entry; everything else here says R-GAP-000 rather than inventing one.
    expect(zones.find((row) => row.zone === "back-name")).toMatchObject({ max_characters: 12, rule_id: "R-PER-001" });
    for (const row of [...windows, ...sports]) expect(row.note.length).toBeGreaterThan(0);
  });

  it("are read by nobody with a browser, signed in or not", async () => {
    for (const table of ["public_link_windows", "sport_number_rules", "shirt_zone_limits", "chase_templates"]) {
      expect((await alice.client.from(table).select("*")).data ?? [], table).toEqual([]);
      expect((await anonClient().from(table).select("*")).data ?? [], table).toEqual([]);
    }
  });
});

describe("create_committee_link", () => {
  it("keeps only a hash of the token and lasts as long as its row says", async () => {
    const id = await project(aliceBrand, alice);
    const link = await committeeLink(id, alice);

    const row = must(await adminClient().from("committee_links").select("*").eq("id", link.id).single()) as Record<string, unknown>;
    expect(row).toMatchObject({ brand_id: aliceBrand, project_id: id, created_by: alice.userId, revoked_at: null });
    expect(JSON.stringify(row)).not.toContain(link.token);
    const days = (Date.parse(String(row.expires_at)) - Date.parse(String(row.created_at))) / 86_400_000;
    expect(Math.round(days)).toBe(30);
  });

  it("fills the slots A, B and C in the order the versions were given", async () => {
    const id = await project(aliceBrand, alice);
    must(await nextVersion(id, alice, 1));
    must(await nextVersion(id, alice, 2));
    const link = await committeeLink(id, alice, [3, 1]);

    const slots = must(await adminClient().from("committee_link_versions").select("slot, version").eq("link_id", link.id).order("slot")) as {
      slot: string;
      version: number;
    }[];
    expect(slots).toEqual([
      { slot: "A", version: 3 },
      { slot: "B", version: 1 },
    ]);
  });

  it("refuses another club's design, a bad token, no version, four versions, a repeat and a version that is not there", async () => {
    const theirs = await project(bobBrand, bob);
    const call = (patch: Record<string, unknown>) =>
      adminClient().rpc("create_committee_link", { p_project_id: theirs, p_user_id: bob.userId, p_token: token(), p_versions: [1], ...patch });

    expect((await call({ p_user_id: alice.userId })).error?.message).toBe("That design does not exist.");
    expect((await call({ p_project_id: randomUUID() })).error?.message).toBe("That design does not exist.");
    expect((await call({ p_token: "short" })).error).not.toBeNull();
    expect((await call({ p_versions: [] })).error?.message).toContain("1 to 3 versions");
    expect((await call({ p_versions: [1, 2, 3, 4] })).error?.message).toContain("1 to 3 versions");
    expect((await call({ p_versions: [1, 1] })).error?.message).toContain("shown once");
    expect((await call({ p_versions: [9] })).error?.message).toBe("That version of the design does not exist.");
  });

  it("refuses a role in the club that may not manage the kit", async () => {
    const id = await project(aliceBrand, alice);
    const refused = await adminClient().rpc("create_committee_link", {
      p_project_id: id,
      p_user_id: viewer.userId,
      p_token: token(),
      p_versions: [1],
    });

    expect(refused.error?.message).toContain("does not allow that");
  });

  it("cannot be run by a browser, signed in or not", async () => {
    const id = await project(aliceBrand, alice);
    const args = { p_project_id: id, p_user_id: alice.userId, p_token: token(), p_versions: [1] };

    expect((await alice.client.rpc("create_committee_link", args)).error).not.toBeNull();
    expect((await anonClient().rpc("create_committee_link", args)).error).not.toBeNull();
  });
});

describe("open_committee", () => {
  it("gives one row per option, with the club's and the design's names", async () => {
    const id = await project(aliceBrand, alice);
    must(await nextVersion(id, alice, 1));
    const link = await committeeLink(id, alice, [2, 1]);

    const rows = await openCommittee(link.token);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      link_id: link.id,
      brand_id: aliceBrand,
      brand_name: "Alice Hockey Club",
      project_name: "Home kit 2027",
      slot: "A",
      version: 2,
      is_current: true,
      locked_version: null,
    });
    expect(rows[1]).toMatchObject({ slot: "B", version: 1, is_current: false });
  });

  it("gives nothing for a wrong token, an empty one and a withdrawn link", async () => {
    const link = await committeeLink(await project(aliceBrand, alice), alice);
    must(await adminClient().rpc("revoke_committee_link", { p_link_id: link.id, p_user_id: alice.userId }));

    expect(await openCommittee(token())).toEqual([]);
    expect(await openCommittee("")).toEqual([]);
    expect(await openCommittee(link.token)).toEqual([]);
  });

  // No role the API offers may change a link's dates, so the table's owner ages one through psql in
  // the database container, as share-links.test.ts does. Skipped without Docker.
  it.skipIf(!dockerReachable)("gives nothing once the link has run out, and takes nothing more", async () => {
    const link = await committeeLink(await project(aliceBrand, alice), alice);
    expect(await openCommittee(link.token)).toHaveLength(1);

    asOwner(
      `update public.committee_links set created_at = now() - interval '40 days', expires_at = now() - interval '1 second' where id = '${link.id}'`,
    );

    expect(await openCommittee(link.token)).toEqual([]);
    expect((await pin(link.token, visitor())).error?.message).toBe("That link does not exist.");
    expect((await vote(link.token, visitor())).error?.message).toBe("That link does not exist.");
    expect((await approve(link.token, visitor())).error?.message).toBe("That link does not exist.");
  });

  it("cannot be run by a browser, signed in or not", async () => {
    const link = await committeeLink(await project(aliceBrand, alice), alice);

    expect((await alice.client.rpc("open_committee", { p_token: link.token })).error).not.toBeNull();
    expect((await anonClient().rpc("open_committee", { p_token: link.token })).error).not.toBeNull();
  });
});

describe("a token reaches nothing but what its link is for", () => {
  it("opens no other kind of link, in either direction", async () => {
    const committee = await committeeLink(await project(aliceBrand, alice), alice);
    const signup = await signupLink(aliceBrand, alice, await season(aliceBrand, alice));

    expect(await openSignup(committee.token)).toEqual([]);
    expect(await openCommittee(signup.token)).toEqual([]);
    // A share link is a third kind, and a committee token is not one of those either (decision 0026).
    expect(must(await adminClient().rpc("open_share", { p_token: committee.token }))).toEqual([]);
  });

  it("writes nothing through another kind of link's functions", async () => {
    const committee = await committeeLink(await project(aliceBrand, alice), alice);
    const signup = await signupLink(aliceBrand, alice, await season(aliceBrand, alice));

    expect((await submit(committee.token, visitor())).error?.message).toBe("That link does not exist.");
    expect((await pin(signup.token, visitor())).error?.message).toBe("That link does not exist.");
    expect((await vote(signup.token, visitor())).error?.message).toBe("That link does not exist.");
    expect((await approve(signup.token, visitor())).error?.message).toBe("That link does not exist.");
    expect(
      (await adminClient().rpc("share_respond", { p_token: committee.token, p_visitor_key: visitor(), p_name: "Sam", p_vote: "yes", p_comment: null }))
        .error?.message,
    ).toBe("That link does not exist.");
  });

  it("names only its own design's versions: a version of another design cannot be pinned or approved", async () => {
    const mine = await project(aliceBrand, alice);
    must(await nextVersion(mine, alice, 1));
    const link = await committeeLink(mine, alice, [1]);

    expect((await pin(link.token, visitor(), { p_version: 2 })).error?.message).toBe("That version is not on this link.");
    expect((await approve(link.token, visitor(), { p_version: 2 })).error?.message).toBe("That version is not on this link.");
    expect((await vote(link.token, visitor(), { p_slot: "B" })).error?.message).toBe("That choice is not on this link.");
  });

  it("shows one club nothing of another's links, comments, votes, approvals or locks", async () => {
    const theirs = await committeeLink(await project(bobBrand, bob), bob);
    must(await pin(theirs.token, visitor()));
    must(await vote(theirs.token, visitor()));
    must(await approve(theirs.token, visitor()));

    for (const table of ["committee_links", "committee_link_versions", "committee_pins", "committee_votes", "committee_approvals"]) {
      const rows = must(await alice.client.from(table).select("*")) as { brand_id?: string }[];
      expect(rows.every((row) => row.brand_id !== bobBrand), table).toBe(true);
    }
  });
});

describe("what a committee leaves", () => {
  it("keeps a pin against the version and the point it was left on", async () => {
    const link = await committeeLink(await project(aliceBrand, alice), alice);
    must(await pin(link.token, visitor()));

    const row = must(await adminClient().from("committee_pins").select("*").eq("link_id", link.id).single()) as Record<string, unknown>;
    expect(row).toMatchObject({ brand_id: aliceBrand, version: 1, name: "Sam", panel_id: "body-front", body: "Navy sleeves please." });
    expect(Number(row.x_mm)).toBe(10.5);
  });

  it("takes a second pin from the same browser as a second comment, as a thread does", async () => {
    const link = await committeeLink(await project(aliceBrand, alice), alice);
    const key = visitor();
    must(await pin(link.token, key));
    must(await pin(link.token, key, { p_body: "And a lighter blue." }));

    expect(must(await adminClient().from("committee_pins").select("id").eq("link_id", link.id))).toHaveLength(2);
  });

  it("replaces one browser's vote rather than adding a second", async () => {
    const id = await project(aliceBrand, alice);
    must(await nextVersion(id, alice, 1));
    const link = await committeeLink(id, alice, [1, 2]);
    const key = visitor();
    must(await vote(link.token, key, { p_slot: "A" }));
    must(await vote(link.token, key, { p_slot: "B" }));

    const rows = must(await adminClient().from("committee_votes").select("slot").eq("link_id", link.id)) as { slot: string }[];
    expect(rows).toEqual([{ slot: "B" }]);
  });

  it("records an approval with the name, the time and the version, and takes an email only if given", async () => {
    const link = await committeeLink(await project(aliceBrand, alice), alice);
    must(await approve(link.token, visitor()));
    must(await approve(link.token, visitor(), { p_name: "Chris", p_email: " Chris@Example.Test " }));

    const rows = must(await adminClient().from("committee_approvals").select("*").eq("link_id", link.id).order("name")) as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: "Chris", email: "chris@example.test", version: 1, project_id: link.projectId });
    expect(rows[1]).toMatchObject({ name: "Dana", email: null });
    expect(typeof rows[0]?.approved_at).toBe("string");
  });

  it("changes nothing when the same browser approves the same version twice", async () => {
    const link = await committeeLink(await project(aliceBrand, alice), alice);
    const key = visitor();
    const first = must(await approve(link.token, key));
    const second = must(await approve(link.token, key, { p_name: "Someone Else" }));

    expect(second).toBe(first);
    const rows = must(await adminClient().from("committee_approvals").select("name").eq("link_id", link.id)) as { name: string }[];
    expect(rows).toEqual([{ name: "Dana" }]);
  });

  it("refuses a name, a comment and an email that could not be printed or reached", async () => {
    const link = await committeeLink(await project(aliceBrand, alice), alice);

    expect((await pin(link.token, visitor(), { p_name: "" })).error).not.toBeNull();
    expect((await pin(link.token, visitor(), { p_body: "   " })).error).not.toBeNull();
    expect((await pin(link.token, "short")).error).not.toBeNull();
    expect((await approve(link.token, visitor(), { p_email: "nope" })).error?.message).toBe("That is not an email address.");
  });

  it("cannot be run by a browser, signed in or not", async () => {
    const link = await committeeLink(await project(aliceBrand, alice), alice);
    const key = visitor();

    for (const client of [alice.client, anonClient()]) {
      expect((await client.rpc("committee_pin", { p_token: link.token, p_visitor_key: key, p_name: "Sam", p_version: 1, p_panel_id: "body-front", p_x_mm: 1, p_y_mm: 1, p_body: "x" })).error).not.toBeNull();
      expect((await client.rpc("committee_vote", { p_token: link.token, p_visitor_key: key, p_name: "Sam", p_slot: "A" })).error).not.toBeNull();
      expect((await client.rpc("committee_approve", { p_token: link.token, p_visitor_key: key, p_name: "Sam", p_email: null, p_version: 1 })).error).not.toBeNull();
    }
  });

  it("is written by no browser directly either, not even a member of the club", async () => {
    const link = await committeeLink(await project(aliceBrand, alice), alice);
    must(await approve(link.token, visitor()));

    const rows = ["committee_pins", "committee_votes", "committee_approvals"] as const;
    for (const table of rows) {
      expect((await alice.client.from(table).insert({ link_id: link.id, brand_id: aliceBrand }).select("link_id")).error, table).not.toBeNull();
      await alice.client.from(table).update({ name: "Changed" }).eq("link_id", link.id);
      await alice.client.from(table).delete().eq("link_id", link.id);
    }
    expect(must(await adminClient().from("committee_approvals").select("name").eq("link_id", link.id))).toEqual([{ name: "Dana" }]);
  });
});

describe("an approval is a record, not a flag", () => {
  it.skipIf(!dockerReachable)("cannot be changed or removed, not even by the owner of the table", async () => {
    const link = await committeeLink(await project(aliceBrand, alice), alice);
    const approvalId = must(await approve(link.token, visitor())) as string;

    expect(() => asOwner(`update public.committee_approvals set name = 'Someone else' where id = '${approvalId}'`)).toThrow();
    expect(() => asOwner(`delete from public.committee_approvals where id = '${approvalId}'`)).toThrow();
    expect(() => asOwner(`truncate public.committee_approvals`)).toThrow();

    const row = must(await adminClient().from("committee_approvals").select("name").eq("id", approvalId).single()) as { name: string };
    expect(row.name).toBe("Dana");
  });

  it.skipIf(!dockerReachable)("goes only when its link goes, which is how a deleted design takes it", async () => {
    const id = await project(aliceBrand, alice);
    const link = await committeeLink(id, alice);
    must(await validate(id, aliceBrand, alice));
    must(await approve(link.token, visitor()));
    must(await pin(link.token, visitor()));
    // A lock pointing at that approval as well, because removing the approval sets the lock's
    // approval_id to null on the way out and that update must be let through, not refused.
    must(await adminClient().rpc("committee_lock_version", { p_link_id: link.id, p_user_id: alice.userId, p_version: 1 }));

    asOwner(`delete from public.projects where id = '${id}'`);

    expect(must(await adminClient().from("committee_approvals").select("id").eq("link_id", link.id))).toEqual([]);
    expect(must(await adminClient().from("committee_pins").select("id").eq("link_id", link.id))).toEqual([]);
    expect(must(await adminClient().from("committee_locks").select("id").eq("link_id", link.id))).toEqual([]);
  });
});

describe("committee_lock_version", () => {
  it("refuses a version that has never been checked against a factory profile", async () => {
    const link = await committeeLink(await project(aliceBrand, alice), alice);

    const refused = await adminClient().rpc("committee_lock_version", { p_link_id: link.id, p_user_id: alice.userId, p_version: 1 });

    expect(refused.error?.message).toContain("has not been checked against a factory profile");
    expect(must(await adminClient().from("committee_locks").select("id").eq("link_id", link.id))).toEqual([]);
  });

  it("locks the version, records who did it and the approval they acted on, and moves it to approved", async () => {
    const id = await project(aliceBrand, alice);
    const link = await committeeLink(id, alice);
    must(await validate(id, aliceBrand, alice));
    const approvalId = must(await approve(link.token, visitor())) as string;

    const lockId = must(await adminClient().rpc("committee_lock_version", { p_link_id: link.id, p_user_id: alice.userId, p_version: 1 }));

    const row = must(await adminClient().from("committee_locks").select("*").eq("id", lockId).single()) as Record<string, unknown>;
    expect(row).toMatchObject({ brand_id: aliceBrand, project_id: id, version: 1, approval_id: approvalId, locked_by: alice.userId });
    expect(await statusOf(id)).toBe("approved");
  });

  it("locks a version nobody approved, with no approval named against it", async () => {
    const id = await project(aliceBrand, alice);
    const link = await committeeLink(id, alice);
    must(await validate(id, aliceBrand, alice));

    const lockId = must(await adminClient().rpc("committee_lock_version", { p_link_id: link.id, p_user_id: alice.userId, p_version: 1 }));

    expect(must(await adminClient().from("committee_locks").select("approval_id").eq("id", lockId).single())).toEqual({ approval_id: null });
  });

  it("tells the committee the choice is made, through the link they already hold", async () => {
    const id = await project(aliceBrand, alice);
    const link = await committeeLink(id, alice);
    must(await validate(id, aliceBrand, alice));
    must(await adminClient().rpc("committee_lock_version", { p_link_id: link.id, p_user_id: alice.userId, p_version: 1 }));

    expect((await openCommittee(link.token))[0]).toMatchObject({ locked_version: 1 });
  });

  it("locks once: a second lock of the same design is refused", async () => {
    const id = await project(aliceBrand, alice);
    must(await nextVersion(id, alice, 1));
    const link = await committeeLink(id, alice, [1, 2]);
    must(await validate(id, aliceBrand, alice, 1));
    must(await validate(id, aliceBrand, alice, 2));
    must(await adminClient().rpc("committee_lock_version", { p_link_id: link.id, p_user_id: alice.userId, p_version: 1 }));

    const again = await adminClient().rpc("committee_lock_version", { p_link_id: link.id, p_user_id: alice.userId, p_version: 2 });

    expect(again.error?.message).toContain("already locked");
  });

  it("refuses another club's link, a role that may not manage the kit, and a version not on the link", async () => {
    const id = await project(aliceBrand, alice);
    const link = await committeeLink(id, alice);
    must(await validate(id, aliceBrand, alice));
    const lock = (patch: Record<string, unknown>) =>
      adminClient().rpc("committee_lock_version", { p_link_id: link.id, p_user_id: alice.userId, p_version: 1, ...patch });

    expect((await lock({ p_user_id: bob.userId })).error?.message).toBe("That link does not exist.");
    expect((await lock({ p_user_id: viewer.userId })).error?.message).toContain("does not allow that");
    expect((await lock({ p_version: 9 })).error?.message).toBe("That version is not on this link.");
  });

  it("cannot be run by a browser, signed in or not", async () => {
    const id = await project(aliceBrand, alice);
    const link = await committeeLink(id, alice);
    const args = { p_link_id: link.id, p_user_id: alice.userId, p_version: 1 };

    expect((await alice.client.rpc("committee_lock_version", args)).error).not.toBeNull();
    expect((await anonClient().rpc("committee_lock_version", args)).error).not.toBeNull();
  });
});

describe("create_roster_signup_link", () => {
  it("keeps only a hash, lasts as long as its row says, and withdraws the link before it", async () => {
    const seasonId = await season(aliceBrand, alice);
    const first = await signupLink(aliceBrand, alice, seasonId);
    const second = await signupLink(aliceBrand, alice, seasonId);

    const rows = must(await adminClient().from("roster_signup_links").select("*").eq("season_id", seasonId).order("created_at")) as Record<
      string,
      unknown
    >[];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.revoked_at).not.toBeNull();
    expect(rows[1]?.revoked_at).toBeNull();
    expect(JSON.stringify(rows)).not.toContain(first.token);
    expect(await openSignup(first.token)).toEqual([]);
    expect(await openSignup(second.token)).toHaveLength(1);
    const days = (Date.parse(String(rows[1]?.expires_at)) - Date.parse(String(rows[1]?.created_at))) / 86_400_000;
    expect(Math.round(days)).toBe(30);
  });

  it("refuses another club's season, a sport with no number rule, a bad token and a role that may not", async () => {
    const theirs = await season(bobBrand, bob);
    const call = (patch: Record<string, unknown>) =>
      adminClient().rpc("create_roster_signup_link", {
        p_brand_id: bobBrand,
        p_user_id: bob.userId,
        p_season_id: theirs,
        p_token: token(),
        p_sport: "football",
        ...patch,
      });

    expect((await call({ p_brand_id: aliceBrand, p_user_id: alice.userId })).error?.message).toBe("That season does not exist.");
    expect((await call({ p_sport: "quidditch" })).error?.message).toBe("That sport has no number rule.");
    expect((await call({ p_token: "short" })).error).not.toBeNull();
    const asViewer = await adminClient().rpc("create_roster_signup_link", {
      p_brand_id: aliceBrand,
      p_user_id: viewer.userId,
      p_season_id: await season(aliceBrand, alice),
      p_token: token(),
      p_sport: "football",
    });
    expect(asViewer.error?.message).toContain("does not allow that");
  });

  it("cannot be run by a browser, signed in or not", async () => {
    const args = {
      p_brand_id: aliceBrand,
      p_user_id: alice.userId,
      p_season_id: await season(aliceBrand, alice),
      p_token: token(),
      p_sport: "football",
    };

    expect((await alice.client.rpc("create_roster_signup_link", args)).error).not.toBeNull();
    expect((await anonClient().rpc("create_roster_signup_link", args)).error).not.toBeNull();
  });
});

describe("open_roster_signup", () => {
  it("gives the club, the season, the sport's range and the zone's length, and nothing else", async () => {
    const seasonId = await season(aliceBrand, alice);
    const link = await signupLink(aliceBrand, alice, seasonId);

    const [row] = await openSignup(link.token);

    expect(row).toMatchObject({
      link_id: link.id,
      brand_id: aliceBrand,
      club_name: "Alice Hockey Club",
      sport: "football",
      sport_label: "Football",
      lowest: 1,
      highest: 99,
      leading_zero_allowed: true,
      number_rule_id: "R-GAP-000",
      name_max_characters: 12,
      name_rule_id: "R-PER-001",
    });
    expect(Object.keys(row ?? {}).sort()).toEqual(
      [
        "brand_id",
        "club_name",
        "expires_at",
        "highest",
        "leading_zero_allowed",
        "link_id",
        "lowest",
        "name_max_characters",
        "name_rule_id",
        "number_rule_id",
        "season_name",
        "sport",
        "sport_label",
      ].sort(),
    );
  });

  it("gives nothing for a wrong token, an empty one and a withdrawn link", async () => {
    const link = await signupLink(aliceBrand, alice, await season(aliceBrand, alice));
    must(await adminClient().rpc("revoke_roster_signup_link", { p_link_id: link.id, p_user_id: alice.userId }));

    expect(await openSignup(token())).toEqual([]);
    expect(await openSignup("")).toEqual([]);
    expect(await openSignup(link.token)).toEqual([]);
  });

  it("cannot be run by a browser, signed in or not", async () => {
    const link = await signupLink(aliceBrand, alice, await season(aliceBrand, alice));

    expect((await alice.client.rpc("open_roster_signup", { p_token: link.token })).error).not.toBeNull();
    expect((await anonClient().rpc("open_roster_signup", { p_token: link.token })).error).not.toBeNull();
  });
});

describe("roster_signup_submit", () => {
  it("keeps the answer against the season, with the digits as typed", async () => {
    const seasonId = await season(aliceBrand, alice);
    const link = await signupLink(aliceBrand, alice, seasonId);
    must(await submit(link.token, visitor(), { p_number: "07" }));

    const row = must(await adminClient().from("roster_signup_entries").select("*").eq("link_id", link.id).single()) as Record<string, unknown>;
    expect(row).toMatchObject({
      brand_id: aliceBrand,
      season_id: seasonId,
      name_on_shirt: "MORGAN",
      match_key: "morgan",
      number: "07",
      size_label: "M",
      wearer_group: "mens",
    });
  });

  it("replaces one browser's answer rather than adding a second", async () => {
    const link = await signupLink(aliceBrand, alice, await season(aliceBrand, alice));
    const key = visitor();
    must(await submit(link.token, key));
    must(await submit(link.token, key, { p_number: "9", p_size_label: "L" }));

    const rows = must(await adminClient().from("roster_signup_entries").select("number, size_label").eq("link_id", link.id)) as Record<
      string,
      unknown
    >[];
    expect(rows).toEqual([{ number: "9", size_label: "L" }]);
  });

  it("refuses a number the sport's row does not allow, in that row's own words", async () => {
    const link = await signupLink(aliceBrand, alice, await season(aliceBrand, alice));

    expect((await submit(link.token, visitor(), { p_number: "0" })).error?.message).toBe("A Football number is 1 to 99.");
    expect((await submit(link.token, visitor(), { p_number: "100" })).error?.message).toBe("A Football number is 1 to 99.");
    expect((await submit(link.token, visitor(), { p_number: "x" })).error?.message).toBe("A number is digits only.");
  });

  it("takes a number another sport allows and this one does not, through its own link", async () => {
    const netball = await signupLink(aliceBrand, alice, await season(aliceBrand, alice), "netball");

    expect((await submit(netball.token, visitor(), { p_number: "0" })).error).toBeNull();
  });

  it("refuses a name longer than the back zone's row allows", async () => {
    const link = await signupLink(aliceBrand, alice, await season(aliceBrand, alice));

    expect((await submit(link.token, visitor(), { p_name: "VANDERBERGHESEN" })).error?.message).toBe("A shirt name has 1 to 12 characters.");
    expect((await submit(link.token, visitor(), { p_name: "  " })).error?.message).toBe("A shirt name has 1 to 12 characters.");
  });

  it("refuses a size nobody chose, a cut this club does not use and a visitor key of the wrong shape", async () => {
    const link = await signupLink(aliceBrand, alice, await season(aliceBrand, alice));

    expect((await submit(link.token, visitor(), { p_size_label: " " })).error?.message).toBe("Choose a size.");
    expect((await submit(link.token, visitor(), { p_wearer_group: "veterans" })).error?.message).toBe("Choose who the kit is cut for.");
    expect((await submit(link.token, "short")).error).not.toBeNull();
  });

  it("cannot be run by a browser, signed in or not, and no browser writes the rows directly", async () => {
    const link = await signupLink(aliceBrand, alice, await season(aliceBrand, alice));
    const args = { p_token: link.token, p_visitor_key: visitor(), p_name: "MORGAN", p_number: "7", p_size_label: "M", p_wearer_group: "mens" };

    expect((await alice.client.rpc("roster_signup_submit", args)).error).not.toBeNull();
    expect((await anonClient().rpc("roster_signup_submit", args)).error).not.toBeNull();
    expect((await alice.client.from("roster_signup_entries").insert({ link_id: link.id, brand_id: aliceBrand }).select("link_id")).error).not.toBeNull();
  });
});

describe("set_roster_signup_requests", () => {
  const setList = (brandId: string, owner: Person, seasonId: string, people: unknown[]) =>
    adminClient().rpc("set_roster_signup_requests", { p_brand_id: brandId, p_user_id: owner.userId, p_season_id: seasonId, p_people: people });

  it("replaces the list in one step and keeps a name listed twice once", async () => {
    const seasonId = await season(aliceBrand, alice);
    const kept = must(
      await setList(aliceBrand, alice, seasonId, [
        { name: "Alex Morgan", phone: "07700900000", email: "" },
        { name: "ALEX  MORGAN", phone: "", email: "" },
        { name: "Sam Kerr", phone: "", email: "sam@example.test" },
      ]),
    );

    expect(kept).toBe(2);
    const rows = must(await adminClient().from("roster_signup_requests").select("name, match_key, phone, email").eq("season_id", seasonId).order("match_key")) as Record<
      string,
      unknown
    >[];
    expect(rows.map((row) => row.match_key)).toEqual(["alex morgan", "sam kerr"]);
    expect(rows[1]).toMatchObject({ email: "sam@example.test" });

    must(await setList(aliceBrand, alice, seasonId, [{ name: "Sam Kerr", phone: "", email: "" }]));
    expect(must(await adminClient().from("roster_signup_requests").select("match_key").eq("season_id", seasonId))).toEqual([{ match_key: "sam kerr" }]);
  });

  it("cuts a line to what the columns take rather than failing the whole list on one odd one", async () => {
    const seasonId = await season(aliceBrand, alice);
    const kept = must(
      await setList(aliceBrand, alice, seasonId, [
        { name: `  ${"N".repeat(60)}  `, phone: "+44 (0)1632 960 000", email: "NOT AN ADDRESS" },
        { name: "Tab\tName", phone: "+", email: " Sam@Example.TEST " },
      ]),
    );

    expect(kept).toBe(2);
    const rows = must(await adminClient().from("roster_signup_requests").select("name, phone, email").eq("season_id", seasonId).order("name")) as Record<
      string,
      unknown
    >[];
    // Every digit is kept as the club wrote it. The "(0)" of a British number is not dropped: what
    // that zero means depends on where the number is being dialled from, and guessing it would send
    // a player's chase to a number nobody typed. The club sees the number before they press send.
    expect(rows[0]).toEqual({ name: "N".repeat(40), phone: "+4401632960000", email: "" });
    expect(rows[1]).toEqual({ name: "TabName", phone: "", email: "sam@example.test" });
  });

  it("refuses another club's season, something that is not a list, and a role that may not", async () => {
    const theirs = await season(bobBrand, bob);

    expect((await setList(aliceBrand, alice, theirs, [])).error?.message).toBe("That season does not exist.");
    expect((await setList(bobBrand, bob, theirs, "not a list" as unknown as unknown[])).error?.message).toBe("Give a list of people.");
    expect((await setList(aliceBrand, viewer, await season(aliceBrand, alice), [])).error?.message).toContain("does not allow that");
  });

  it("cannot be run by a browser, signed in or not", async () => {
    const args = { p_brand_id: aliceBrand, p_user_id: alice.userId, p_season_id: await season(aliceBrand, alice), p_people: [] };

    expect((await alice.client.rpc("set_roster_signup_requests", args)).error).not.toBeNull();
    expect((await anonClient().rpc("set_roster_signup_requests", args)).error).not.toBeNull();
  });
});

describe("one club's sign-up never reaches another's", () => {
  it("shows a member nothing of another club's links, list or answers", async () => {
    const seasonId = await season(bobBrand, bob);
    const link = await signupLink(bobBrand, bob, seasonId);
    must(await submit(link.token, visitor()));
    must(
      await adminClient().rpc("set_roster_signup_requests", {
        p_brand_id: bobBrand,
        p_user_id: bob.userId,
        p_season_id: seasonId,
        p_people: [{ name: "Their Player", phone: "", email: "" }],
      }),
    );

    for (const table of ["roster_signup_links", "roster_signup_requests", "roster_signup_entries"]) {
      const rows = must(await alice.client.from(table).select("*")) as { brand_id?: string }[];
      expect(rows.every((row) => row.brand_id !== bobBrand), table).toBe(true);
      expect((await anonClient().from(table).select("*")).data ?? [], table).toEqual([]);
    }
  });

  it.skipIf(!dockerReachable)("takes a player's answer away with the season it was given for", async () => {
    const seasonId = await season(aliceBrand, alice);
    const link = await signupLink(aliceBrand, alice, seasonId);
    must(await submit(link.token, visitor()));

    asOwner(`delete from public.club_seasons where id = '${seasonId}'`);

    expect(must(await adminClient().from("roster_signup_entries").select("id").eq("link_id", link.id))).toEqual([]);
  });
});
