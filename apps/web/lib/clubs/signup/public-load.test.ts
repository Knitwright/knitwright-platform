import { describe, expect, it, vi } from "vitest";
import { MADE_UP_CHART_SET } from "@/lib/sizing/fixtures/made-up-charts";
import { NO_CHART_SET } from "@/lib/sizing/fixtures/no-charts";
import { WEARER_GROUPS } from "../wording";
import { loadSignupPage, type SignupLoadDeps } from "./public-load";
import type { OpenSignup } from "./service";

const TOKEN = "t".repeat(43);
const BRAND = "11111111-1111-4111-8111-111111111111";

const opened = (patch: Partial<OpenSignup> = {}): OpenSignup => ({
  linkId: "22222222-2222-4222-8222-222222222222",
  brandId: BRAND,
  clubName: "Northside Hockey Club",
  seasonName: "2027",
  expiresAt: "2026-12-01T00:00:00Z",
  numberRule: { sport: "football", label: "Football", lowest: 1, highest: 99, leadingZeroAllowed: true, ruleId: "R-GAP-000", note: "" },
  nameMaxCharacters: 12,
  nameRuleId: "R-PER-001",
  ...patch,
});

const deps = (patch: Partial<SignupLoadDeps> = {}): SignupLoadDeps => ({
  open: vi.fn(async () => opened()),
  charts: vi.fn(async () => MADE_UP_CHART_SET),
  ...patch,
});

describe("loadSignupPage", () => {
  it("does not ask the database about a token that could never open a link", async () => {
    const open = vi.fn();

    expect(await loadSignupPage(deps({ open }), "short")).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });

  it("is nothing at all for a token that opens no link, so nothing tells the reasons apart", async () => {
    expect(await loadSignupPage(deps({ open: vi.fn(async () => null) }), TOKEN)).toBeNull();
  });

  it("shows the club, the season, the sport's range and how long a name may be", async () => {
    const loaded = await loadSignupPage(deps(), TOKEN);

    expect(loaded?.page).toMatchObject({
      clubName: "Northside Hockey Club",
      seasonName: "2027",
      nameMaxCharacters: 12,
      nameRuleId: "R-PER-001",
    });
    expect(loaded?.page.numberHint).toContain("1 to 99");
  });

  it("has a size guide for every cut a player may choose", async () => {
    const loaded = await loadSignupPage(deps(), TOKEN);

    expect(loaded?.page.cuts.map((cut) => cut.group)).toEqual([...WEARER_GROUPS]);
    expect(loaded?.page.cuts[0]?.guide.rows.length).toBeGreaterThan(0);
  });

  it("offers every size the club's own runs hold, each only once", async () => {
    const sizes = (await loadSignupPage(deps(), TOKEN))?.page.sizes ?? [];

    expect(sizes.length).toBeGreaterThan(0);
    expect(new Set(sizes).size).toBe(sizes.length);
  });

  it("says plainly that there is no size to choose rather than offering none in silence", async () => {
    const loaded = await loadSignupPage(deps({ charts: vi.fn(async () => NO_CHART_SET) }), TOKEN);

    expect(loaded?.page.sizes).toEqual([]);
    expect(loaded?.page.sizesNotice).toContain("has not set its sizes yet");
  });

  it("reads the charts for the club the token names, never for one a player could name", async () => {
    const charts = vi.fn(async () => MADE_UP_CHART_SET);
    await loadSignupPage(deps({ charts }), TOKEN);

    expect(charts).toHaveBeenCalledWith(BRAND);
  });
});
