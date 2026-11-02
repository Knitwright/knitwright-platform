import { describe, expect, it } from "vitest";
import { isCampaign, isCampaignStyle, isDestination } from "../campaign/steps";
import { MARKETING_FORMAT_LABELS, MARKETING_GROUPS, GROUP_LABELS, isMarketingFormat, isMarketingGroup, MARKETING_FORMATS } from "./types";

/**
 * The vocabularies, and the guards that read a stored string back into one. Everything a row or an
 * address carries comes back through one of these, so a value nobody wrote never reaches a panel.
 */

describe("reading a stored value back into a vocabulary", () => {
  it("reads a format the spec gives, and nothing else", () => {
    for (const format of MARKETING_FORMATS) expect(isMarketingFormat(format), format).toBe(true);
    expect(isMarketingFormat("tiktok-9-16")).toBe(false);
    expect(isMarketingFormat("")).toBe(false);
  });

  it("reads a group the spec gives, and nothing else", () => {
    for (const group of MARKETING_GROUPS) expect(isMarketingGroup(group), group).toBe(true);
    expect(isMarketingGroup("merch")).toBe(false);
  });

  it("reads a campaign, a style and a destination the form offers, and nothing else", () => {
    expect(isCampaign("pre-order")).toBe(true);
    expect(isCampaign("whatever")).toBe(false);
    expect(isCampaignStyle("retro")).toBe(true);
    expect(isCampaignStyle("whatever")).toBe(false);
    expect(isDestination("pin-2-3")).toBe(true);
    expect(isDestination("whatever")).toBe(false);
  });

  it("has words on a screen for every format and every group", () => {
    for (const format of MARKETING_FORMATS) expect(MARKETING_FORMAT_LABELS[format].length).toBeGreaterThan(2);
    for (const group of MARKETING_GROUPS) expect(GROUP_LABELS[group].length).toBeGreaterThan(2);
  });
});
