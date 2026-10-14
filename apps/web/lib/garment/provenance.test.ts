import { describe, expect, it } from "vitest";
import { PROVENANCE_LABELS, PROVENANCE_VALUES, provenanceSchema } from "./provenance";

describe("provenance", () => {
  it("has exactly the seven agreed values", () => {
    expect([...PROVENANCE_VALUES]).toEqual([
      "brand-supplied",
      "user-edited",
      "suggested-chart",
      "ai-suggested",
      "read-from-image",
      "derived",
      "measured-from-pattern",
    ]);
  });

  it("accepts each agreed value", () => {
    for (const value of PROVENANCE_VALUES) {
      expect(provenanceSchema.safeParse(value).success).toBe(true);
    }
  });

  it("rejects verified, reviewed and anything else", () => {
    for (const value of ["verified", "reviewed", "", "User-Edited", null, undefined, 3]) {
      expect(provenanceSchema.safeParse(value).success).toBe(false);
    }
  });

  it("explains every value in plain words", () => {
    for (const value of PROVENANCE_VALUES) {
      expect(PROVENANCE_LABELS[value].length).toBeGreaterThan(5);
    }
  });
});
