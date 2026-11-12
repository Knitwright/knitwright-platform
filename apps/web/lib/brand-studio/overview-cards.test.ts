import { describe, expect, it } from "vitest";
import { memberSummary, accountSummary } from "@/components/settings/v3/summary";
import { brandIsEmpty, initialsOf, overviewCards } from "./overview-cards";
import { EMPTY_PROFILE, type BrandRecord } from "./types";

const empty: BrandRecord = { brandId: "b", brandName: "Lahore Lions FC", profile: EMPTY_PROFILE, palettes: [], fonts: [], assets: [] };

const asset = (kind: BrandRecord["assets"][number]["kind"], id: string) => ({ id, kind, artworkId: id, label: id, sponsorName: null, printWidthMm: null, source: "brand-studio" as const });

const filled: BrandRecord = {
  ...empty,
  profile: {
    ...EMPTY_PROFILE,
    about: "Grassroots football club.",
    voiceTags: ["gritty", "community"],
    style: { setting: "Floodlit pitch", artDirection: "Grain", rulesBoundaries: "No neon" },
    defaultSizeRange: ["XS", "M", "3XL"],
  },
  palettes: [
    { id: "p", name: "Primary", source: "brand-studio", colours: [{ id: "c1", name: "Navy", hex: "#0b1f4b", pantoneTcx: null }, { id: "c2", name: "Gold", hex: "#f2b705", pantoneTcx: null }] },
    { id: "q", name: "Away", source: "brand-studio", colours: [] },
  ],
  fonts: [
    { role: "headline", fontKey: "geist" },
    { role: "name_number", fontKey: "geist" },
    { role: "body", fontKey: null },
  ],
  assets: [asset("logo", "l1"), asset("logo", "l2"), asset("graphic", "g1"), asset("crest", "c"), asset("sponsor", "s"), asset("label", "lb")],
};

describe("the Brand overview cards", () => {
  it("count each part and say what is missing on an empty brand", () => {
    const cards = overviewCards(empty);
    expect(cards.map((card) => card.title)).toEqual(["Logos", "Colours", "Fonts", "Graphics", "Visual style", "Sportswear"]);
    expect(cards.slice(0, 5).every((card) => card.pill === null && card.line !== null)).toBe(true);
    expect(cards[5].line).toBe("No crest yet · no default sizes");
  });

  it("show counts, the first palette's swatches, the chosen font roles, the voice tags and the sportswear checks", () => {
    const [logos, colours, fonts, graphics, style, sportswear] = overviewCards(filled);
    expect(logos.pill).toBe("2");
    expect(colours).toMatchObject({ pill: "2 palettes", swatches: ["#0b1f4b", "#f2b705"], line: null });
    expect(fonts).toMatchObject({ pill: "2 styles", chips: ["Headline", "Name & number"] });
    expect(graphics.pill).toBe("1");
    expect(style).toMatchObject({ pill: "Added", chips: ["Gritty", "Community"], line: null });
    expect(sportswear.line).toBe("Crest ✓ · 1 sponsor · XS–3XL · care label ✓");
  });

  it("call a brand empty only when nothing at all is saved", () => {
    expect(brandIsEmpty(empty)).toBe(true);
    expect(brandIsEmpty(filled)).toBe(false);
    expect(brandIsEmpty({ ...empty, fonts: [{ role: "body", fontKey: "geist" }] })).toBe(false);
    expect(brandIsEmpty({ ...empty, profile: { ...EMPTY_PROFILE, style: { ...EMPTY_PROFILE.style, setting: "x" } } })).toBe(false);
  });

  it("take initials from the words of a name", () => {
    expect(initialsOf("Lahore Lions FC")).toBe("LL");
    expect(initialsOf("Northfield")).toBe("N");
    expect(initialsOf("ABC")).toBe("A");
  });
});

describe("Settings' summaries", () => {
  it("count editors and viewers", () => {
    expect(memberSummary(["owner", "kit_manager", "viewer", "viewer", "viewer"])).toBe("2 editors · 3 viewers");
    expect(memberSummary(["owner"])).toBe("1 editor");
    expect(memberSummary([])).toBe("No members yet");
  });

  it("name the account", () => {
    expect(accountSummary("Ana", "ana@example.test")).toBe("Ana · ana@example.test");
    expect(accountSummary("", "ana@example.test")).toBe("Signed in as ana@example.test");
    expect(accountSummary("", null)).toBe("Signed in");
    expect(accountSummary("Ana", null)).toBe("Ana");
  });
});
