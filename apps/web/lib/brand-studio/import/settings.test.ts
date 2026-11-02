import { describe, expect, it } from "vitest";
import type { StoredSettings } from "@/lib/settings/types";
import { DEFAULT_IMPORT_SETTINGS, IMPORT_SETTING_KEYS, brandRunKey, hostRequestKey, importLimits, importSettingsWith } from "./settings";

/**
 * "Data, not constants": every allowance, timeout and weight of brand import has a key, a schema
 * and a labelled default, so a platform admin's row can replace it without a deploy.
 */

const stored = (rows: Readonly<Record<string, unknown>>): StoredSettings =>
  Object.fromEntries(Object.entries(rows).map(([key, value]) => [key, { key, value, setBy: "admin", setAt: "2026-11-02T00:00:00.000Z" }]));

describe("the settings of an import", () => {
  it("every figure has a key, and no two share one", () => {
    const keys = Object.values(IMPORT_SETTING_KEYS).map((one) => one.key);
    expect(keys.every((key) => key.startsWith("brand_import."))).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every default is a whole, positive number its own schema accepts", () => {
    for (const [name, one] of Object.entries(IMPORT_SETTING_KEYS)) {
      const value = DEFAULT_IMPORT_SETTINGS[name as keyof typeof DEFAULT_IMPORT_SETTINGS];
      expect(Number.isInteger(value) && value > 0, name).toBe(true);
      expect(one.schema.safeParse(value).success, name).toBe(true);
    }
  });

  it("asks for one page, a handful of pictures and about a minute, as F-S9 says", () => {
    expect(DEFAULT_IMPORT_SETTINGS.budgetMs).toBe(60_000);
    expect(DEFAULT_IMPORT_SETTINGS.timeoutMs).toBe(10_000);
    expect(DEFAULT_IMPORT_SETTINGS.stylePictures).toBe(5);
  });
});

describe("importSettingsWith", () => {
  it("gives the defaults when nothing is stored", () => {
    expect(importSettingsWith({})).toEqual(DEFAULT_IMPORT_SETTINGS);
  });

  it("lets a platform row replace one figure and leaves the rest alone", () => {
    const settings = importSettingsWith(stored({ "brand_import.pictures": 3 }));
    expect(settings.pictures).toBe(3);
    expect(settings.timeoutMs).toBe(DEFAULT_IMPORT_SETTINGS.timeoutMs);
  });

  it("ignores a row its schema refuses, so a bad row cannot break an import", () => {
    expect(importSettingsWith(stored({ "brand_import.timeout_ms": 0 })).timeoutMs).toBe(DEFAULT_IMPORT_SETTINGS.timeoutMs);
    expect(importSettingsWith(stored({ "brand_import.pictures": "lots" })).pictures).toBe(DEFAULT_IMPORT_SETTINGS.pictures);
  });

  it("lays rows over a base of somebody else's choosing", () => {
    const base = { ...DEFAULT_IMPORT_SETTINGS, colours: 2 };
    expect(importSettingsWith({}, base).colours).toBe(2);
  });
});

describe("the per-brand allowances", () => {
  it("counts an import per brand and a request per brand and site", () => {
    const limits = importLimits();
    expect(limits.brandRun).toEqual({ name: "brand-import-run", limit: DEFAULT_IMPORT_SETTINGS.importsPerHour, windowSeconds: 3600 });
    expect(limits.hostRequest.limit).toBe(DEFAULT_IMPORT_SETTINGS.requestsPerHostPerHour);
  });

  it("takes its numbers from the settings, not from a literal", () => {
    expect(importLimits({ ...DEFAULT_IMPORT_SETTINGS, importsPerHour: 1 }).brandRun.limit).toBe(1);
  });

  it("keys a count by the brand, and by the brand and site, with the site lower case", () => {
    expect(brandRunKey("b1")).toBe("brand-import-run:brand:b1");
    expect(hostRequestKey("b1", "Ravensmoor.TEST")).toBe("brand-import-host:brand:b1:host:ravensmoor.test");
  });
});
