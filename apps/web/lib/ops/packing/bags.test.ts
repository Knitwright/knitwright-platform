import { describe, expect, it } from "vitest";
import type { RosterRow } from "@/lib/production/contract";
import { BAGS_MAX, bagsProblem, planBags } from "./bags";

const roster: readonly RosterRow[] = [
  { name: "OKAFOR", number: "10", sizeLabel: "M", cut: "mens", quantity: 1 },
  { name: "LI", number: "22", sizeLabel: "L", cut: "mens", quantity: 2 },
];

describe("planBags", () => {
  it("makes one bag per team list line, in list order, pointing at the line and holding no name", () => {
    const bags = planBags({ M: 1, L: 2 }, roster);
    expect(bags).toEqual([
      { teamRowPosition: 1, sizeLabel: "M", pieces: 1 },
      { teamRowPosition: 2, sizeLabel: "L", pieces: 2 },
    ]);
    expect(JSON.stringify(bags)).not.toMatch(/OKAFOR|LI"/);
  });

  it("makes one plain bag per size, sizes in natural order, when there is no list", () => {
    expect(planBags({ XL: 1, M: 2, "10": 3 }, null).map((b) => b.sizeLabel)).toEqual(["10", "M", "XL"]);
    expect(planBags({ M: 2 }, [])).toEqual([{ teamRowPosition: null, sizeLabel: "M", pieces: 2 }]);
  });

  it("splits a size that is more than a bag record holds, without losing a piece", () => {
    const bags = planBags({ M: 2500 }, null);
    expect(bags.map((b) => b.pieces)).toEqual([999, 999, 502]);
  });

  it("is independent of the order sizes arrive in", () => {
    expect(planBags({ L: 1, M: 1 }, null)).toEqual(planBags({ M: 1, L: 1 }, null));
  });
});

describe("bagsProblem", () => {
  it("refuses none and too many", () => {
    expect(bagsProblem([])).toMatch(/nothing/);
    expect(bagsProblem(Array.from({ length: BAGS_MAX + 1 }, () => ({ teamRowPosition: null, sizeLabel: "M", pieces: 1 })))).toMatch(/up to/);
    expect(bagsProblem([{ teamRowPosition: null, sizeLabel: "M", pieces: 1 }])).toBeNull();
  });
});
