import { describe, expect, it } from "vitest";
import { NAME_ZONE, checkAgainstZones, isZone, limitOf, zoneHint, type ZoneLimit } from "./zones";

const limit = (patch: Partial<ZoneLimit> = {}): ZoneLimit => ({
  zone: "back-name",
  label: "Name across the upper back",
  maxCharacters: 12,
  ruleId: "R-PER-001",
  note: 'R-PER-001 for JSY-SS-01: "max 12 characters"',
  ...patch,
});

const NUMBER_ZONE = limit({ zone: "back-number", label: "Number on the back", maxCharacters: 2, ruleId: "R-GAP-000" });

describe("the zones", () => {
  it("knows the places lib/garment names, and nothing else", () => {
    expect(isZone("back-name")).toBe(true);
    expect(isZone("sleeve-name")).toBe(false);
    expect(NAME_ZONE).toBe("back-name");
  });

  it("finds one zone's row, or says there is none rather than guessing", () => {
    expect(limitOf([limit()], "back-name")?.maxCharacters).toBe(12);
    expect(limitOf([limit()], "leg-number")).toBeNull();
  });

  it("quotes the row in the hint, naming the place the limit comes from", () => {
    expect(zoneHint(limit())).toBe("Up to 12 characters, because of the space on the name across the upper back.");
  });
});

describe("checkAgainstZones", () => {
  it("takes a name that fits", () => {
    expect(checkAgainstZones([limit(), NUMBER_ZONE], " MORGAN ")).toEqual({ ok: true });
  });

  it("refuses a name longer than the tightest zone that prints a name, and counts it back", () => {
    const refused = checkAgainstZones([limit()], "VANDERBERGHESEN");

    expect(refused).toMatchObject({ ok: false, ruleId: "R-PER-001", zone: "back-name" });
    expect(refused.ok === false && refused.message).toBe("A name on the name across the upper back fits 12 characters. Yours has 15.");
  });

  it("checks every zone that prints a name, not only the first", () => {
    const tighter = limit({ zone: "back-name", maxCharacters: 6, ruleId: "R-GAP-000" });

    expect(checkAgainstZones([limit(), tighter], "MORGANS")).toMatchObject({ ok: false, ruleId: "R-GAP-000" });
  });

  it("ignores a zone that prints a number, because a number is not a name", () => {
    expect(checkAgainstZones([limit(), NUMBER_ZONE], "MORGAN")).toEqual({ ok: true });
  });

  it("refuses an empty name, naming the zone that would have taken it", () => {
    expect(checkAgainstZones([limit()], "   ")).toMatchObject({ ok: false, zone: "back-name" });
  });

  it("says plainly that no limit is set rather than letting anything through", () => {
    const none = checkAgainstZones([NUMBER_ZONE], "MORGAN");

    expect(none).toMatchObject({ ok: false, ruleId: "R-GAP-000" });
    expect(none.ok === false && none.message).toContain("has not set how long a shirt name may be");
  });
});
