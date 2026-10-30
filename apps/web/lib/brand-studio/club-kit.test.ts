import { describe, expect, it } from "vitest";
import { EMPTY_KIT, type Kit } from "@/lib/clubs/kit";
import { clubKitAssets, clubKitPalette, hasClubKit, type ClubKitFacts } from "./club-kit";

/**
 * The club kit read through into Brand Studio. Nothing is copied, so nothing can be lost
 * (decision 0079). The first test pins the shape against `lib/clubs/kit.ts` itself: if the club kit
 * ever gains or loses a field, this file is told.
 */

describe("the shape it reads", () => {
  it("accepts the club kit as `lib/clubs/kit.ts` defines it", () => {
    const kit: Kit = EMPTY_KIT;
    const facts: ClubKitFacts = kit;
    expect(hasClubKit(facts)).toBe(false);
  });
});

const kit = (over: Partial<ClubKitFacts> = {}): ClubKitFacts => ({
  primaryColour: null,
  secondaryColour: null,
  accentColour: null,
  crestFileId: null,
  sponsors: [],
  ...over,
});

describe("clubKitPalette", () => {
  it("has no palette for a club that has chosen no colour", () => {
    expect(clubKitPalette(kit())).toBeNull();
  });

  it("shows the colours a club did choose, with the names /club already uses", () => {
    const found = clubKitPalette(kit({ primaryColour: "#0B3D91", accentColour: "#ffd100" }));
    expect(found).toEqual({
      id: "club-kit",
      name: "Club kit",
      source: "club-kit",
      colours: [
        { id: "club-primary", name: "Main colour", hex: "#0b3d91", pantoneTcx: null },
        { id: "club-accent", name: "Accent colour", hex: "#ffd100", pantoneTcx: null },
      ],
    });
  });

  it("never invents a Pantone code for a colour the club picked on a screen", () => {
    expect(clubKitPalette(kit({ primaryColour: "#0b3d91" }))!.colours.every((colour) => colour.pantoneTcx === null)).toBe(true);
  });

  it("is marked as somebody else's to write, so Brand Studio never saves over it", () => {
    expect(clubKitPalette(kit({ secondaryColour: "#ffffff" }))!.source).toBe("club-kit");
  });
});

describe("clubKitAssets", () => {
  it("has nothing for a club with no crest and no sponsor logos", () => {
    expect(clubKitAssets(kit({ sponsors: [{ name: "Northern Gas", logoFileId: null }] }))).toEqual([]);
  });

  it("shows the crest and every sponsor that has a logo, crest first", () => {
    const assets = clubKitAssets(
      kit({
        crestFileId: "f1",
        sponsors: [
          { name: "Northern Gas", logoFileId: "f2" },
          { name: "No logo", logoFileId: null },
          { name: "", logoFileId: "f3" },
        ],
      }),
    );
    expect(assets.map((asset) => [asset.id, asset.kind, asset.artworkId, asset.label])).toEqual([
      ["club-crest", "crest", "f1", "Crest"],
      ["club-sponsor-0", "sponsor", "f2", "Northern Gas"],
      ["club-sponsor-2", "sponsor", "f3", "Sponsor 3"],
    ]);
    expect(assets.every((asset) => asset.source === "club-kit" && asset.printWidthMm === null)).toBe(true);
  });

  it("gives a nameless sponsor no name rather than making one up", () => {
    expect(clubKitAssets(kit({ sponsors: [{ name: "", logoFileId: "f3" }] }))[0]!.sponsorName).toBeNull();
  });
});

describe("hasClubKit", () => {
  it("is true as soon as the club has chosen a colour or uploaded a crest", () => {
    expect(hasClubKit(kit({ primaryColour: "#0b3d91" }))).toBe(true);
    expect(hasClubKit(kit({ crestFileId: "f1" }))).toBe(true);
    expect(hasClubKit(kit())).toBe(false);
  });
});
