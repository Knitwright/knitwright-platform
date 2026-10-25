import { describe, expect, it } from "vitest";
import { findSetting } from "@/lib/settings/registry";
import { PATTERN_PRICE_KEY, PATTERN_TURNAROUND_KEY } from "./keys";
import { PATTERN_SERVICE_SETTINGS } from "./settings";

describe("the pattern service settings", () => {
  it("are registered and start as not set", () => {
    for (const key of [PATTERN_PRICE_KEY, PATTERN_TURNAROUND_KEY]) {
      expect(findSetting(key)?.fallback).toBeNull();
    }
    expect(PATTERN_SERVICE_SETTINGS).toHaveLength(2);
  });

  it("accept empty or a whole number and refuse anything else", () => {
    const price = findSetting(PATTERN_PRICE_KEY)!.schema;
    expect(price.safeParse(null).success).toBe(true);
    expect(price.safeParse(0).success).toBe(true);
    expect(price.safeParse(12).success).toBe(true);
    expect(price.safeParse(-1).success).toBe(false);
    expect(price.safeParse(1.5).success).toBe(false);
    const days = findSetting(PATTERN_TURNAROUND_KEY)!.schema;
    expect(days.safeParse(5).success).toBe(true);
    expect(days.safeParse(0).success).toBe(false);
  });
});
