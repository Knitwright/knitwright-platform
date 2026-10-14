import { describe, expect, it } from "vitest";
import { DRAFT_NOTICE } from "./dxf/write";
import { reviewInputSchema, reviewLine, reviewState } from "./review";

describe("reviewLine", () => {
  it("is the draft notice until a named person has reviewed the pattern", () => {
    expect(reviewLine(null)).toBe(DRAFT_NOTICE);
    expect(DRAFT_NOTICE).toBe("Draft pattern, not reviewed.");
  });

  it("names who reviewed it, their role and the day", () => {
    expect(reviewLine({ reviewerName: "A. Tailor", reviewerRole: "pattern technician", reviewedOn: "2026-10-20" })).toBe("Reviewed by A. Tailor (pattern technician) on 2026-10-20.");
    expect(reviewLine({ reviewerName: "A. Tailor", reviewerRole: "", reviewedOn: "2026-10-20" })).toBe("Reviewed by A. Tailor (technician) on 2026-10-20.");
  });

  it("is draft or reviewed", () => {
    expect(reviewState(null)).toBe("draft");
    expect(reviewState({ id: "x", reviewerName: "A", reviewerRole: "t", note: "", reviewedOn: "2026-10-20" })).toBe("reviewed");
  });
});

describe("reviewInputSchema", () => {
  it("needs a name and a date, trims, and defaults the role and note", () => {
    expect(reviewInputSchema.parse({ reviewerName: "  A. Tailor ", reviewedOn: "2026-10-20" })).toEqual({ reviewerName: "A. Tailor", reviewerRole: "technician", note: "", reviewedOn: "2026-10-20" });
    expect(reviewInputSchema.safeParse({ reviewerName: " ", reviewedOn: "2026-10-20" }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ reviewerName: "A", reviewedOn: "yesterday" }).success).toBe(false);
  });
});
