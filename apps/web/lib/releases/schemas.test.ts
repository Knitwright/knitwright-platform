import { describe, expect, it } from "vitest";
import { PROFILE, specFor } from "./fixtures/fake-builder";
import { releaseBody, reorderBody } from "./schemas";

const settings = { patternBlockId: "jersey", patternBlockVersion: 1, fabricTestIds: [], printProfile: PROFILE };

describe("releaseBody", () => {
  it("takes a label, the settings and the file settings", () => {
    expect(releaseBody.safeParse({ label: " Round 1 ", ...settings, files: [specFor("front")] }).success).toBe(true);
  });
  it("needs a label and at least one file", () => {
    expect(releaseBody.safeParse({ label: " ", ...settings, files: [specFor("front")] }).success).toBe(false);
    expect(releaseBody.safeParse({ label: "R", ...settings, files: [] }).success).toBe(false);
  });
  it("refuses a file setting the contract refuses", () => {
    expect(releaseBody.safeParse({ label: "R", ...settings, files: [{ ...specFor("front"), format: "exe" }] }).success).toBe(false);
  });
});

describe("reorderBody", () => {
  it("takes the settings only", () => {
    expect(reorderBody.safeParse(settings).success).toBe(true);
    expect(reorderBody.safeParse({ ...settings, patternBlockVersion: 0 }).success).toBe(false);
  });
});
