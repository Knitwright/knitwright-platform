import { describe, expect, it } from "vitest";
import { currentStack } from "@/lib/artwork-stack";
import { BENCHMARK_DOTS, MARKS, jersey } from "@/lib/artwork-stack/fixtures/designs";
import { ROSTER_22 } from "@/lib/production/fixtures";
import { DEFAULT_SIZE_LABEL_MAPS } from "@/lib/sizing";
import { TEST_GRADED_JERSEY } from "./fixtures/graded";
import { playerFileStem, planPlayers, patternSizeFor } from "./players";

const stack = currentStack(jersey({ kitPattern: BENCHMARK_DOTS, namesAndNumbers: MARKS }));
const sizes = TEST_GRADED_JERSEY.sizes;

describe("players", () => {
  it("plans one set per player in roster order, with the pattern size each label is cut from", () => {
    const plan = planPlayers({ order: ROSTER_22, stack, sizeMaps: DEFAULT_SIZE_LABEL_MAPS, patternSizes: sizes });
    expect(plan.problems).toEqual([]);
    expect(plan.jobs).toHaveLength(22);
    expect(plan.jobs[0]).toMatchObject({ index: 1, player: { name: "OKAFOR", number: "7" }, label: "M", size: "48" });
    expect(plan.jobs.find((j) => j.player.name === "LOVEGROVE-HUNT")?.size).toBe("56");
  });
  it("puts a player on the views that carry a name or number", () => {
    const plan = planPlayers({ order: ROSTER_22, stack, sizeMaps: DEFAULT_SIZE_LABEL_MAPS, patternSizes: sizes });
    expect([...plan.jobs[0].views].sort()).toEqual(["back", "front"]);
    expect(plan.jobs[0].transfer).toBe(false);
  });
  it("adds a transfer set when the marks are made by transfer", () => {
    const transferMarks = currentStack(jersey({ kitPattern: BENCHMARK_DOTS, namesAndNumbers: { ...MARKS, technique: "transfer" } }));
    const plan = planPlayers({ order: ROSTER_22, stack: transferMarks, sizeMaps: DEFAULT_SIZE_LABEL_MAPS, patternSizes: sizes });
    expect(plan.jobs.every((j) => j.transfer)).toBe(true);
  });
  it("reports a label with no pattern size instead of guessing", () => {
    const order = { ...ROSTER_22, rows: [{ ...ROSTER_22.rows[0], sizeLabel: "9XL" }] };
    const plan = planPlayers({ order, stack, sizeMaps: DEFAULT_SIZE_LABEL_MAPS, patternSizes: sizes });
    expect(plan.jobs).toEqual([]);
    expect(plan.problems[0]).toMatch(/9XL/);
  });
  it("reports a pattern size the pattern does not have", () => {
    const plan = planPlayers({ order: ROSTER_22, stack, sizeMaps: DEFAULT_SIZE_LABEL_MAPS, patternSizes: ["48"] });
    expect(plan.jobs.length).toBeLessThan(22);
    expect(plan.problems.some((p) => /no size 5\d/.test(p))).toBe(true);
  });
  it("looks a label up by cut, then by wearer", () => {
    expect(patternSizeFor(DEFAULT_SIZE_LABEL_MAPS, "M", "mens")).toBe("48");
    expect(patternSizeFor(DEFAULT_SIZE_LABEL_MAPS, "M", "unisex")).toBe("48");
    expect(patternSizeFor(DEFAULT_SIZE_LABEL_MAPS, "nope", "mens")).toBeNull();
  });
  it("makes a folder name from the order, number and name that is safe in a zip", () => {
    expect(playerFileStem({ index: 3, player: { name: "O'Brien / Jr.", number: "07" } })).toBe("03-07-O-BRIEN-JR");
    expect(playerFileStem({ index: 12, player: { name: "", number: "9" } })).toBe("12-9");
  });
  it("says nothing is planned for a design with no names or numbers", () => {
    const plain = currentStack(jersey({ kitPattern: BENCHMARK_DOTS }));
    const plan = planPlayers({ order: ROSTER_22, stack: plain, sizeMaps: DEFAULT_SIZE_LABEL_MAPS, patternSizes: sizes });
    expect(plan.jobs).toEqual([]);
    expect(plan.problems[0]).toMatch(/no place for a name or number/);
  });
});
