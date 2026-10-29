import { describe, expect, it } from "vitest";
import { allAssetFindings, assetFindings, MIN_DPI } from "./assets";
import { artwork, asset } from "./fixtures/brand";
import { RULES } from "./words";

/** The DPI check of F-S9's Sportswear tab. No print width is ever assumed (R-SUB-003 gives none). */

describe("assetFindings", () => {
  it("says nothing about a logo or a graphic: F-S9 puts the check on the Sportswear pictures", () => {
    for (const kind of ["logo", "graphic", "packaging"] as const) {
      expect(assetFindings({ asset: asset(kind), artwork: artwork() })).toEqual([]);
    }
  });

  it("says nothing about a drawing, whatever size it is printed at", () => {
    expect(assetFindings({ asset: asset("sponsor", { printWidthMm: 400 }), artwork: artwork({ kind: "vector" }) })).toEqual([]);
  });

  it("says nothing when the upload behind the picture is gone", () => {
    expect(assetFindings({ asset: asset("crest"), artwork: null })).toEqual([]);
  });

  it("prefers a drawing, and says the width is still the brand's to set", () => {
    const findings = assetFindings({ asset: asset("sponsor", { sponsorName: "Northern Gas" }), artwork: artwork({ widthPx: 1200 }) });
    expect(findings.map((finding) => finding.code)).toEqual(["sponsor-raster", "sponsor-dpi"]);
    expect(findings.every((finding) => finding.ruleId === RULES.printResolution)).toBe(true);
    expect(findings[1]!.severity).toBe("note");
    expect(findings[1]!.message).toContain("Northern Gas is 1200 by 1200 pixels");
    expect(findings[1]!.message).toContain("203 mm wide");
    expect(findings[1]!.message).toContain("still yours to set");
  });

  it("warns when the picture is too small for the width the brand typed", () => {
    const findings = assetFindings({ asset: asset("sponsor", { sponsorName: "Northern Gas", printWidthMm: 250 }), artwork: artwork({ widthPx: 600 }) });
    expect(findings[1]).toMatchObject({ code: "sponsor-dpi", severity: "warning", ruleId: RULES.printResolution });
    expect(findings[1]!.message).toContain("61 dpi");
    expect(findings[1]!.message).toContain(`${MIN_DPI.value} dpi minimum`);
    expect(findings[1]!.message).toContain("Knitwright default, not from your print house");
    expect(findings[1]!.fix).toContain("102 mm");
  });

  it("only prefers a drawing when the picture is big enough for the width typed", () => {
    const findings = assetFindings({ asset: asset("crest", { printWidthMm: 100 }), artwork: artwork({ widthPx: 1200 }) });
    expect(findings.map((finding) => finding.code)).toEqual(["sponsor-raster"]);
  });

  it("falls back to the picture's own name when there is no sponsor and no label", () => {
    const findings = assetFindings({ asset: asset("label", { label: "  " }), artwork: artwork() });
    expect(findings[0]!.subject).toBe("Label artwork");
  });

  it("treats a width of zero as no width at all, rather than dividing by it", () => {
    const findings = assetFindings({ asset: asset("crest", { printWidthMm: 0 }), artwork: artwork() });
    expect(findings[1]!.severity).toBe("note");
  });
});

describe("allAssetFindings", () => {
  it("keeps the order of the pictures it was given", () => {
    const findings = allAssetFindings([
      { asset: asset("crest", { label: "Crest" }), artwork: artwork({ widthPx: 300 }) },
      { asset: asset("sponsor", { id: "s1", sponsorName: "Northern Gas", printWidthMm: 200 }), artwork: artwork({ widthPx: 300 }) },
    ]);
    expect(findings.map((finding) => finding.subject)).toEqual(["Crest", "Crest", "Northern Gas", "Northern Gas"]);
  });

  it("has nothing to say about a brand with no pictures", () => {
    expect(allAssetFindings([])).toEqual([]);
  });
});
