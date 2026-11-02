import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { fakeClient, filteredOn } from "@/lib/share/committee/fixtures/client";
import {
  createSignupLink,
  openSignup,
  readChaseTemplates,
  readNumberRules,
  readSeasonSignup,
  readZoneLimits,
  revokeSignupLink,
  setRequests,
  submitSignup,
} from "./service";

const BRAND = "11111111-1111-4111-8111-111111111111";
const SEASON = "22222222-2222-4222-8222-222222222222";
const LINK = "33333333-3333-4333-8333-333333333333";
const TOKEN = "t".repeat(43);
const WHO = { brandId: BRAND, userId: "u1" };

const rpcClient = (answer: { data?: unknown; error?: unknown }) =>
  ({ rpc: vi.fn(async () => ({ data: answer.data ?? null, error: answer.error ?? null })) }) as unknown as SupabaseClient & {
    rpc: ReturnType<typeof vi.fn>;
  };

describe("the club's own writes", () => {
  it("hands the token to the database once and gives it back once", async () => {
    const admin = rpcClient({ data: [{ id: LINK, expires_at: "2026-12-01T00:00:00Z" }] });

    expect(await createSignupLink(admin, WHO, { seasonId: SEASON, token: TOKEN, sport: "football" })).toEqual({
      id: LINK,
      expiresAt: "2026-12-01T00:00:00Z",
      token: TOKEN,
    });
    expect(admin.rpc).toHaveBeenCalledWith("create_roster_signup_link", {
      p_brand_id: BRAND,
      p_user_id: "u1",
      p_season_id: SEASON,
      p_token: TOKEN,
      p_sport: "football",
    });
  });

  it("raises a role the database refused as something the member can read", async () => {
    const admin = rpcClient({ error: { code: "42501", message: "no" } });

    await expect(createSignupLink(admin, WHO, { seasonId: SEASON, token: TOKEN, sport: "football" })).rejects.toMatchObject({
      code: "forbidden",
    });
    await expect(revokeSignupLink(admin, WHO, LINK)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("sends the pasted list as the three things a row holds, and gives back how many are on it", async () => {
    const admin = rpcClient({ data: 2 });

    expect(await setRequests(admin, WHO, SEASON, [{ name: "Alex Morgan", phone: "07700900000", email: "" }])).toBe(2);
    expect(admin.rpc).toHaveBeenCalledWith("set_roster_signup_requests", {
      p_brand_id: BRAND,
      p_user_id: "u1",
      p_season_id: SEASON,
      p_people: [{ name: "Alex Morgan", phone: "07700900000", email: "" }],
    });
  });

  it("reads one link whether the function answers with a row or a list of one", async () => {
    const single = rpcClient({ data: { id: LINK, expires_at: "2026-12-01T00:00:00Z" } });

    expect((await createSignupLink(single, WHO, { seasonId: SEASON, token: TOKEN, sport: "default" })).id).toBe(LINK);
  });
});

describe("a player's write", () => {
  it("goes through the function with the visitor's key and nothing else", async () => {
    const admin = rpcClient({});

    await submitSignup(admin, { token: TOKEN, visitorKey: "v".repeat(43), name: "MORGAN", number: "7", sizeLabel: "M", wearerGroup: "mens" });

    expect(admin.rpc).toHaveBeenCalledWith("roster_signup_submit", {
      p_token: TOKEN,
      p_visitor_key: "v".repeat(43),
      p_name: "MORGAN",
      p_number: "7",
      p_size_label: "M",
      p_wearer_group: "mens",
    });
  });

  it("raises a refused value as input to look at again", async () => {
    const admin = rpcClient({ error: { code: "22023", message: "A number is digits only." } });

    await expect(
      submitSignup(admin, { token: TOKEN, visitorKey: "v".repeat(43), name: "MORGAN", number: "x", sizeLabel: "M", wearerGroup: "mens" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });
});

describe("openSignup", () => {
  const row = {
    link_id: LINK,
    brand_id: BRAND,
    club_name: "Northside Hockey Club",
    season_name: "2027",
    expires_at: "2026-12-01T00:00:00Z",
    sport: "football",
    sport_label: "Football",
    lowest: 1,
    highest: 99,
    leading_zero_allowed: true,
    number_rule_id: "R-GAP-000",
    name_max_characters: 12,
    name_rule_id: "R-PER-001",
  };

  it("gives the club, the season, the sport's range and the zone's length, and nothing else", async () => {
    const opened = await openSignup(rpcClient({ data: [row] }), TOKEN);

    expect(opened).toMatchObject({ clubName: "Northside Hockey Club", seasonName: "2027", nameMaxCharacters: 12, nameRuleId: "R-PER-001" });
    expect(opened?.numberRule).toMatchObject({ sport: "football", label: "Football", lowest: 1, highest: 99, ruleId: "R-GAP-000" });
    expect(Object.keys(opened ?? {})).toEqual([
      "linkId",
      "brandId",
      "clubName",
      "seasonName",
      "expiresAt",
      "numberRule",
      "nameMaxCharacters",
      "nameRuleId",
    ]);
  });

  it("is nothing at all for a token that opens no link", async () => {
    expect(await openSignup(rpcClient({ data: [] }), TOKEN)).toBeNull();
    expect(await openSignup(rpcClient({ data: null }), TOKEN)).toBeNull();
  });
});

describe("the rows behind the rules", () => {
  it("reads the sports, the zones and the chase wording with the server's own key", async () => {
    const { client } = fakeClient({
      sport_number_rules: [
        { sport: "default", label: "Any sport", lowest: 0, highest: 99, leading_zero_allowed: true, rule_id: "R-GAP-000", note: "n" },
      ],
      shirt_zone_limits: [
        { zone: "back-name", label: "Name across the upper back", max_characters: 12, rule_id: "R-PER-001", note: "n" },
        { zone: "not-a-zone", label: "Nowhere", max_characters: 9, rule_id: "R-GAP-000", note: "n" },
      ],
      chase_templates: [{ id: "first-ask-whatsapp", channel: "whatsapp", subject: "", body: "Hi {player}", note: "n" }],
    });

    expect(await readNumberRules(client)).toEqual([
      { sport: "default", label: "Any sport", lowest: 0, highest: 99, leadingZeroAllowed: true, ruleId: "R-GAP-000", note: "n" },
    ]);
    // A row naming a place lib/garment does not have is left out rather than guessed at.
    expect(await readZoneLimits(client)).toHaveLength(1);
    expect((await readChaseTemplates(client))[0]?.channel).toBe("whatsapp");
  });

  it("raises what the database said rather than reading nothing as no rules", async () => {
    const { client } = fakeClient({}, { code: "P0002", message: "no" });

    await expect(readNumberRules(client)).rejects.toMatchObject({ code: "not_found" });
    await expect(readZoneLimits(client)).rejects.toMatchObject({ code: "not_found" });
    await expect(readChaseTemplates(client)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("readSeasonSignup", () => {
  it("is empty for a season nobody has collected for", async () => {
    const { client } = fakeClient({ club_seasons: [{ name: "2027" }] });

    expect(await readSeasonSignup(client, BRAND, SEASON)).toEqual({ seasonName: "2027", link: null, requests: [], entries: [] });
  });

  it("gathers the open link, the list and the answers", async () => {
    const { client } = fakeClient({
      club_seasons: [{ name: "2027" }],
      roster_signup_links: [
        { id: LINK, season_id: SEASON, sport: "football", created_at: "2026-11-01T00:00:00Z", expires_at: "2026-12-01T00:00:00Z", revoked_at: null },
      ],
      roster_signup_requests: [{ id: "44444444-4444-4444-8444-444444444444", name: "Alex Morgan", phone: "", email: "" }],
      roster_signup_entries: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          name_on_shirt: "MORGAN",
          number: "07",
          size_label: "M",
          wearer_group: "mens",
          updated_at: "2026-11-02T00:00:00Z",
        },
      ],
    });

    const read = await readSeasonSignup(client, BRAND, SEASON);

    expect(read.link).toMatchObject({ id: LINK, sport: "football", revokedAt: null });
    expect(read.requests[0]?.name).toBe("Alex Morgan");
    expect(read.entries[0]).toMatchObject({ nameOnShirt: "MORGAN", number: "07", sizeLabel: "M", wearerGroup: "mens" });
  });

  it("asks for the club's own rows every time, so one club never reads another's", async () => {
    const { client, asked } = fakeClient({ club_seasons: [{ name: "2027" }] });
    await readSeasonSignup(client, BRAND, SEASON);

    expect(asked).toHaveLength(4);
    for (const record of asked) expect(filteredOn(record), record.table).toContain(BRAND);
  });

  it("raises what the database said as a failure the member can read", async () => {
    const { client } = fakeClient({}, { code: "P0002", message: "no" });

    await expect(readSeasonSignup(client, BRAND, SEASON)).rejects.toMatchObject({ code: "not_found" });
  });
});
