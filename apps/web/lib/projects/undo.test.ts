import { describe, expect, it } from "vitest";
import { originOf, undoTarget } from "./undo";

type Row = { version: number; restoredFrom: number | null };

const rows = (...entries: readonly (number | readonly [number, number])[]): Row[] =>
  entries.map((entry) =>
    typeof entry === "number" ? { version: entry, restoredFrom: null } : { version: entry[0], restoredFrom: entry[1] },
  );

describe("originOf", () => {
  it("is the version itself unless it restored another", () => {
    expect(originOf(rows(1, 2, 3), 3)).toBe(3);
  });

  it("follows a chain of restores to the first", () => {
    expect(originOf(rows(1, 2, 3, [4, 2], [5, 4]), 5)).toBe(2);
  });

  it("stops at a version that is not in the list", () => {
    expect(originOf(rows([7, 3]), 7)).toBe(3);
  });

  it("cannot loop, even on damaged data", () => {
    expect(originOf(rows([2, 3], [3, 2]), 3)).toBeGreaterThan(0);
  });
});

describe("undoTarget", () => {
  it("offers nothing on the first version", () => {
    expect(undoTarget(rows(1))).toBeNull();
    expect(undoTarget([])).toBeNull();
  });

  it("goes to the version before the current one", () => {
    expect(undoTarget(rows(1, 2, 3))).toBe(2);
  });

  it("keeps going back through three undos in a row, then stops", () => {
    const history = rows(1, 2, 3, 4);
    expect(undoTarget(history)).toBe(3);

    const afterOne = [...history, ...rows([5, 3])];
    expect(undoTarget(afterOne)).toBe(2);

    const afterTwo = [...afterOne, ...rows([6, 2])];
    expect(undoTarget(afterTwo)).toBe(1);

    const afterThree = [...afterTwo, ...rows([7, 1])];
    expect(undoTarget(afterThree)).toBeNull();
  });

  it("follows the example of versions 1, 2 and 3", () => {
    const three = rows(1, 2, 3);
    expect(undoTarget(three)).toBe(2);
    const four = [...three, ...rows([4, 2])];
    expect(undoTarget(four)).toBe(1);
    const five = [...four, ...rows([5, 1])];
    expect(undoTarget(five)).toBeNull();
  });

  it("treats a change made after an undo as a new starting point", () => {
    expect(undoTarget(rows(1, 2, 3, [4, 2], 5))).toBe(4);
  });

  it("does not care in which order the rows arrive", () => {
    expect(undoTarget(rows([4, 2], 3, 1, 2))).toBe(1);
  });

  it("counts a restore of any version by where that version came from", () => {
    expect(undoTarget(rows(1, 2, 3, [4, 2], [5, 4]))).toBe(1);
  });
});
