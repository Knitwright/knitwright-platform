import { describe, expect, it } from "vitest";
import { logoRightsFor } from "@/lib/storage/rights";
import { checkTile, NOT_A_PICTURE, previewSeamless, removeWhiteBackground, saveSeamless, TOO_BIG_FOR_CLEAN_UP } from "./derive";
import { createFakeSupabase } from "./fixtures/fake-supabase";
import { gradientTile, logoOnWhite, stripeTile } from "./fixtures/images";
import { CLEAN_LOGO } from "./fixtures/svgs";
import { intakeArtwork } from "./intake";
import { SEAM_VERDICT, SEAMLESS_LIMIT } from "./tile";

const BRAND = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";

const setup = () => {
  const fake = createFakeSupabase();
  const check = logoRightsFor({ kind: "artwork", confirmed: true, userId: USER, now: new Date("2026-10-14T00:00:00Z") });
  if (!check.ok || !check.rights) throw new Error("rights");
  return { fake, who: { admin: fake.client, brandId: BRAND, userId: USER, rights: check.rights } };
};

describe("removeWhiteBackground", () => {
  it("makes a new artwork without the white box and remembers the original", async () => {
    const { who, fake } = setup();
    const original = await intakeArtwork(who, { bytes: await logoOnWhite(), filename: "crest.png" });
    expect(original.whiteBackground).toBe(true);
    const cleaned = await removeWhiteBackground(who, original.id);
    expect(cleaned).toMatchObject({ derivedFrom: original.id, hasAlpha: true, whiteBackground: false, name: "crest no white" });
    expect(fake.tables.user_artworks).toHaveLength(2);
  });

  it("will not work on a vector, or on a picture too large to hold as pixels", async () => {
    const { who, fake } = setup();
    const vector = await intakeArtwork(who, { bytes: new TextEncoder().encode(CLEAN_LOGO) });
    await expect(removeWhiteBackground(who, vector.id)).rejects.toMatchObject({ message: NOT_A_PICTURE });
    const picture = await intakeArtwork(who, { bytes: await logoOnWhite() });
    (fake.tables.user_artworks.find((r) => r.id === picture.id) as { width_px: number; height_px: number }).width_px = 9000;
    (fake.tables.user_artworks.find((r) => r.id === picture.id) as { height_px: number }).height_px = 9000;
    await expect(removeWhiteBackground(who, picture.id)).rejects.toMatchObject({ message: TOO_BIG_FOR_CLEAN_UP });
  });

  it("does not find another brand's artwork", async () => {
    const { who } = setup();
    const mine = await intakeArtwork(who, { bytes: await logoOnWhite() });
    await expect(removeWhiteBackground({ ...who, brandId: "99999999-9999-4999-8999-999999999999" }, mine.id)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("tiles", () => {
  it("shows a mismatch for a tile with a seam, and a 3 x 3 preview", async () => {
    const { who } = setup();
    const tile = await intakeArtwork(who, { bytes: await gradientTile() });
    const result = await checkTile(who, tile.id);
    expect(result.seam).toMatchObject({ showsSeam: true, verdict: SEAM_VERDICT });
    expect(result.seam.mismatch).toBeGreaterThan(10);
    expect(Buffer.from(result.previewPng, "base64").subarray(1, 4).toString("ascii")).toBe("PNG");
  });

  it("finds the repeat of stripes", async () => {
    const { who } = setup();
    const tile = await intakeArtwork(who, { bytes: await stripeTile(128, 16) });
    const result = await checkTile(who, tile.id);
    expect(result.seam.showsSeam).toBe(false);
    expect(result.repeat.periodX).toBe(16);
  });

  it("lowers the mismatch by making it seamless, and shows the result 3 x 3 before anything is saved", async () => {
    const { who, fake } = setup();
    const tile = await intakeArtwork(who, { bytes: await gradientTile() });
    const preview = await previewSeamless(who, tile.id, "blend");
    expect(preview.after.mismatch).toBeLessThan(preview.before.mismatch);
    expect(preview.limit).toBe(SEAMLESS_LIMIT);
    expect(preview.previewPng.length).toBeGreaterThan(100);
    expect(fake.tables.user_artworks).toHaveLength(1);
    const saved = await saveSeamless(who, tile.id, "mirror");
    expect(saved).toMatchObject({ derivedFrom: tile.id, name: "Artwork seamless", widthPx: 128 });
    expect(fake.tables.user_artworks).toHaveLength(2);
  });
});
