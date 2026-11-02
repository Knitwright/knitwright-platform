import { describe, expect, it } from "vitest";
import { isCommitteeSlot, slotLabel } from "./fields";
import {
  approvalsNewestFirst,
  countBySlot,
  leadingSlot,
  pinsOfVersion,
  tallyLine,
  type CommitteeApproval,
  type CommitteePin,
  type CommitteeVote,
  type SlotVersions,
} from "./tally";

const SLOTS: SlotVersions = [
  { slot: "B", version: 5 },
  { slot: "A", version: 4 },
];

const vote = (slot: CommitteeVote["slot"], name: string): CommitteeVote => ({ slot, name, updatedAt: "2026-11-01T10:00:00Z" });

const approval = (patch: Partial<CommitteeApproval> = {}): CommitteeApproval => ({
  id: "a1",
  version: 4,
  name: "Dana",
  email: null,
  approvedAt: "2026-11-01T10:00:00Z",
  ...patch,
});

const pin = (patch: Partial<CommitteePin> = {}): CommitteePin => ({
  id: "p1",
  version: 4,
  name: "Sam",
  panelId: "body-front",
  xMm: 100,
  yMm: 200,
  body: "Navy sleeves please.",
  createdAt: "2026-11-01T10:00:00Z",
  ...patch,
});

describe("the slots", () => {
  it("knows its own three and nothing else", () => {
    expect(isCommitteeSlot("A")).toBe(true);
    expect(isCommitteeSlot("D")).toBe(false);
    expect(slotLabel("C")).toBe("Option C");
  });
});

describe("countBySlot", () => {
  it("counts in slot order, whatever order the link's rows came back in", () => {
    const counts = countBySlot(SLOTS, [vote("A", "Sam"), vote("A", "Dana"), vote("B", "Kim")], [approval()]);

    expect(counts.map((count) => count.slot)).toEqual(["A", "B"]);
    expect(counts[0]).toMatchObject({ label: "Option A", version: 4, votes: 2, approvals: 1 });
    expect(counts[1]).toMatchObject({ slot: "B", version: 5, votes: 1, approvals: 0 });
  });

  it("leaves out a slot the link does not show", () => {
    expect(countBySlot([{ slot: "A", version: 4 }], [], [])).toHaveLength(1);
  });
});

describe("tallyLine", () => {
  it("says nothing has been voted on yet rather than showing noughts", () => {
    expect(tallyLine(countBySlot(SLOTS, [], []))).toBe("No votes yet.");
  });

  it("never calls the count a decision, because one browser is one vote", () => {
    const line = tallyLine(countBySlot(SLOTS, [vote("A", "Sam")], []));

    expect(line).toContain("Option A: 1");
    expect(line).toContain("a guide, not a ballot");
  });
});

describe("leadingSlot", () => {
  it("is nothing at all with no votes, and nothing on a tie", () => {
    expect(leadingSlot(countBySlot(SLOTS, [], []))).toBeNull();
    expect(leadingSlot(countBySlot(SLOTS, [vote("A", "Sam"), vote("B", "Kim")], []))).toBeNull();
  });

  it("is the one slot with the most votes", () => {
    expect(leadingSlot(countBySlot(SLOTS, [vote("B", "Sam"), vote("B", "Kim"), vote("A", "Dana")], []))).toBe("B");
  });
});

describe("approvalsNewestFirst", () => {
  it("puts the newest first and breaks a tie by id, so the order never wanders", () => {
    const older = approval({ id: "a1", approvedAt: "2026-11-01T09:00:00Z" });
    const newer = approval({ id: "a2", approvedAt: "2026-11-02T09:00:00Z" });
    const same = approval({ id: "a3", approvedAt: "2026-11-02T09:00:00Z" });

    expect(approvalsNewestFirst([older, newer, same]).map((entry) => entry.id)).toEqual(["a3", "a2", "a1"]);
  });
});

describe("pinsOfVersion", () => {
  it("keeps only the version asked for, oldest first, as a thread reads", () => {
    const first = pin({ id: "p1", createdAt: "2026-11-01T09:00:00Z" });
    const second = pin({ id: "p2", createdAt: "2026-11-01T11:00:00Z" });
    const other = pin({ id: "p3", version: 5 });

    expect(pinsOfVersion([second, other, first], 4).map((entry) => entry.id)).toEqual(["p1", "p2"]);
  });
});
