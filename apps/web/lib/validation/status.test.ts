import { describe, expect, it } from "vitest";
import { finding } from "./finding";
import { DRAFT, VERSION_STATUSES, canMove, statusSentence, transition, type VersionStatus } from "./status";

const at = new Date("2026-10-24T10:00:00Z");
const blocker = finding({ code: "a-a", severity: "blocker", message: "m", action: "x", whoActs: "owner" });
const warning = finding({ code: "b-b", severity: "warning", message: "m", action: "x", whoActs: "owner" });
const ctx = (findings = [warning]) => ({ profileId: "knitwright-default", findings, at });

const LEGAL: [VersionStatus, VersionStatus][] = [
  ["draft", "validated"],
  ["validated", "draft"],
  ["validated", "approved"],
  ["validated", "ordered"],
  ["approved", "ordered"],
];

describe("design status", () => {
  it.each(VERSION_STATUSES.flatMap((a) => VERSION_STATUSES.map((b) => [a, b] as const)))("%s to %s", (from, to) => {
    expect(canMove(from, to)).toBe(LEGAL.some(([f, t]) => f === from && t === to));
  });

  it("refuses draft to ordered and any move from ordered, with a reason", () => {
    const draftToOrdered = transition(DRAFT, "ordered", ctx());
    expect(draftToOrdered).toEqual({ ok: false, reason: "A design that is draft cannot move to ordered." });
    const ordered = { status: "ordered" as const, profileId: "p", findingsHash: "h", at: "2026-10-24T00:00:00.000Z" };
    expect(transition(ordered, "draft", ctx()).ok).toBe(false);
  });

  it("refuses every illegal move with a reason, including draft to approved and approved back to draft or validated", () => {
    const approved = { status: "approved" as const, profileId: "p", findingsHash: "h", at: "2026-10-24T00:00:00.000Z" };
    expect(transition(DRAFT, "approved", ctx())).toEqual({ ok: false, reason: "A design that is draft cannot move to approved." });
    expect(transition(approved, "draft", ctx()).ok).toBe(false);
    expect(transition(approved, "validated", ctx()).ok).toBe(false);
    expect(transition(approved, "ordered", ctx())).toMatchObject({ ok: true, record: { status: "ordered" } });
    expect(transition(approved, "ordered", ctx([blocker])).ok).toBe(false);
  });

  it("moves to validated with only warnings, storing profile, hash and time", () => {
    const result = transition(DRAFT, "validated", ctx());
    expect(result).toMatchObject({ ok: true, record: { status: "validated", profileId: "knitwright-default", at: at.toISOString() } });
    if (result.ok) expect(result.record.findingsHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses validated, and ordered, while a blocker is open", () => {
    expect(transition(DRAFT, "validated", ctx([blocker]))).toEqual({ ok: false, reason: "1 blocker is still open." });
    const valid = { ...DRAFT, status: "validated" as const };
    expect(transition(valid, "ordered", ctx([blocker, blocker])).ok).toBe(false);
  });

  it("returns to a clean draft, and does not change the record it started from", () => {
    const valid = { status: "validated" as const, profileId: "p", findingsHash: "h", at: "2026-10-23T00:00:00.000Z" };
    const frozen = Object.freeze({ ...valid });
    const result = transition(frozen, "draft", ctx());
    expect(result).toEqual({ ok: true, record: { status: "draft", profileId: null, findingsHash: null, at: at.toISOString() } });
    expect(frozen).toEqual(valid);
  });

  it("words the status without claiming more than no blockers", () => {
    expect(statusSentence(DRAFT)).toMatch(/^Draft/);
    expect(statusSentence({ status: "validated", profileId: "p", findingsHash: "h", at: "2026-10-24T10:00:00.000Z" })).toBe("No blockers against profile p on 2026-10-24.");
    expect(statusSentence({ status: "ordered", profileId: "p", findingsHash: "h", at: null })).toContain("unknown date");
    expect(statusSentence({ status: "approved", profileId: "p", findingsHash: "h", at: "2026-10-24T10:00:00.000Z" })).toBe("Accepted for ordering by the brand. No blockers against profile p on 2026-10-24.");
  });
});
