import { describe, expect, it } from "vitest";
import { designVersionHash } from "@/lib/credits/version-hash";
import { allRows } from "@/lib/factory/fixtures/rows";
import { toCountryRule } from "@/lib/factory/rows";
import { DEFAULT_SETTINGS } from "@/lib/guardrails";
import { DEFAULT_PRINT_PROFILE } from "@/lib/print/profiles";
import type { ModerationStatus, ModerationTarget } from "@/lib/validation/ports";
import { designFactsOf, MADE_BY_KNITWRIGHT, MADE_BY_NOTE, marketsOf, moderationOf, printSettingsOf } from "./rows";

/** The decisions the export route makes while it gathers the rows a production package is built from. */

const PROJECT = "11111111-1111-4111-8111-111111111111";

const project = (patch: Partial<Parameters<typeof designFactsOf>[0]> = {}) => ({
  id: PROJECT,
  name: "Home Kit 2027",
  styleNumber: "HK-2027",
  season: "SS27",
  currentVersion: 3,
  versionSavedAt: "2026-10-01T09:00:00.000Z",
  ...patch,
});

const target = (id: string): ModerationTarget => ({ kind: "asset", id, label: "Club crest" });
const status = (id: string, result: ModerationStatus["result"]): ModerationStatus => ({ target: target(id), result });

describe("the design version a package is built from", () => {
  it("is hashed the way the credits gate hashes it, so a package and its charge name one version", () => {
    expect(designFactsOf(project(), "Acme FC").hash).toBe(designVersionHash(PROJECT, 3));
  });

  it("pins the package to when the version was saved, not to the clock", () => {
    expect(designFactsOf(project(), "Acme FC").createdAtIso).toBe("2026-10-01T09:00:00.000Z");
  });

  it("carries the style number, the name, the brand and the season, and leaves a blank season out", () => {
    expect(designFactsOf(project(), "Acme FC")).toMatchObject({ code: "HK-2027", name: "Home Kit 2027", brand: "Acme FC", version: 3, season: "SS27" });
    expect(designFactsOf(project({ season: "   " }), "Acme FC").season).toBeNull();
  });
});

describe("the print thresholds the package states", () => {
  it("are the brand's own print profile, with where they came from", () => {
    const settings = printSettingsOf({ ...DEFAULT_PRINT_PROFILE, dpi: 300, bleedMm: 12, minDpi: 200, source: "print-house" });

    expect(settings.minDpi).toEqual({ value: 200, source: "print-house" });
    expect(settings.bleedMm).toEqual({ value: 12, source: "print-house" });
  });

  it("leave the safe zone as the labelled guardrail default, because a print profile holds none", () => {
    expect(printSettingsOf(DEFAULT_PRINT_PROFILE).safeZoneMm).toEqual(DEFAULT_SETTINGS.safeZoneMm);
    expect(printSettingsOf(DEFAULT_PRINT_PROFILE).minDpi.source).toBe("knitwright-default");
  });
});

describe("what the package says about moderation", () => {
  it("is flagged when anything was flagged or blocked, whatever else was clear", () => {
    expect(moderationOf([target("a"), target("b")], [status("a", "clear"), status("b", "flagged")])).toBe("flagged");
    expect(moderationOf([target("a")], [status("a", "blocked")])).toBe("flagged");
  });

  it("is pending while a screening is still running", () => {
    expect(moderationOf([target("a")], [status("a", "pending")])).toBe("pending");
  });

  it("is clear only when every target of the design has a kept screening", () => {
    expect(moderationOf([target("a"), target("b")], [status("a", "clear"), status("b", "clear")])).toBe("clear");
    expect(moderationOf([target("a"), target("b")], [status("a", "clear")])).toBe("not_built");
  });

  it("says no check was made for a design with nothing screened, rather than calling it clear", () => {
    expect(moderationOf([], [])).toBe("not_built");
    expect(moderationOf([target("a")], [])).toBe("not_built");
  });
});

describe("the markets a care label is written for", () => {
  it("are the countries selling is open in, in a fixed order", () => {
    const rules = allRows.country_rules.map(toCountryRule);

    const markets = marketsOf(rules);

    expect(markets.length).toBeGreaterThan(0);
    expect(markets.every((rule) => rule.sellingEnabled)).toBe(true);
    expect(markets.map((rule) => rule.country)).toEqual([...markets.map((rule) => rule.country)].sort());
    expect(markets.length).toBeLessThan(rules.length);
  });
});

describe("who places the order", () => {
  it("is not on file, so the package is charged and says so rather than letting the answer pass unnoticed", () => {
    expect(MADE_BY_KNITWRIGHT).toBe(false);
    expect(MADE_BY_NOTE).toContain("placeholder price");
    expect(MADE_BY_NOTE).toContain("No row on file says who places this order");
  });
});
