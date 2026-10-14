import { describe, expect, it } from "vitest";
import type { ArtworkRecord } from "./records";
import { describeArtwork, dpiReadout, FORMATS_HINT, seamChangeSentence, seamSentence } from "./wording";

const base: ArtworkRecord = {
  id: "11111111-1111-4111-8111-111111111111", brandId: "b", kind: "raster", sourceFormat: "tiff", label: "x", widthPx: 6000, heightPx: 4000,
  dpiMeta: 600, colourSpace: "cmyk", profileName: "ISO Coated", hasAlpha: false, screenFileId: "s", printFileId: "p", vectorFileId: null,
  warnings: [], sourceSha256: "a", printSha256: "b", createdAt: "2026-10-14T00:00:00Z",
};

describe("describeArtwork", () => {
  it("says what a picture is in one line", () => {
    expect(describeArtwork(base)).toBe("TIFF picture, 6000 x 4000 pixels, 600 dpi stated, CMYK turned into screen colours");
    expect(describeArtwork({ ...base, dpiMeta: null, colourSpace: "srgb", hasAlpha: true, sourceFormat: "png" })).toBe(
      "PNG picture, 6000 x 4000 pixels, no resolution stated, has see-through parts",
    );
  });

  it("says a vector prints sharp at any size", () => {
    expect(describeArtwork({ ...base, kind: "vector", sourceFormat: "svg", hasAlpha: true })).toBe("SVG drawing, prints sharp at any size, has see-through parts");
  });
});

describe("readouts", () => {
  it("rounds the dpi to the nearest 1 and speaks for a vector too", () => {
    expect(dpiReadout(63.5, 400)).toBe("At 400 mm wide this prints at about 64 dpi.");
    expect(dpiReadout(null, 90)).toContain("stays sharp");
  });

  it("gives the seam verdict with its number and the before and after", () => {
    const before = { mismatch: 18.4, horizontal: 18.4, vertical: 0, seamless: false, verdict: "The repeat shows a seam." };
    const after = { mismatch: 1.2, horizontal: 1.2, vertical: 0, seamless: true, verdict: "The repeat looks seamless." };
    expect(seamSentence(before)).toBe("The repeat shows a seam. The edges differ by 18.4 out of 100.");
    expect(seamChangeSentence(before, after)).toBe("The edges differed by 18.4 out of 100 and now differ by 1.2. The repeat looks seamless.");
  });

  it("tells people which files are accepted", () => {
    expect(FORMATS_HINT).toContain("Create PDF compatible file");
  });
});
