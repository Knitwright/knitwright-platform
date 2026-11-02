import type { ArtworkFacts, BrandAsset, BrandColour, BrandPalette, BrandRecord } from "../types";
import { EMPTY_PROFILE } from "../types";
import type { AssetKind, FontRole } from "../words";

/** Fixtures for the Brand Studio tests. Generated here: no real club's crest or colours are committed. */

export const colour = (over: Partial<BrandColour> = {}): BrandColour => ({
  id: "c1",
  name: "Club red",
  hex: "#c8102e",
  pantoneTcx: "19-1664 TCX",
  ...over,
});

export const palette = (over: Partial<BrandPalette> = {}): BrandPalette => ({
  id: "p1",
  name: "Primary",
  colours: [colour()],
  source: "brand-studio",
  ...over,
});

export const asset = (kind: AssetKind, over: Partial<BrandAsset> = {}): BrandAsset => ({
  id: `a-${kind}`,
  kind,
  artworkId: "11111111-1111-4111-8111-111111111111",
  label: "Main mark",
  sponsorName: null,
  printWidthMm: null,
  source: "brand-studio",
  ...over,
});

export const artwork = (over: Partial<ArtworkFacts> = {}): ArtworkFacts => ({
  artworkId: "11111111-1111-4111-8111-111111111111",
  label: "Main mark",
  kind: "raster",
  widthPx: 1200,
  heightPx: 1200,
  ...over,
});

const ROLES: readonly FontRole[] = ["headline", "subheadline", "body", "accent", "name_number"];

export const record = (over: Partial<BrandRecord> = {}): BrandRecord => ({
  brandId: "22222222-2222-4222-8222-222222222222",
  brandName: "Test FC",
  profile: EMPTY_PROFILE,
  palettes: [],
  fonts: [],
  assets: [],
  ...over,
});

/** A brand that has filled everything F-S9 asks for. */
export const finishedRecord = (): BrandRecord =>
  record({
    profile: {
      ...EMPTY_PROFILE,
      kind: "club",
      category: "club",
      website: "https://example.test",
      about: "A club in the north.",
      voiceTags: ["community"],
      style: { setting: "A wet pitch at dusk.", artDirection: "Long lens, low light.", rulesBoundaries: "Never a sponsor on the sleeve." },
      defaultSizeRange: ["S", "M", "L"],
    },
    palettes: [palette()],
    fonts: ROLES.map((role) => ({ role, fontKey: "geist" })),
    assets: [asset("logo"), asset("graphic", { id: "a-graphic" }), asset("crest", { id: "a-crest" })],
  });
