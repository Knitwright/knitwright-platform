import { describe, expect, it } from "vitest";
import type { PatternRequest } from "./rows";
import { deliveredLabel, NOT_REVIEWED_LABEL, statusLine, WHAT_IS_SENT } from "./wording";

const base: PatternRequest = {
  id: "i", brandId: "b", projectId: "p", designVersion: 1, articleId: "shorts", status: "requested", snapshotHash: "h",
  quotedPriceCredits: null, quotedTurnaroundDays: null, declineReason: null, fileIds: [], reviewedBy: null, reviewedOn: null, createdAt: "", updatedAt: "",
};

describe("pattern request wording", () => {
  it("labels delivered files as not reviewed until a named review is recorded", () => {
    expect(deliveredLabel(base)).toBe(NOT_REVIEWED_LABEL);
    expect(NOT_REVIEWED_LABEL).toBe("Pattern from the Sialkot team, not reviewed by a technician");
    expect(deliveredLabel({ reviewedBy: "Sana", reviewedOn: "2026-11-02" })).toBe("Pattern from the Sialkot team, reviewed by Sana on 2026-11-02");
  });
  it("says where a request stands", () => {
    expect(statusLine(base)).toContain("Knitwright will confirm the turnaround");
    expect(statusLine({ ...base, status: "in_progress", quotedTurnaroundDays: 5 })).toContain("5 working days");
    expect(statusLine({ ...base, status: "declined", declineReason: "Not draftable" })).toBe("Declined: Not draftable");
    expect(statusLine({ ...base, status: "declined" })).toContain("no reason was given");
    expect(statusLine({ ...base, status: "delivered" })).toContain(NOT_REVIEWED_LABEL);
  });
  it("lists what is sent and promises no names", () => {
    expect(WHAT_IS_SENT.join(" ")).toMatch(/no player names/);
  });
});
