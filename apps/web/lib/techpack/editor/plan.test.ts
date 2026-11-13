import { describe, expect, it } from "vitest";
import { PLAN_SETTINGS } from "@/lib/plans/catalogue";
import { canExportTechPacks, sheetsDownloads } from "./plan";

describe("the sheets' downloads and the plan", () => {
  it("are ♛ on Free, whose plan holds no tech pack exports", () => {
    expect(canExportTechPacks({ ...PLAN_SETTINGS, currentPlan: "free" })).toBe(false);
  });

  it("are open on a plan with exports, or with no limit", () => {
    expect(canExportTechPacks({ ...PLAN_SETTINGS, currentPlan: "starter" })).toBe(true);
    expect(canExportTechPacks({ ...PLAN_SETTINGS, currentPlan: "club_scale" })).toBe(true);
    expect(typeof canExportTechPacks()).toBe("boolean");
  });

  it("download through the tech pack's own export route", () => {
    expect(sheetsDownloads("abc")).toEqual({ xlsx: "/api/projects/abc/exports/xlsx?layout=sheets", pdf: "/api/projects/abc/exports/pdf" });
  });
});
