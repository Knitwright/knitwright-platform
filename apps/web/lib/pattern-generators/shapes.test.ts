import { describe, expect, it } from "vitest";
import { BUDGET_NOTE, budgetFactor, circleShape, clippedShape, listOf, SHAPE_BUDGET } from "./shapes";

describe("shape budget", () => {
  it("leaves a small estimate alone and scales a big one to fit", () => {
    expect(budgetFactor(100)).toBe(1);
    expect(budgetFactor(SHAPE_BUDGET * 4)).toBe(2);
  });

  it("notes a simplified list and cuts one that is still over", () => {
    const shape = circleShape({ x: 1.234, y: 2 }, 3.456, "#000000");
    expect(shape).toMatchObject({ centre: { x: 1.23, y: 2 }, radius: 3.46 });
    expect(listOf([shape], false)).toEqual({ shapes: [shape] });
    expect(listOf([shape], true).note).toBe(BUDGET_NOTE);
    const cut = listOf(Array.from({ length: SHAPE_BUDGET + 5 }, () => shape), false);
    expect(cut.shapes).toHaveLength(SHAPE_BUDGET);
    expect(cut.note).toBe(BUDGET_NOTE);
  });

  it("drops a polygon outside the box", () => {
    const box = { minX: 0, minY: 0, maxX: 5, maxY: 5 };
    expect(clippedShape([{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 11, y: 11 }], box, "#000000")).toEqual([]);
  });
});
