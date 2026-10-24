import { beforeAll, describe, expect, it } from "vitest";
import { deleteAccount } from "@/lib/deletion/service";
import type { DeletionClient } from "@/lib/deletion/client";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * Club workspace (plan V4, decision 0042): roles, kit, seasons, rosters, invitations, against local
 * Supabase. Needs `pnpm db:start`. Two clubs are used throughout to show nothing leaks between them.
 */

const players = [
  { name: "Sam Park", number: "9", sizeLabel: "M", wearerGroup: "mens" },
  { name: "Lee Chen", number: "10", sizeLabel: "S", wearerGroup: "womens" },
];

const rpc = (name: string, args: Record<string, unknown>) => adminClient().rpc(name, args);

/** Invites someone and has them accept, so they hold a role in the brand. */
const join = async (owner: Person, brandId: string, member: Person, role: string): Promise<void> => {
  must(await rpc("invite_member", { p_brand_id: brandId, p_user_id: owner.userId, p_email: member.email, p_role: role }));
  const invitations = must(await member.client.rpc("my_club_invitations")) as { id: string; brand_id: string }[];
  const mine = invitations.find((i) => i.brand_id === brandId);
  expect(mine).toBeDefined();
  must(await rpc("accept_invitation", { p_user_id: member.userId, p_invitation_id: mine?.id }));
};

let ann: Person;
let ben: Person;
let admin2: Person;
let manager: Person;
let viewer: Person;
let annClub: string;
let benClub: string;

beforeAll(async () => {
  [ann, ben, admin2, manager, viewer] = await Promise.all([
    person("ann"), person("ben"), person("admin"), person("manager"), person("viewer"),
  ]);
  annClub = await brandOf(ann, "Ann FC");
  benClub = await brandOf(ben, "Ben FC");
  await join(ann, annClub, admin2, "admin");
  await join(ann, annClub, manager, "kit_manager");
  await join(ann, annClub, viewer, "viewer");
});

describe("roles", () => {
  it("lists members with their roles for a member, and nothing for another club", async () => {
    const own = must(await viewer.client.rpc("club_members", { p_brand_id: annClub })) as { role: string }[];
    expect(own.map((m) => m.role).sort()).toEqual(["admin", "kit_manager", "owner", "viewer"]);
    expect(must(await viewer.client.rpc("club_members", { p_brand_id: benClub }))).toEqual([]);
  });

  it("lets an admin change a role but not a kit manager or a viewer", async () => {
    must(await rpc("set_member_role", { p_brand_id: annClub, p_user_id: admin2.userId, p_target_id: viewer.userId, p_role: "kit_manager" }));
    must(await rpc("set_member_role", { p_brand_id: annClub, p_user_id: admin2.userId, p_target_id: viewer.userId, p_role: "viewer" }));
    for (const who of [manager, viewer]) {
      const { error } = await rpc("set_member_role", { p_brand_id: annClub, p_user_id: who.userId, p_target_id: viewer.userId, p_role: "admin" });
      expect(error?.code).toBe("42501");
    }
  });

  it("keeps the owner's role and refuses a role that is not offered", async () => {
    const owner = await rpc("set_member_role", { p_brand_id: annClub, p_user_id: admin2.userId, p_target_id: ann.userId, p_role: "viewer" });
    expect(owner.error?.hint).toBe("owner_fixed");
    const odd = await rpc("set_member_role", { p_brand_id: annClub, p_user_id: ann.userId, p_target_id: viewer.userId, p_role: "owner" });
    expect(odd.error?.code).toBe("22023");
    const gone = await rpc("remove_member", { p_brand_id: annClub, p_user_id: admin2.userId, p_target_id: ann.userId });
    expect(gone.error?.hint).toBe("owner_fixed");
  });

  it("lets nobody write the role from a browser", async () => {
    await viewer.client.from("memberships").update({ role: "admin" }).eq("user_id", viewer.userId);
    const rows = must(await adminClient().from("memberships").select("role").eq("user_id", viewer.userId).eq("brand_id", annClub));
    expect(rows).toEqual([{ role: "viewer" }]);
  });

  it("lets someone leave, and lets a manager of members remove another", async () => {
    const extra = await person("leaver");
    await join(ann, annClub, extra, "viewer");
    must(await rpc("remove_member", { p_brand_id: annClub, p_user_id: extra.userId, p_target_id: extra.userId }));
    const again = await person("removed");
    await join(ann, annClub, again, "viewer");
    const refused = await rpc("remove_member", { p_brand_id: annClub, p_user_id: manager.userId, p_target_id: again.userId });
    expect(refused.error?.code).toBe("42501");
    must(await rpc("remove_member", { p_brand_id: annClub, p_user_id: admin2.userId, p_target_id: again.userId }));
  });
});

describe("invitations", () => {
  it("shows an invitation only to the person it names", async () => {
    const guest = await person("guest");
    const stranger = await person("stranger");
    must(await rpc("invite_member", { p_brand_id: annClub, p_user_id: ann.userId, p_email: guest.email.toUpperCase(), p_role: "viewer" }));
    expect(must(await stranger.client.rpc("my_club_invitations"))).toEqual([]);
    const mine = must(await guest.client.rpc("my_club_invitations")) as { id: string }[];
    expect(mine).toHaveLength(1);
    const wrong = await rpc("accept_invitation", { p_user_id: stranger.userId, p_invitation_id: mine[0]?.id });
    expect(wrong.error?.code).toBe("P0002");
  });

  it("lets only member managers read or send invitations", async () => {
    expect(must(await manager.client.from("club_invitations").select("email"))).toEqual([]);
    expect(must(await ben.client.from("club_invitations").select("email"))).toEqual([]);
    const { error } = await rpc("invite_member", { p_brand_id: annClub, p_user_id: manager.userId, p_email: "x@example.com", p_role: "viewer" });
    expect(error?.code).toBe("42501");
    const bad = await rpc("invite_member", { p_brand_id: annClub, p_user_id: ann.userId, p_email: "not an address", p_role: "viewer" });
    expect(bad.error?.code).toBe("22023");
  });
});

describe("kit", () => {
  const kit = { primaryColour: "#0b3d91", secondaryColour: "#ffffff", accentColour: "#f2c200", sponsors: [{ name: "Bakery", logoFileId: null }] };

  it("is saved by an owner or kit manager and refused to a viewer", async () => {
    must(await rpc("save_club_kit", { p_brand_id: annClub, p_user_id: manager.userId, p_kit: kit }));
    const refused = await rpc("save_club_kit", { p_brand_id: annClub, p_user_id: viewer.userId, p_kit: kit });
    expect(refused.error?.code).toBe("42501");
    const read = must(await viewer.client.from("club_kits").select("primary_colour, sponsors"));
    expect(read).toEqual([{ primary_colour: "#0b3d91", sponsors: kit.sponsors }]);
  });

  it("refuses a bad colour, a fourth sponsor and a font that is not bundled", async () => {
    const colour = await rpc("save_club_kit", { p_brand_id: annClub, p_user_id: ann.userId, p_kit: { primaryColour: "blue" } });
    expect(colour.error).not.toBeNull();
    const sponsors = Array.from({ length: 4 }, (_, i) => ({ name: `S${i}`, logoFileId: null }));
    expect((await rpc("save_club_kit", { p_brand_id: annClub, p_user_id: ann.userId, p_kit: { sponsors } })).error).not.toBeNull();
    expect((await rpc("save_club_kit", { p_brand_id: annClub, p_user_id: ann.userId, p_kit: { nameFont: "comic" } })).error).not.toBeNull();
  });

  it("is invisible to another club", async () => {
    expect(must(await ben.client.from("club_kits").select("*"))).toEqual([]);
    const refused = await rpc("save_club_kit", { p_brand_id: annClub, p_user_id: ben.userId, p_kit: kit });
    expect(refused.error?.code).toBe("42501");
  });
});

describe("seasons and rosters", () => {
  let season: string;

  beforeAll(async () => {
    season = must(await rpc("create_club_season", { p_brand_id: annClub, p_user_id: ann.userId, p_name: "2026", p_starts_on: "2026-03-01", p_ends_on: "2026-09-30" })) as string;
    must(await rpc("replace_season_roster", { p_brand_id: annClub, p_user_id: manager.userId, p_season_id: season, p_players: players }));
  });

  it("lets a viewer read the roster but not change it", async () => {
    expect(must(await viewer.client.from("roster_players").select("name").eq("season_id", season))).toHaveLength(2);
    const refused = await rpc("replace_season_roster", { p_brand_id: annClub, p_user_id: viewer.userId, p_season_id: season, p_players: [] });
    expect(refused.error?.code).toBe("42501");
    const season2 = await rpc("create_club_season", { p_brand_id: annClub, p_user_id: viewer.userId, p_name: "Nope", p_starts_on: null, p_ends_on: null });
    expect(season2.error?.code).toBe("42501");
  });

  it("shows another club nothing and lets it change nothing", async () => {
    expect(must(await ben.client.from("roster_players").select("*"))).toEqual([]);
    expect(must(await ben.client.from("club_seasons").select("*"))).toEqual([]);
    const refused = await rpc("replace_season_roster", { p_brand_id: benClub, p_user_id: ben.userId, p_season_id: season, p_players: [] });
    expect(refused.error?.code).toBe("P0002");
    expect(must(await adminClient().from("roster_players").select("id").eq("season_id", season))).toHaveLength(2);
  });

  it("refuses a name with control characters and a number that is not digits", async () => {
    const control = await rpc("replace_season_roster", { p_brand_id: annClub, p_user_id: ann.userId, p_season_id: season, p_players: [{ ...players[0], name: "A\u0007B" }] });
    expect(control.error).not.toBeNull();
    const number = await rpc("replace_season_roster", { p_brand_id: annClub, p_user_id: ann.userId, p_season_id: season, p_players: [{ ...players[0], number: "x" }] });
    expect(number.error).not.toBeNull();
    expect(must(await adminClient().from("roster_players").select("id").eq("season_id", season))).toHaveLength(2);
  });

  it("copies a roster into the next season with sizes, and keeps the two apart", async () => {
    const next = must(await rpc("start_next_season", { p_brand_id: annClub, p_user_id: manager.userId, p_from_season_id: season, p_name: "2027", p_starts_on: null, p_ends_on: null })) as string;
    const copied = must(await adminClient().from("roster_players").select("name, size_label, wearer_group").eq("season_id", next).order("position"));
    expect(copied).toEqual([
      { name: "Sam Park", size_label: "M", wearer_group: "mens" },
      { name: "Lee Chen", size_label: "S", wearer_group: "womens" },
    ]);
    must(await rpc("replace_season_roster", { p_brand_id: annClub, p_user_id: ann.userId, p_season_id: next, p_players: [players[0]] }));
    expect(must(await adminClient().from("roster_players").select("id").eq("season_id", season))).toHaveLength(2);
  });

  it("refuses to copy another club's season", async () => {
    const { error } = await rpc("start_next_season", { p_brand_id: benClub, p_user_id: ben.userId, p_from_season_id: season, p_name: "Stolen", p_starts_on: null, p_ends_on: null });
    expect(error?.code).toBe("P0002");
  });

  it("refuses a second season with the same name", async () => {
    const { error } = await rpc("create_club_season", { p_brand_id: annClub, p_user_id: ann.userId, p_name: "2026", p_starts_on: null, p_ends_on: null });
    expect(error?.code).toBe("23505");
  });
});

describe("erasure", () => {
  it("erases one player, a whole season, and everything with the brand", async () => {
    const owner = await person("erase");
    const club = await brandOf(owner, "Erase FC");
    const season = must(await rpc("create_club_season", { p_brand_id: club, p_user_id: owner.userId, p_name: "S", p_starts_on: null, p_ends_on: null })) as string;
    must(await rpc("replace_season_roster", { p_brand_id: club, p_user_id: owner.userId, p_season_id: season, p_players: players }));
    const [first] = must(await adminClient().from("roster_players").select("id").eq("season_id", season).order("position")) as { id: string }[];

    const other = await rpc("erase_roster_player", { p_brand_id: annClub, p_user_id: ann.userId, p_player_id: first?.id });
    expect(other.error?.code).toBe("P0002");
    must(await rpc("erase_roster_player", { p_brand_id: club, p_user_id: owner.userId, p_player_id: first?.id }));
    expect(must(await adminClient().from("roster_players").select("id").eq("season_id", season))).toHaveLength(1);

    must(await rpc("delete_club_season", { p_brand_id: club, p_user_id: owner.userId, p_season_id: season }));
    expect(must(await adminClient().from("roster_players").select("id").eq("season_id", season))).toEqual([]);
  });

  it("removes roster players when the brand is deleted", async () => {
    const owner = await person("erase2");
    const club = await brandOf(owner, "Gone FC");
    const season = must(await rpc("create_club_season", { p_brand_id: club, p_user_id: owner.userId, p_name: "S", p_starts_on: null, p_ends_on: null })) as string;
    must(await rpc("replace_season_roster", { p_brand_id: club, p_user_id: owner.userId, p_season_id: season, p_players: players }));
    must(await rpc("save_club_kit", { p_brand_id: club, p_user_id: owner.userId, p_kit: { primaryColour: "#000000" } }));
    must(await rpc("invite_member", { p_brand_id: club, p_user_id: owner.userId, p_email: "gone@example.com", p_role: "viewer" }));

    must(await adminClient().from("brands").delete().eq("id", club).select("id"));

    for (const table of ["roster_players", "club_seasons", "club_kits", "club_invitations"]) {
      expect(must(await adminClient().from(table).select("*").eq("brand_id", club)), table).toEqual([]);
    }
  });
});

describe("deleting an account", () => {
  it("removes the club, its seasons and every roster player with it", async () => {
    const owner = await person("goner");
    const club = await brandOf(owner, "Goner FC");
    const season = must(await rpc("create_club_season", { p_brand_id: club, p_user_id: owner.userId, p_name: "S", p_starts_on: null, p_ends_on: null })) as string;
    must(await rpc("replace_season_roster", { p_brand_id: club, p_user_id: owner.userId, p_season_id: season, p_players: players }));

    await deleteAccount(adminClient() as unknown as DeletionClient, { userId: owner.userId });

    expect(must(await adminClient().from("roster_players").select("id").eq("brand_id", club))).toEqual([]);
    expect(must(await adminClient().from("club_seasons").select("id").eq("brand_id", club))).toEqual([]);
  });

  it("still refuses while another member would lose the club", async () => {
    const owner = await person("shared");
    const club = await brandOf(owner, "Shared FC");
    await join(owner, club, await person("mate"), "viewer");
    await expect(deleteAccount(adminClient() as unknown as DeletionClient, { userId: owner.userId })).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("what a browser may do", () => {
  it("cannot call the writing functions, and a visitor reads nothing", async () => {
    const attempt = await ann.client.rpc("save_club_kit", { p_brand_id: annClub, p_user_id: ann.userId, p_kit: {} });
    expect(attempt.error).not.toBeNull();
    for (const table of ["club_kits", "club_seasons", "roster_players", "club_invitations"]) {
      const { data, error } = await anonClient().from(table).select("*");
      expect(error !== null || data?.length === 0, table).toBe(true);
    }
  });
});
