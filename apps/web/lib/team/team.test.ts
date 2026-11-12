import { describe, expect, it, vi } from "vitest";
import { buildGrid } from "@/lib/clubs/signup/grid";
import type { CommitteeLink } from "@/lib/share/committee/service";
import { readRetention, RETENTION_NOT_SAVED, saveRetention } from "./retention";
import { approvalSummary, retentionLine, rosterRows, rosterViewFrom, teamTabFrom } from "./view";

const player = (id: string, name: string, number: string, sizeLabel = "M") => ({ id, name, number, sizeLabel, wearerGroup: "unisex" as const });

describe("the Team page's address", () => {
  it("opens Roster unless it names another tab", () => {
    expect(teamTabFrom(undefined)).toBe("roster");
    expect(teamTabFrom("approvals")).toBe("approvals");
    expect(teamTabFrom("seasons")).toBe("seasons");
    expect(teamTabFrom(["seasons"])).toBe("roster");
    expect(teamTabFrom("nope")).toBe("roster");
  });

  it("reads the roster's editor or sign-up view, or none", () => {
    expect(rosterViewFrom("edit")).toBe("edit");
    expect(rosterViewFrom("signup")).toBe("signup");
    expect(rosterViewFrom("x")).toBeNull();
  });
});

describe("rosterRows", () => {
  it("prints names in capitals, marks each player collected and flags a repeated number", () => {
    const rows = rosterRows([player("a", "Smith", "7"), player("b", "Khan", "10", "L"), player("c", "Ahmed", "7", "")], null);
    expect(rows.map((row) => [row.shirtName, row.number, row.size, row.status, row.tone])).toEqual([
      ["SMITH", "7", "M", "Duplicate number", "warn"],
      ["KHAN", "10", "L", "Collected", "ok"],
      ["AHMED", "7", "—", "Duplicate number", "warn"],
    ]);
  });

  it("adds the people the sign-up is still waiting on, with no size", () => {
    const grid = buildGrid(
      [
        { id: "r1", name: "Ali", phone: "", email: "" },
        { id: "r2", name: "Jones", phone: "", email: "" },
      ],
      [{ id: "e1", nameOnShirt: "Jones", number: "1", sizeLabel: "XL", wearerGroup: "unisex", updatedAt: "2026-01-01" }],
    );
    const rows = rosterRows([player("a", "Smith", "")], grid);
    expect(rows.map((row) => [row.shirtName, row.status, row.waiting])).toEqual([
      ["SMITH", "Collected", false],
      ["ALI", "Waiting", true],
    ]);
  });
});

const link = (part: Partial<CommitteeLink>): CommitteeLink => ({
  id: "l1",
  createdAt: "2026-11-01T00:00:00Z",
  expiresAt: "2026-12-09T00:00:00Z",
  revokedAt: null,
  slots: [
    { slot: "A", version: 3 },
    { slot: "B", version: 4 },
  ],
  pins: [],
  votes: [],
  approvals: [],
  ...part,
});

describe("approvalSummary", () => {
  const now = new Date("2026-11-13T00:00:00Z");

  it("says there is no link yet", () => {
    expect(approvalSummary([], null, now)).toEqual({ line: "No committee link yet.", pill: null, locked: false });
    expect(approvalSummary([link({ revokedAt: "2026-11-02T00:00:00Z" })], 3, now)).toMatchObject({ pill: null, locked: true });
  });

  it("counts votes per version, comments and the days left, and approvals against everyone who answered", () => {
    const summary = approvalSummary(
      [
        link({
          votes: [
            { slot: "A", name: "Bea", updatedAt: "x" },
            { slot: "A", name: "Cal", updatedAt: "x" },
            { slot: "B", name: "Dee", updatedAt: "x" },
          ],
          pins: [{ id: "p", version: 3, name: "Bea", panelId: "front", xMm: 1, yMm: 1, body: "Nice", createdAt: "x" }],
          approvals: [{ id: "a", version: 3, name: "Bea", email: null, approvedAt: "x" }],
        }),
      ],
      null,
      now,
    );
    expect(summary.line).toBe("Version 3 2 votes · Version 4 1 vote · 1 comment · link expires in 26 days");
    expect(summary.pill).toBe("1 approval from 3");
  });

  it("says when the link has expired", () => {
    expect(approvalSummary([link({ expiresAt: "2026-11-01T00:00:00Z" })], null, now).line).toContain("link expired");
  });
});

describe("roster retention", () => {
  it("reads the opt-in, and no row or a failed read as not opted in", async () => {
    const reading = (data: unknown, error: unknown = null) =>
      ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data, error }) }) }) }) }) as never;
    expect(await readRetention(reading({ keep_old_rosters: true }), "b")).toBe(true);
    expect(await readRetention(reading(null), "b")).toBe(false);
    expect(await readRetention(reading(null, { message: "x" }), "b")).toBe(false);
  });

  it("saves through set_roster_retention, and names a refusal as forbidden", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await saveRetention({ rpc } as never, { brandId: "b", userId: "u" }, true);
    expect(rpc).toHaveBeenCalledWith("set_roster_retention", { p_brand_id: "b", p_user_id: "u", p_keep: true });
    const refused = vi.fn().mockResolvedValue({ error: { code: "42501" } });
    await expect(saveRetention({ rpc: refused } as never, { brandId: "b", userId: "u" }, false)).rejects.toMatchObject({ code: "forbidden", message: RETENTION_NOT_SAVED });
    const broken = vi.fn().mockResolvedValue({ error: { code: "XX000" } });
    await expect(saveRetention({ rpc: broken } as never, { brandId: "b", userId: "u" }, false)).rejects.toMatchObject({ code: "internal" });
  });

  it("says what happens either way", () => {
    expect(retentionLine(true)).toContain("kept");
    expect(retentionLine(false)).toContain("removed automatically");
  });
});
