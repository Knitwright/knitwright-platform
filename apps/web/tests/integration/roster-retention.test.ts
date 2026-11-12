import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * Roster retention (spec 05 security; plan v6 D5, decision 0136), against local Supabase.
 *
 * `purge_old_rosters` runs across every club when the scheduler calls it. Here it is always scoped to this file's
 * own clubs (`p_brand_id`), because the database is shared with every other test file, and a purge across all of
 * it would remove other files' rosters while they are being read (plan v5, Lesson 11).
 */

const NOW = "2030-06-01T12:00:00.000Z";
const rpc = (name: string, args: Record<string, unknown>) => adminClient().rpc(name, args);
const token = (): string => randomBytes(32).toString("base64url");

type Purge = { seasons_purged: number; players_removed: number; requests_removed: number; entries_removed: number };

const purge = async (brandId: string, now = NOW): Promise<Purge> =>
  (must(await rpc("purge_old_rosters", { p_now: now, p_brand_id: brandId })) as Purge[])[0]!;

const season = async (owner: Person, brandId: string, startsOn: string, endsOn: string): Promise<string> => {
  const id = must(
    await rpc("create_club_season", {
      p_brand_id: brandId,
      p_user_id: owner.userId,
      p_name: `Season ${startsOn}`,
      p_starts_on: startsOn,
      p_ends_on: endsOn,
    }),
  ) as string;
  must(
    await rpc("replace_season_roster", {
      p_brand_id: brandId,
      p_user_id: owner.userId,
      p_season_id: id,
      p_players: [
        { name: "Sam Park", number: "9", sizeLabel: "M", wearerGroup: "mens" },
        { name: "Lee Chen", number: "10", sizeLabel: "S", wearerGroup: "womens" },
      ],
    }),
  );
  return id;
};

/** A season's sign-up: one person waited on and one answer sent through a link. */
const signUp = async (owner: Person, brandId: string, seasonId: string): Promise<void> => {
  must(
    await rpc("set_roster_signup_requests", {
      p_brand_id: brandId,
      p_user_id: owner.userId,
      p_season_id: seasonId,
      p_people: [{ name: "Alex Morgan", phone: "", email: "alex@example.com" }],
    }),
  );
  const secret = token();
  must(
    await rpc("create_roster_signup_link", {
      p_brand_id: brandId,
      p_user_id: owner.userId,
      p_season_id: seasonId,
      p_token: secret,
      p_sport: "football",
    }),
  );
  must(
    await rpc("roster_signup_submit", {
      p_token: secret,
      p_visitor_key: token(),
      p_name: "MORGAN",
      p_number: "7",
      p_size_label: "M",
      p_wearer_group: "mens",
    }),
  );
};

const countOf = async (table: string, seasonId: string): Promise<number> => {
  const { count, error } = await adminClient().from(table).select("*", { count: "exact", head: true }).eq("season_id", seasonId);
  expect(error).toBeNull();
  return count ?? 0;
};

const purgedAt = async (seasonId: string): Promise<string | null> => {
  const rows = must(await adminClient().from("club_seasons").select("roster_purged_at").eq("id", seasonId)) as {
    roster_purged_at: string | null;
  }[];
  expect(rows).toHaveLength(1);
  return rows[0]!.roster_purged_at;
};

let ann: Person;
let bea: Person;
let cal: Person;
let annClub: string;
let beaClub: string;
let calClub: string;
let oldest: string;
let middle: string;
let newest: string;

beforeAll(async () => {
  [ann, bea, cal] = await Promise.all([person("retention-ann"), person("retention-bea"), person("retention-cal")]);
  [annClub, beaClub, calClub] = await Promise.all([
    brandOf(ann, "Retention Ann FC"),
    brandOf(bea, "Retention Bea FC"),
    brandOf(cal, "Retention Cal FC"),
  ]);
  // Made out of order, so the purge has to go by the start date and not by when a row was made. All three ended
  // within two years of NOW, so only the count of newer seasons can make one past keeping.
  newest = await season(ann, annClub, "2029-08-01", "2030-05-31");
  oldest = await season(ann, annClub, "2029-01-01", "2029-03-31");
  middle = await season(ann, annClub, "2029-04-01", "2029-06-30");
  await signUp(ann, annClub, oldest);
});

describe("purge_old_rosters", () => {
  it("removes the roster of a season with two newer ones, and keeps the two newest", async () => {
    expect(await countOf("roster_signup_requests", oldest)).toBe(1);
    expect(await countOf("roster_signup_entries", oldest)).toBe(1);

    expect(await purge(annClub)).toEqual({ seasons_purged: 1, players_removed: 2, requests_removed: 1, entries_removed: 1 });

    for (const table of ["roster_players", "roster_signup_requests", "roster_signup_entries", "roster_signup_links"]) {
      expect(await countOf(table, oldest), table).toBe(0);
    }
    expect(await countOf("roster_players", middle)).toBe(2);
    expect(await countOf("roster_players", newest)).toBe(2);
    // The season stays, and says when its roster went.
    expect(new Date((await purgedAt(oldest))!).toISOString()).toBe(NOW);
    expect(await purgedAt(middle)).toBeNull();
  });

  it("removes nothing the second time", async () => {
    expect(await purge(annClub)).toEqual({ seasons_purged: 0, players_removed: 0, requests_removed: 0, entries_removed: 0 });
    expect(await countOf("roster_players", middle)).toBe(2);
  });

  it("removes the roster of a club's only season once it ended more than two years ago, and not a day before", async () => {
    const only = await season(cal, calClub, "2027-09-01", "2028-05-31");
    expect((await purge(calClub, "2030-05-30T12:00:00.000Z")).seasons_purged).toBe(0);
    expect(await countOf("roster_players", only)).toBe(2);
    expect(await purge(calClub)).toEqual({ seasons_purged: 1, players_removed: 2, requests_removed: 0, entries_removed: 0 });
    expect(await countOf("roster_players", only)).toBe(0);
  });

  it("keeps every roster of a club that opted in, and purges again once it opts out", async () => {
    const first = await season(bea, beaClub, "2020-01-01", "2020-06-30");
    await season(bea, beaClub, "2021-01-01", "2021-06-30");
    await season(bea, beaClub, "2022-01-01", "2022-06-30");
    must(await rpc("set_roster_retention", { p_brand_id: beaClub, p_user_id: bea.userId, p_keep: true }));

    expect((await purge(beaClub)).seasons_purged).toBe(0);
    expect(await countOf("roster_players", first)).toBe(2);

    must(await rpc("set_roster_retention", { p_brand_id: beaClub, p_user_id: bea.userId, p_keep: false }));
    expect(await purge(beaClub)).toMatchObject({ seasons_purged: 3, players_removed: 6 });
  });

  it("touches no other club when it is scoped to one", async () => {
    const before = await countOf("roster_players", middle);
    await purge(calClub, "2099-01-01T00:00:00.000Z");
    expect(await countOf("roster_players", middle)).toBe(before);
  });

  it("cannot be run from a browser, signed in or not", async () => {
    const args = { p_now: NOW, p_brand_id: annClub };
    expect((await ann.client.rpc("purge_old_rosters", args)).error).not.toBeNull();
    expect((await anonClient().rpc("purge_old_rosters", args)).error).not.toBeNull();
  });
});

describe("set_roster_retention", () => {
  it("lets the owner opt in, and lets a member read it but nobody else", async () => {
    must(await rpc("set_roster_retention", { p_brand_id: calClub, p_user_id: cal.userId, p_keep: true }));
    expect(must(await cal.client.from("club_roster_retention").select("brand_id, keep_old_rosters"))).toEqual([
      { brand_id: calClub, keep_old_rosters: true },
    ]);
    expect(must(await ann.client.from("club_roster_retention").select("brand_id").eq("brand_id", calClub))).toEqual([]);
  });

  it("refuses someone who does not manage the club's members", async () => {
    const { error } = await rpc("set_roster_retention", { p_brand_id: calClub, p_user_id: ann.userId, p_keep: false });
    expect(error?.code).toBe("42501");
  });

  it("cannot be called from a browser", async () => {
    const args = { p_brand_id: annClub, p_user_id: ann.userId, p_keep: true };
    expect((await ann.client.rpc("set_roster_retention", args)).error).not.toBeNull();
  });
});
