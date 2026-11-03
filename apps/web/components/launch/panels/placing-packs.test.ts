import { describe, expect, it } from "vitest";
import type { BoardView } from "@/lib/launch";
import { designBoard, project } from "@/lib/launch/fixtures/canvas";
import { dropOrigin, PACK_GAP } from "./placing-packs";

/** Where a launch pack lands, so a second pack does not cover the first (decision 0124). */

const at = (board: BoardView, x: number, y: number): BoardView => ({ ...board, at: { x, y } });

describe("where a pack is dropped", () => {
  it("starts at the origin on an empty canvas", () => {
    expect(dropOrigin([])).toEqual({ x: 0, y: 0 });
  });

  it("lands to the right of everything already there, level with its top", () => {
    const one = at(designBoard("design-1"), 100, 240);
    const origin = dropOrigin([one]);
    expect(origin).toEqual({ x: 100 + one.size.width + PACK_GAP, y: 240 });
  });

  it("clears the widest board, not the last one read", () => {
    const boards = project([at(designBoard("design-1"), 0, 0), at(designBoard("design-2"), 900, 60)], []).boards;
    const origin = dropOrigin(boards);
    expect(origin.x).toBeGreaterThan(900);
    expect(origin.y).toBe(0);
  });
});
