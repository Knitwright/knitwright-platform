import { describe, expect, it } from "vitest";
import type { RosterRow } from "@/lib/production/contract";
import type { Player } from "../roster";
import { planFingerprint, planReorder } from "./plan";

const player = (name: string, number: string, sizeLabel: string, wearerGroup: Player["wearerGroup"] = "mens"): Player => ({ name, number, sizeLabel, wearerGroup });
const row = (name: string, number: string, sizeLabel: string, cut: RosterRow["cut"] = "mens", quantity = 1): RosterRow => ({ name, number, sizeLabel, cut, quantity });
const RUN = ["S", "M", "L"];

describe("planReorder from a season", () => {
  it("maps every player to a ready line with the saved size and one shirt", () => {
    const plan = planReorder({ players: [player("Ana", "10", "M", "womens"), player("Bo", "11", "L")], previous: null, run: RUN });
    expect(plan.lines.map((l) => l.row)).toEqual([row("Ana", "10", "M", "womens"), row("Bo", "11", "L")]);
    expect(plan.lines.every((l) => l.reasons.length === 0)).toBe(true);
    expect(plan.counts).toEqual({ ready: 2, fix: 0, sizeChanged: 0, newPlayers: 0 });
  });

  it("flags a size the design no longer has instead of dropping or changing it", () => {
    const plan = planReorder({ players: [player("Ana", "10", "XL"), player("Bo", "11", "M")], previous: null, run: RUN });
    expect(plan.lines).toHaveLength(2);
    expect(plan.lines[0]).toMatchObject({ reasons: ["size-removed"], row: { sizeLabel: "XL" } });
    expect(plan.lines[0]?.messages[0]).toContain("XL");
    expect(plan.counts.fix).toBe(1);
  });

  it("flags a player without a number", () => {
    const plan = planReorder({ players: [player("Ana", "", "M")], previous: null, run: RUN });
    expect(plan.lines[0]?.reasons).toEqual(["no-number"]);
  });

  it("does not compare sizes when the design has no sizes yet", () => {
    const plan = planReorder({ players: [player("Ana", "10", "XL")], previous: null, run: [] });
    expect(plan.lines[0]?.reasons).toEqual([]);
  });

  it("keeps a player who left the roster as an explicit line to fix, with the earlier size", () => {
    const plan = planReorder({ players: [player("Ana", "10", "M")], previous: [row("Ana", "10", "M"), row("Cy", "12", "S", "junior")], run: RUN });
    expect(plan.lines).toHaveLength(2);
    expect(plan.lines[1]).toMatchObject({ reasons: ["player-left"], row: { name: "Cy", sizeLabel: "S", cut: "junior" } });
  });

  it("lists a left player whose size is also gone with both reasons", () => {
    const plan = planReorder({ players: [], previous: [row("Cy", "12", "XXL")], run: RUN });
    expect(plan.lines[0]?.reasons).toEqual(["player-left", "size-removed"]);
  });

  it("reports changed sizes and new players against the earlier order", () => {
    const plan = planReorder({ players: [player("Ana", "10", "L"), player("Bo", "11", "M"), player("Di", "13", "S")], previous: [row("Ana", "10", "M"), row("Bo", "11", "M")], run: RUN });
    expect(plan.lines.map((l) => l.change)).toEqual(["size-changed", "same", "new-player"]);
    expect(plan.lines[0]?.previousSize).toBe("M");
    expect(plan.counts).toMatchObject({ sizeChanged: 1, newPlayers: 1 });
  });

  it("matches a player by name even when the number changed, and by number when the design prints no names", () => {
    const named = planReorder({ players: [player("Ana", "7", "M")], previous: [row("Ana", "10", "M")], run: RUN });
    expect(named.lines).toHaveLength(1);
    expect(named.lines[0]?.change).toBe("same");
    const unnamed = planReorder({ players: [player("", "10", "L")], previous: [row("", "10", "M"), row("", "11", "M")], run: RUN });
    expect(unnamed.lines.map((l) => l.reasons)).toEqual([[], ["player-left"]]);
    expect(unnamed.lines[0]?.change).toBe("size-changed");
  });

  it("matches names regardless of case", () => {
    const plan = planReorder({ players: [player("ANA", "10", "M")], previous: [row("ana", "10", "M")], run: RUN });
    expect(plan.lines).toHaveLength(1);
  });

  it("gives every line its position as index", () => {
    const plan = planReorder({ players: [player("A", "1", "S"), player("B", "2", "S")], previous: null, run: RUN });
    expect(plan.lines.map((l) => l.index)).toEqual([0, 1]);
  });
});

describe("planReorder from the earlier order", () => {
  it("keeps every row, quantity included, and flags a removed size", () => {
    const plan = planReorder({ players: null, previous: [row("Ana", "10", "M", "mens", 2), row("Bo", "11", "XL")], run: RUN });
    expect(plan.lines.map((l) => l.row.quantity)).toEqual([2, 1]);
    expect(plan.lines.map((l) => l.reasons)).toEqual([[], ["size-removed"]]);
    expect(plan.lines.every((l) => l.change === "same")).toBe(true);
  });

  it("is empty when there is nothing to reorder", () => {
    expect(planReorder({ players: null, previous: [], run: RUN }).lines).toEqual([]);
  });
});

describe("planFingerprint", () => {
  it("is stable for the same plan and changes when a line changes", () => {
    const a = planReorder({ players: [player("Ana", "10", "M")], previous: null, run: RUN });
    const b = planReorder({ players: [player("Ana", "10", "M")], previous: null, run: RUN });
    const c = planReorder({ players: [player("Ana", "10", "L")], previous: null, run: RUN });
    expect(planFingerprint(a)).toBe(planFingerprint(b));
    expect(planFingerprint(a)).not.toBe(planFingerprint(c));
    expect(planFingerprint(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});
