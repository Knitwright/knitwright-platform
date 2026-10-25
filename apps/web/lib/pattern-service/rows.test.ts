import { describe, expect, it } from "vitest";
import { toEvent, toRequest } from "./rows";

const id = "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11";
const row = { id, brand_id: id, project_id: id, design_version: 2, article_id: "shorts", status: "requested", snapshot_hash: "h", quoted_price_credits: null, quoted_turnaround_days: 5, decline_reason: null, file_ids: [], reviewed_by: null, reviewed_on: null, created_at: "t", updated_at: "t" };

describe("rows", () => {
  it("reads a request", () => {
    expect(toRequest(row)).toMatchObject({ id, designVersion: 2, quotedPriceCredits: null, quotedTurnaroundDays: 5, fileIds: [] });
  });
  it("refuses a row with an unknown status", () => {
    expect(() => toRequest({ ...row, status: "paid" })).toThrow();
  });
  it("reads an event", () => {
    expect(toEvent({ id, request_id: id, kind: "accepted", from_status: "requested", to_status: "accepted", note: "", at: "t" })).toMatchObject({ kind: "accepted", fromStatus: "requested" });
  });
});
