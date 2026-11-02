import { describe, expect, it } from "vitest";
import { board } from "@/lib/launch/fixtures/canvas";
import type { BoardView } from "@/lib/launch";
import { freePlace, ROW } from "./placing";

/** Three boards asked for the origin must be three boards a person can read and press. */

const at = (id: string, x: number, y: number): BoardView => board(id, "mockup", { at: { x, y } });

describe("where a new board goes", () => {
  it("leaves a free place alone", () => {
    expect(freePlace([], { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(freePlace([at("a", 360, 0)], { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it("moves a taken place down by a row of the canvas's grid", () => {
    expect(freePlace([at("a", 0, 0)], { x: 0, y: 0 })).toEqual({ x: 0, y: ROW });
  });

  it("keeps going until it finds one free, so three boards at the origin end up in a column", () => {
    const boards = [at("a", 0, 0), at("b", 0, ROW)];

    expect(freePlace(boards, { x: 0, y: 0 })).toEqual({ x: 0, y: ROW * 2 });
  });

  it("keeps the column the place asked for, and never moves sideways", () => {
    expect(freePlace([at("a", 720, 40)], { x: 720, y: 40 })).toEqual({ x: 720, y: 40 + ROW });
  });

  it("stops rather than looping for ever when every row of a column is taken", () => {
    const boards = [0, 1, 2].map((row) => at(`a${row}`, 0, row * ROW));

    // One row past the last board, which is free: the bound is the number of boards.
    expect(freePlace(boards, { x: 0, y: 0 })).toEqual({ x: 0, y: ROW * 3 });
  });
});
