import { describe, expect, it } from "vitest";
import { LOGO_RIGHTS } from "@/lib/consent/wording";
import { LOGO_RIGHTS_MISSING, logoRightsFor } from "./rights";

const NOW = new Date("2026-10-11T09:00:00Z");

describe("logoRightsFor", () => {
  it("refuses artwork when the person did not confirm they may use it", () => {
    expect(logoRightsFor({ kind: "artwork", confirmed: false, userId: "u-1", now: NOW })).toEqual({ ok: false, message: LOGO_RIGHTS_MISSING });
  });

  it("records who confirmed artwork, when, and which words they saw", () => {
    expect(logoRightsFor({ kind: "artwork", confirmed: true, userId: "u-1", now: NOW })).toEqual({
      ok: true,
      rights: { confirmedBy: "u-1", confirmedAt: NOW.toISOString(), wordingVersion: LOGO_RIGHTS.version },
    });
  });

  it("asks nothing for a sketch or photo, which is read and never printed", () => {
    for (const kind of ["sketch", "photo"] as const) {
      expect(logoRightsFor({ kind, confirmed: false, userId: "u-1", now: NOW })).toEqual({ ok: true, rights: null });
      expect(logoRightsFor({ kind, confirmed: true, userId: "u-1", now: NOW })).toEqual({ ok: true, rights: null });
    }
  });

  it("says in plain words what to do", () => {
    expect(LOGO_RIGHTS_MISSING).toMatch(/^Tick the box/);
    expect(LOGO_RIGHTS_MISSING).toContain("own this logo or have permission");
  });
});
