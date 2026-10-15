import { describe, expect, it } from "vitest";
import { createFakeAdmin } from "@/lib/artwork-intake/fixtures/fake-admin";
import { DEFAULT_PRINT_PROFILE } from "../profiles";
import { BRAND, libraryClient } from "../fixtures/library-client";
import { loadPrintContext, RULES_NOT_FOUND_TEXT } from "./context";

const ICC_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const RULES_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const profileRow = { bleed_mm: "20", dpi: 200, min_dpi: 120, icc_file_id: ICC_ID, max_print_width_mm: null, source: "print-house" };
const fileRow = { id: ICC_ID, bucket: "uploads", path: "brand/profile.icc", content_type: "application/vnd.iccprofile", bytes: 4 };
const ruleRow = { id: RULES_ID, name: "League", source: "League handbook 2026, page 4", rules: { minTextHeightMm: 40, minLineMm: 0.5, coloursToAvoid: ["#ffffff"], numberRules: null }, updated_at: "2026-10-01T00:00:00Z", brand_id: BRAND };
const bytes = new Uint8Array([1, 2, 3, 4]);
const { admin } = createFakeAdmin();

const clientWith = (tables: Record<string, Record<string, unknown>[]>, withIcc = true) =>
  libraryClient({ print_profiles: [], league_rule_sets: [], files: [], ...tables }, withIcc ? { "uploads/brand/profile.icc": bytes } : {});

describe("loadPrintContext", () => {
  it("falls back to the labelled defaults, no colour profile and no rules, when the brand has set none", async () => {
    const context = await loadPrintContext({ client: clientWith({}), admin }, BRAND);
    expect(context.profile).toEqual(DEFAULT_PRINT_PROFILE);
    expect(context.icc).toBeNull();
    expect(context.rules).toEqual({ minTextHeightMm: null, minLineMm: null, coloursToAvoid: [], numberRules: null });
    expect(typeof context.assets.getAsset).toBe("function");
  });

  it("reads the brand's saved profile and its colour profile with the person's own client", async () => {
    const context = await loadPrintContext({ client: clientWith({ print_profiles: [profileRow], files: [fileRow] }), admin }, BRAND);
    expect(context.profile).toMatchObject({ bleedMm: 20, dpi: 200, minDpi: 120, source: "print-house" });
    expect(context.icc).toEqual(bytes);
  });

  it("goes on without a colour profile that cannot be read, and without one that is too large", async () => {
    const gone = await loadPrintContext({ client: clientWith({ print_profiles: [profileRow], files: [fileRow] }, false), admin }, BRAND);
    expect(gone.icc).toBeNull();
    const big = await loadPrintContext({ client: clientWith({ print_profiles: [profileRow], files: [{ ...fileRow, bytes: 99_000_000 }] }), admin }, BRAND);
    expect(big.icc).toBeNull();
  });

  it("uses a league rule set the brand saved, when one is named", async () => {
    const context = await loadPrintContext({ client: clientWith({ league_rule_sets: [ruleRow] }), admin }, BRAND, RULES_ID);
    expect(context.rules).toMatchObject({ minTextHeightMm: 40, coloursToAvoid: ["#ffffff"] });
  });

  it("refuses a rule set the brand does not have", async () => {
    await expect(loadPrintContext({ client: clientWith({}), admin }, BRAND, RULES_ID)).rejects.toMatchObject({ code: "not_found", message: RULES_NOT_FOUND_TEXT });
  });
});
