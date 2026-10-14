import { describe, expect, it } from "vitest";
import { ROSTER_22 } from "@/lib/production/fixtures";
import { parseRosterCsv } from "./import-csv";
import { buildManifest, manifestCsv, rosterCsv } from "./manifest";

const RUN = ["S", "M", "L", "XL", "2XL", "3XL"];

describe("buildManifest", () => {
  const m = buildManifest("Sample", ROSTER_22.rows, RUN);
  it("totals match the rows", () => {
    expect(m.totalShirts).toBe(22);
    expect(m.sizeTotals.reduce((a, b) => a + b, 0)).toBe(22);
    expect(m.cutTotals).toEqual([22]);
    expect(m.cuts).toEqual(["mens"]);
  });
  it("lists sizes in run order and only the ones used", () => {
    expect(m.sizes).toEqual(["S", "M", "L", "XL", "2XL", "3XL"]);
    expect(m.sizeTotals).toEqual([3, 7, 6, 3, 2, 1]);
  });
  it("counts shirts by quantity, by size and cut", () => {
    const x = buildManifest("X", [
      { name: "A", number: "1", sizeLabel: "M", cut: "mens", quantity: 2 },
      { name: "B", number: "2", sizeLabel: "M", cut: "womens", quantity: 1 },
      { name: "C", number: "3", sizeLabel: "ZZ", cut: "mens", quantity: 1 },
    ], ["S", "M"]);
    expect(x.sizes).toEqual(["M", "ZZ"]);
    expect(x.cuts).toEqual(["mens", "womens"]);
    expect(x.cells).toEqual([[2, 1], [1, 0]]);
    expect(x.totalShirts).toBe(4);
  });
  it("sorts players by number, then name", () => {
    expect(m.players.map((p) => p.number)).toEqual([...m.players.map((p) => p.number)].sort((a, b) => Number(a) - Number(b)));
  });
});

describe("csv files", () => {
  it("the roster CSV reads back to the same rows", () => {
    const back = parseRosterCsv(rosterCsv(ROSTER_22.rows), { run: RUN });
    expect(back.ok && back.rows).toEqual(ROSTER_22.rows);
  });
  it("the manifest holds totals then players", () => {
    const text = manifestCsv(buildManifest("Sample", ROSTER_22.rows, RUN));
    expect(text).toContain("Shirts by size and cut");
    expect(text).toContain("Total,22,22");
    expect(text).toContain("Players\r\nName,Number,Size,Cut,Quantity");
  });
  it("defuses a formula in a name", () => {
    const rows = [{ name: "-X", number: "1", sizeLabel: "M", cut: "mens", quantity: 1 } as const];
    expect(manifestCsv(buildManifest("S", rows, RUN))).toContain("'-X,1,M,mens,1");
  });
});
