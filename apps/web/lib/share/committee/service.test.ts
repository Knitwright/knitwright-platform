import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { fakeClient, filteredOn } from "./fixtures/client";
import {
  castVote,
  committeeFailure,
  createCommitteeLink,
  LINK_NOT_FOUND,
  listCommittee,
  lockCommitteeVersion,
  openCommittee,
  pinComment,
  recordApproval,
  revokeCommitteeLink,
} from "./service";

const BRAND = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const LINK = "33333333-3333-4333-8333-333333333333";
const TOKEN = "t".repeat(43);

const rpcClient = (answer: { data?: unknown; error?: unknown }) =>
  ({ rpc: vi.fn(async () => ({ data: answer.data ?? null, error: answer.error ?? null })) }) as unknown as SupabaseClient & {
    rpc: ReturnType<typeof vi.fn>;
  };

describe("committeeFailure", () => {
  it("turns the limits the database keeps into a sentence a person can act on", () => {
    expect(committeeFailure({ code: "P0001", hint: "too_many_links", message: "x" }, LINK_NOT_FOUND).code).toBe("conflict");
    expect(committeeFailure({ code: "P0001", hint: "already_locked", message: "x" }, LINK_NOT_FOUND).message).toContain("already locked");
    expect(committeeFailure({ code: "P0001", hint: "not_checked", message: "x" }, LINK_NOT_FOUND).message).toContain("factory profile");
    expect(committeeFailure({ code: "P0001", hint: "append_only", message: "x" }, LINK_NOT_FOUND).message).toContain("never changes");
    expect(committeeFailure({ code: "P0001", hint: "too_many_pins", message: "x" }, LINK_NOT_FOUND).code).toBe("conflict");
    expect(committeeFailure({ code: "P0001", hint: "too_many_votes", message: "x" }, LINK_NOT_FOUND).code).toBe("conflict");
  });

  it("gives one answer for a missing link and another club's link", () => {
    for (const code of ["P0002", "22P02"]) {
      expect(committeeFailure({ code, message: "whatever the database said" }, LINK_NOT_FOUND)).toMatchObject({
        code: "not_found",
        message: LINK_NOT_FOUND,
      });
    }
  });

  it("says plainly that a role may not do it, and hides anything else", () => {
    expect(committeeFailure({ code: "42501", message: "x" }, LINK_NOT_FOUND).code).toBe("forbidden");
    expect(committeeFailure({ code: "22023", message: "x" }, LINK_NOT_FOUND).code).toBe("invalid_input");
    const unknown = committeeFailure({ code: "XX000", message: "secret detail" }, LINK_NOT_FOUND);
    expect(unknown).toBeInstanceOf(AppError);
    expect(unknown.code).toBe("internal");
    expect(unknown.message).not.toContain("secret detail");
  });
});

describe("the writes a club makes", () => {
  it("hands the token to the database once and gives it back to the member once", async () => {
    const admin = rpcClient({ data: [{ id: LINK, expires_at: "2026-12-01T00:00:00Z" }] });

    const made = await createCommitteeLink(admin, { projectId: PROJECT, userId: "u1", token: TOKEN, versions: [4, 3] });

    expect(made).toEqual({ id: LINK, expiresAt: "2026-12-01T00:00:00Z", token: TOKEN });
    expect(admin.rpc).toHaveBeenCalledWith("create_committee_link", {
      p_project_id: PROJECT,
      p_user_id: "u1",
      p_token: TOKEN,
      p_versions: [4, 3],
    });
  });

  it("raises the database's refusal as something the member can read", async () => {
    const admin = rpcClient({ error: { code: "42501", message: "no" } });

    await expect(createCommitteeLink(admin, { projectId: PROJECT, userId: "u1", token: TOKEN, versions: [1] })).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("withdraws a link and locks a version through the functions, never a table", async () => {
    const admin = rpcClient({ data: LINK });

    await revokeCommitteeLink(admin, { linkId: LINK, userId: "u1" });
    expect(await lockCommitteeVersion(admin, { linkId: LINK, userId: "u1", version: 4 })).toBe(LINK);
    expect(admin.rpc.mock.calls.map((call) => call[0])).toEqual(["revoke_committee_link", "committee_lock_version"]);
  });
});

describe("the writes a committee makes", () => {
  it("passes the pin's point and the visitor's key to the function and nothing else", async () => {
    const admin = rpcClient({});

    await pinComment(admin, {
      token: TOKEN,
      visitorKey: "v".repeat(43),
      name: "Sam",
      version: 4,
      panelId: "body-front",
      xMm: 10.5,
      yMm: 20,
      body: "Navy sleeves.",
    });

    expect(admin.rpc).toHaveBeenCalledWith("committee_pin", {
      p_token: TOKEN,
      p_visitor_key: "v".repeat(43),
      p_name: "Sam",
      p_version: 4,
      p_panel_id: "body-front",
      p_x_mm: 10.5,
      p_y_mm: 20,
      p_body: "Navy sleeves.",
    });
  });

  it("keeps a vote and gives an approval's own id back", async () => {
    const admin = rpcClient({ data: LINK });

    await castVote(admin, { token: TOKEN, visitorKey: "v".repeat(43), name: "Kim", slot: "B" });
    expect(await recordApproval(admin, { token: TOKEN, visitorKey: "v".repeat(43), name: "Dana", email: null, version: 4 })).toBe(LINK);
  });
});

describe("openCommittee", () => {
  it("gathers the rows into one link with its options in slot order", async () => {
    const row = (slot: string, version: number, isCurrent: boolean) => ({
      link_id: LINK,
      brand_id: BRAND,
      brand_name: "Northside Hockey Club",
      project_name: "Home kit 2027",
      expires_at: "2026-12-01T00:00:00Z",
      slot,
      version,
      is_current: isCurrent,
      spec: { made: "for the test" },
      saved_at: "2026-11-01T00:00:00Z",
      locked_version: null,
    });
    const admin = rpcClient({ data: [row("A", 4, false), row("B", 5, true)] });

    const opened = await openCommittee(admin, TOKEN);

    expect(opened).toMatchObject({ linkId: LINK, brandId: BRAND, brandName: "Northside Hockey Club", lockedVersion: null });
    expect(opened?.options.map((option) => option.slot)).toEqual(["A", "B"]);
    expect(opened?.options[1]).toMatchObject({ version: 5, isCurrent: true });
  });

  it("is nothing at all for a token that opens no link", async () => {
    expect(await openCommittee(rpcClient({ data: [] }), TOKEN)).toBeNull();
  });

  it("carries the locked version, so a committee is told the choice is made", async () => {
    const admin = rpcClient({
      data: [
        {
          link_id: LINK,
          brand_id: BRAND,
          brand_name: "Club",
          project_name: "Kit",
          expires_at: "2026-12-01T00:00:00Z",
          slot: "A",
          version: 4,
          is_current: true,
          spec: {},
          saved_at: "2026-11-01T00:00:00Z",
          locked_version: 4,
        },
      ],
    });

    expect((await openCommittee(admin, TOKEN))?.lockedVersion).toBe(4);
  });
});

describe("listCommittee", () => {
  const links = [{ id: LINK, created_at: "2026-11-01T00:00:00Z", expires_at: "2026-12-01T00:00:00Z", revoked_at: null }];

  it("is empty for a design with no link, and still says whether a version is locked", async () => {
    const { client } = fakeClient({ committee_links: [], committee_locks: [{ version: 4, locked_at: "2026-11-02T00:00:00Z", approval_id: null }] });

    const read = await listCommittee(client, BRAND, PROJECT);

    expect(read.links).toEqual([]);
    expect(read.lock).toEqual({ version: 4, lockedAt: "2026-11-02T00:00:00Z", approvalId: null });
  });

  it("hangs each link's options, pins, votes and approvals off that link", async () => {
    const { client } = fakeClient({
      committee_links: links,
      committee_locks: [],
      committee_link_versions: [
        { link_id: LINK, slot: "A", version: 4 },
        { link_id: "44444444-4444-4444-8444-444444444444", slot: "A", version: 9 },
      ],
      committee_pins: [
        { id: "55555555-5555-4555-8555-555555555555", link_id: LINK, version: 4, name: "Sam", panel_id: "body-front", x_mm: "10.5", y_mm: "20.0", body: "Navy.", created_at: "2026-11-03T00:00:00Z" },
      ],
      committee_votes: [{ link_id: LINK, slot: "A", name: "Kim", updated_at: "2026-11-03T00:00:00Z" }],
      committee_approvals: [{ id: "66666666-6666-4666-8666-666666666666", link_id: LINK, version: 4, name: "Dana", email: null, approved_at: "2026-11-04T00:00:00Z" }],
    });

    const read = await listCommittee(client, BRAND, PROJECT);

    expect(read.lock).toBeNull();
    expect(read.links).toHaveLength(1);
    expect(read.links[0]?.slots).toEqual([{ slot: "A", version: 4 }]);
    // A numeric column comes back as a string from the driver; the pin's point stays a number.
    expect(read.links[0]?.pins[0]).toMatchObject({ xMm: 10.5, yMm: 20 });
    expect(read.links[0]?.votes).toHaveLength(1);
    expect(read.links[0]?.approvals[0]?.name).toBe("Dana");
  });

  it("asks for the club's own rows every time, so one club never reads another's", async () => {
    const { client, asked } = fakeClient({ committee_links: links, committee_locks: [] });
    await listCommittee(client, BRAND, PROJECT);

    expect(asked.length).toBeGreaterThan(4);
    for (const record of asked) expect(filteredOn(record), record.table).toContain(BRAND);
  });

  it("raises what the database said as a failure the member can read", async () => {
    const { client } = fakeClient({ committee_links: [] }, { code: "P0002", message: "no" });

    await expect(listCommittee(client, BRAND, PROJECT)).rejects.toMatchObject({ code: "not_found" });
  });

  it("reads a design nobody has touched as nothing rather than breaking", async () => {
    const { client } = fakeClient({});

    expect(await listCommittee(client, BRAND, PROJECT)).toEqual({ links: [], lock: null });
  });

  it("holds a link the club has withdrawn, with the day it went", async () => {
    const { client } = fakeClient({
      committee_links: [{ id: LINK, created_at: "2026-11-01T00:00:00Z", expires_at: "2026-12-01T00:00:00Z", revoked_at: "2026-11-05T00:00:00Z" }],
      committee_locks: [],
    });

    const read = await listCommittee(client, BRAND, PROJECT);

    expect(read.links[0]?.revokedAt).toBe("2026-11-05T00:00:00Z");
    expect(read.links[0]).toMatchObject({ slots: [], pins: [], votes: [], approvals: [] });
  });

  it("names the approval a lock was made against, when there was one", async () => {
    const { client } = fakeClient({
      committee_links: [],
      committee_locks: [{ version: 4, locked_at: "2026-11-02T00:00:00Z", approval_id: "66666666-6666-4666-8666-666666666666" }],
    });

    expect((await listCommittee(client, BRAND, PROJECT)).lock?.approvalId).toBe("66666666-6666-4666-8666-666666666666");
  });
});

describe("what the database hands back", () => {
  it("reads one made link whether the function answers with a row or a list of one", async () => {
    const single = rpcClient({ data: { id: LINK, expires_at: "2026-12-01T00:00:00Z" } });

    expect((await createCommitteeLink(single, { projectId: PROJECT, userId: "u1", token: TOKEN, versions: [1] })).id).toBe(LINK);
  });

  it("reads nothing at all as nothing, not as an error", async () => {
    expect(await openCommittee(rpcClient({ data: null }), TOKEN)).toBeNull();
  });

  it("raises a refusal from every one of the committee's own writes", async () => {
    const admin = rpcClient({ error: { code: "P0002", message: "no" } });
    const key = "v".repeat(43);

    await expect(pinComment(admin, { token: TOKEN, visitorKey: key, name: "Sam", version: 1, panelId: "p", xMm: 0, yMm: 0, body: "x" })).rejects.toMatchObject({ code: "not_found" });
    await expect(castVote(admin, { token: TOKEN, visitorKey: key, name: "Sam", slot: "A" })).rejects.toMatchObject({ code: "not_found" });
    await expect(recordApproval(admin, { token: TOKEN, visitorKey: key, name: "Sam", email: null, version: 1 })).rejects.toMatchObject({ code: "not_found" });
    await expect(revokeCommitteeLink(admin, { linkId: LINK, userId: "u1" })).rejects.toMatchObject({ code: "not_found" });
    await expect(lockCommitteeVersion(admin, { linkId: LINK, userId: "u1", version: 1 })).rejects.toMatchObject({ code: "not_found" });
    await expect(openCommittee(admin, TOKEN)).rejects.toMatchObject({ code: "not_found" });
  });
});
