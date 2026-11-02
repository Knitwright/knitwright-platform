import { describe, expect, it } from "vitest";
import { CMYK_FORMATS, WHY_NO_CMYK, colourNote, colourVerdict, noCmykProfile, type CmykProfile } from "./colour";
import { FILE_FORMATS } from "./targets";

const PROFILE: CmykProfile = { name: "A press profile somebody put on file", fileId: "file-1" };

describe("RGB and CMYK", () => {
  it("makes an RGB file in every format, with no profile needed", () => {
    for (const format of FILE_FORMATS) {
      const verdict = colourVerdict("rgb", format, null);
      expect(verdict.ok, format).toBe(true);
      expect(verdict.ok && verdict.profile).toBeNull();
    }
  });

  it("refuses CMYK while no profile is on file, in the words the panel shows", () => {
    for (const format of CMYK_FORMATS) {
      const verdict = colourVerdict("cmyk", format, null);
      expect(verdict.ok, format).toBe(false);
      expect(verdict.ok ? "" : verdict.reason).toBe(WHY_NO_CMYK);
      expect(verdict.ok ? "" : verdict.ruleId).toBe("R-GAP-000");
    }
  });

  it("refuses CMYK in a format that cannot carry a separation at all", () => {
    for (const format of FILE_FORMATS.filter((one) => !CMYK_FORMATS.includes(one))) {
      const verdict = colourVerdict("cmyk", format, PROFILE);
      expect(verdict.ok, format).toBe(false);
      expect(verdict.ok ? "" : verdict.reason).toContain("A CMYK file is a JPEG or a PDF");
    }
  });

  it("makes a CMYK file once a profile is on file, and keeps which one it was", () => {
    const verdict = colourVerdict("cmyk", "pdf", PROFILE);
    expect(verdict.ok && verdict.profile).toEqual(PROFILE);
  });

  it("has no profile on file today, which is why the panel says so", async () => {
    expect(await noCmykProfile.read()).toBeNull();
  });

  it("says on the screen what it is doing, or why it will not", () => {
    expect(colourNote("rgb", null)).toBe("RGB, which is what a screen shows.");
    expect(colourNote("cmyk", null)).toBe(WHY_NO_CMYK);
    expect(colourNote("cmyk", PROFILE)).toBe("Separated against A press profile somebody put on file, on the server.");
  });
});
