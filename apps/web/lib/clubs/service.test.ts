import { describe, expect, it } from "vitest";
import { fakeClient } from "@/lib/orders/fixtures/fake-client";
import { EMPTY_KIT } from "./kit";
import {
  acceptInvitation, cancelInvitation, createSeason, deleteSeason, erasePlayer, getKit, getRoster, inviteMember, listInvitations,
  listMembers, listOrderHistory, listSeasons, myInvitations, removeMember, replaceRoster, saveKit, setMemberRole,
} from "./service";

const BRAND = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const SEASON = "33333333-3333-4333-8333-333333333333";
const OTHER = "44444444-4444-4444-8444-444444444444";
const who = { brandId: BRAND, userId: USER };
const refused = { error: { code: "42501", message: "no" } };
const rpcArgs = (calls: ReturnType<typeof fakeClient>["calls"]) => calls[0]?.steps[0]?.[1][0];

describe("kit", () => {
  it("reads a kit, or an empty one when none is saved", async () => {
    expect(await getKit(fakeClient({}).client, BRAND)).toEqual(EMPTY_KIT);
    const row = { primary_colour: "#0b3d91", secondary_colour: null, accent_colour: null, crest_file_id: null, sponsors: [], name_font: "geist", number_font: "geist" };
    expect((await getKit(fakeClient({ club_kits: { data: row } }).client, BRAND)).primaryColour).toBe("#0b3d91");
  });

  it("saves through the function with the person and brand from the session", async () => {
    const { client, calls } = fakeClient({});
    await saveKit(client, who, EMPTY_KIT);
    expect(rpcArgs(calls)).toMatchObject({ p_brand_id: BRAND, p_user_id: USER });
  });

  it("says a role is not allowed in plain words", async () => {
    await expect(saveKit(fakeClient({ save_club_kit: refused }).client, who, EMPTY_KIT)).rejects.toMatchObject({ code: "forbidden" });
    await expect(getKit(fakeClient({ club_kits: { error: { code: "XX", message: "m" } } }).client, BRAND)).rejects.toMatchObject({ code: "internal" });
  });
});

describe("seasons", () => {
  it("lists them with a player count", async () => {
    const data = [{ id: SEASON, name: "2026", starts_on: null, ends_on: null, roster_players: [{ count: 22 }] }, { id: OTHER, name: "2025", starts_on: "2025-03-01", ends_on: "2025-09-01", roster_players: [] }];
    const seasons = await listSeasons(fakeClient({ club_seasons: { data } }).client, BRAND);
    expect(seasons.map((s) => s.players)).toEqual([22, 0]);
    expect(await listSeasons(fakeClient({}).client, BRAND)).toEqual([]);
  });

  it("makes an empty season, or one copied from an earlier season", async () => {
    const empty = fakeClient({ create_club_season: { data: SEASON } });
    expect(await createSeason(empty.client, who, { name: "2027", startsOn: null, endsOn: null })).toBe(SEASON);
    expect(empty.calls[0]?.name).toBe("create_club_season");
    const copy = fakeClient({ start_next_season: { data: SEASON } });
    await createSeason(copy.client, who, { name: "2027", startsOn: null, endsOn: null, copyFromSeasonId: OTHER });
    expect(copy.calls[0]?.name).toBe("start_next_season");
    expect(rpcArgs(copy.calls)).toMatchObject({ p_from_season_id: OTHER });
  });

  it("explains a full club and a clash of names", async () => {
    const full = fakeClient({ create_club_season: { error: { code: "P0001", hint: "too_many_seasons", message: "x" } } });
    await expect(createSeason(full.client, who, { name: "x", startsOn: null, endsOn: null })).rejects.toMatchObject({ code: "conflict" });
    const dup = fakeClient({ create_club_season: { error: { code: "23505", message: "x" } } });
    await expect(createSeason(dup.client, who, { name: "x", startsOn: null, endsOn: null })).rejects.toMatchObject({ code: "conflict" });
  });

  it("deletes through the function", async () => {
    const { client, calls } = fakeClient({});
    await deleteSeason(client, who, SEASON);
    expect(rpcArgs(calls)).toMatchObject({ p_season_id: SEASON });
    await expect(deleteSeason(fakeClient({ delete_club_season: { error: { code: "P0002", message: "x" } } }).client, who, SEASON)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("roster", () => {
  const rows = [{ id: OTHER, name: "Sam", number: "9", size_label: "M", wearer_group: "mens" }];

  it("reads a season's players in order", async () => {
    const { client } = fakeClient({ club_seasons: { data: { id: SEASON } }, roster_players: { data: rows } });
    expect(await getRoster(client, BRAND, SEASON)).toEqual([{ id: OTHER, name: "Sam", number: "9", sizeLabel: "M", wearerGroup: "mens" }]);
  });

  it("is not found for a season that is not the club's", async () => {
    await expect(getRoster(fakeClient({}).client, BRAND, SEASON)).rejects.toMatchObject({ code: "not_found" });
    await expect(getRoster(fakeClient({ club_seasons: { error: { code: "22P02", message: "x" } } }).client, BRAND, SEASON)).rejects.toMatchObject({ code: "not_found" });
    await expect(getRoster(fakeClient({ club_seasons: { data: { id: SEASON } }, roster_players: { error: { code: "XX", message: "x" } } }).client, BRAND, SEASON)).rejects.toMatchObject({ code: "internal" });
  });

  it("replaces and erases through functions", async () => {
    const { client, calls } = fakeClient({ replace_season_roster: { data: 1 } });
    expect(await replaceRoster(client, who, SEASON, [{ name: "Sam", number: "9", sizeLabel: "M", wearerGroup: "mens" }])).toBe(1);
    expect(rpcArgs(calls)).toMatchObject({ p_season_id: SEASON });
    await erasePlayer(fakeClient({}).client, who, OTHER);
    await expect(erasePlayer(fakeClient({ erase_roster_player: refused }).client, who, OTHER)).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("members and invitations", () => {
  it("lists members, naming one without a name plainly", async () => {
    const data = [{ user_id: USER, role: "owner", name: "Ann" }, { user_id: OTHER, role: "viewer", name: null }];
    const members = await listMembers(fakeClient({ club_members: { data } }).client, BRAND);
    expect(members.map((m) => [m.role, m.name])).toEqual([["owner", "Ann"], ["viewer", "A member"]]);
    expect(await listMembers(fakeClient({}).client, BRAND)).toEqual([]);
  });

  it("changes a role, removes a member, invites and cancels", async () => {
    const { client, calls } = fakeClient({});
    await setMemberRole(client, who, OTHER, "viewer");
    await removeMember(client, who, OTHER);
    await inviteMember(client, who, "a@example.com", "viewer");
    await cancelInvitation(client, who, SEASON);
    expect(calls.map((c) => c.name)).toEqual(["set_member_role", "remove_member", "invite_member", "cancel_invitation"]);
    await expect(setMemberRole(fakeClient({ set_member_role: refused }).client, who, OTHER, "viewer")).rejects.toMatchObject({ code: "forbidden" });
    const fixed = fakeClient({ remove_member: { error: { code: "P0001", hint: "owner_fixed", message: "x" } } });
    await expect(removeMember(fixed.client, who, USER)).rejects.toMatchObject({ code: "conflict" });
  });

  it("lists invitations for managers and for the person they name", async () => {
    const listed = await listInvitations(fakeClient({ club_invitations: { data: [{ id: SEASON, email: "a@example.com", role: "viewer" }] } }).client, BRAND);
    expect(listed).toHaveLength(1);
    const mine = await myInvitations(fakeClient({ my_club_invitations: { data: [{ id: SEASON, brand_id: BRAND, brand_name: "Ann FC", role: "viewer" }] } }).client);
    expect(mine).toEqual([{ id: SEASON, brandId: BRAND, brandName: "Ann FC", role: "viewer" }]);
    expect(await myInvitations(fakeClient({}).client)).toEqual([]);
  });

  it("accepts an invitation", async () => {
    expect(await acceptInvitation(fakeClient({ accept_invitation: { data: BRAND } }).client, USER, SEASON)).toBe(BRAND);
    await expect(acceptInvitation(fakeClient({ accept_invitation: { error: { code: "P0002", message: "x" } } }).client, USER, SEASON)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("listOrderHistory", () => {
  it("names the design of each release, and a deleted one plainly", async () => {
    const releases = [
      { id: SEASON, project_id: OTHER, number: 2, label: "Round 2", created_at: "2026-10-02T00:00:00Z" },
      { id: BRAND, project_id: USER, number: 1, label: "Round 1", created_at: "2026-10-01T00:00:00Z" },
    ];
    const { client } = fakeClient({ production_releases: { data: releases }, projects: { data: [{ id: OTHER, name: "Home shirt" }] } });
    const history = await listOrderHistory(client, BRAND);
    expect(history.map((h) => h.designName)).toEqual(["Home shirt", "A deleted design"]);
  });

  it("makes no second query when there are no releases", async () => {
    const { client, calls } = fakeClient({});
    expect(await listOrderHistory(client, BRAND)).toEqual([]);
    expect(calls).toHaveLength(1);
  });
});
