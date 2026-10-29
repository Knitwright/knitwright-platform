import { describe, expect, it } from "vitest";
import { RULE_ID } from "@/lib/rulebook/constants";
import {
  ASSET_KINDS,
  ASSET_KIND_LABELS,
  BRAND_CATEGORIES,
  BRAND_TABS,
  CATEGORY_LABELS,
  FONT_ROLES,
  FONT_ROLE_LABELS,
  kindOf,
  LIMITS,
  RULES,
  STYLE_FIELDS,
  STYLE_HINTS,
  STYLE_LABELS,
  TAB_LABELS,
  VOICE_TAGS,
  VOICE_TAG_LABELS,
} from "./words";

/** The words of F-S9, and the rule ids behind every finding. */

describe("the spec's lists", () => {
  it("holds the five categories of F-S9, in the spec's order", () => {
    expect(BRAND_CATEGORIES.map((category) => CATEGORY_LABELS[category])).toEqual([
      "Club",
      "Sportswear brand",
      "Gym",
      "Esports team",
      "School",
    ]);
  });

  it("holds the five font roles of F-S9, in the spec's order", () => {
    expect(FONT_ROLES.map((role) => FONT_ROLE_LABELS[role])).toEqual(["Headline", "Subheadline", "Body", "Accent", "Name & number"]);
  });

  it("holds the seven brand page tabs of F-S9, in the spec's order", () => {
    expect(BRAND_TABS.map((tab) => TAB_LABELS[tab])).toEqual([
      "Overview",
      "Logos",
      "Colours",
      "Fonts",
      "Graphics",
      "Visual style",
      "Sportswear",
    ]);
  });

  it("holds the three visual-style texts of F-S9, each with a hint", () => {
    expect(STYLE_FIELDS.map((field) => STYLE_LABELS[field])).toEqual(["Setting", "Art direction", "Rules & boundaries"]);
    expect(STYLE_FIELDS.every((field) => STYLE_HINTS[field].length > 10)).toBe(true);
  });

  it("holds the voice and tone tags the spec names", () => {
    expect(VOICE_TAGS.map((tag) => VOICE_TAG_LABELS[tag])).toEqual(["Bold", "Gritty", "Community", "Premium", "Playful"]);
  });

  it("labels every kind of picture, and gives each a limit", () => {
    expect(ASSET_KINDS.every((kind) => ASSET_KIND_LABELS[kind] !== undefined)).toBe(true);
    expect(ASSET_KINDS.every((kind) => LIMITS.assetsPerKind[kind] >= 1)).toBe(true);
  });
});

describe("kindOf", () => {
  it("makes a club of a club and a school, and a brand of the rest", () => {
    expect(BRAND_CATEGORIES.map(kindOf)).toEqual(["club", "brand", "brand", "brand", "club"]);
  });
});

describe("the rules behind the findings", () => {
  it("names only well-formed rule ids", () => {
    expect(Object.values(RULES).every((ruleId) => RULE_ID.test(ruleId))).toBe(true);
  });

  it("uses the gap rule for the sublimation gamut, which no rulebook entry covers", () => {
    expect(RULES.gamutEstimate).toBe("R-GAP-000");
  });

  it("uses the rulebook's own entries where there is one", () => {
    expect(RULES.printResolution).toBe("R-SUB-003");
    expect(RULES.colourStrikeOff).toBe("R-SUB-005");
  });
});

describe("the limits", () => {
  it("allows the 1,000 characters F-S9 asks for in About", () => {
    expect(LIMITS.about).toBe(1000);
  });

  it("allows the three sponsors the club kit already allows (decision 0042)", () => {
    expect(LIMITS.assetsPerKind.sponsor).toBe(3);
  });

  it("allows one crest, because a brand has one", () => {
    expect(LIMITS.assetsPerKind.crest).toBe(1);
  });
});
