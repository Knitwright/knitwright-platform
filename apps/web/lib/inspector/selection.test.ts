import { describe, expect, it } from "vitest";
import { aligned, ALIGNMENTS, boundsOfBoxes } from "./align";
import { designOfBoard, inspectorTarget, staleFocus } from "./selection";

const DESIGN = "00000000-0000-4000-8000-0000000000d1";
const boards = [
  { id: "g", kind: "garment" as const, settings: { designProjectId: DESIGN } },
  { id: "d", kind: "design" as const, settings: {} },
  { id: "m", kind: "mockup" as const, settings: {} },
  { id: "a", kind: "ai_image" as const, settings: {} },
];
const pick = (selection: readonly string[], element: { boardId: string; id: string } | null = null, editing: string | null = null) =>
  inspectorTarget({ selection, boards, element, editing });

describe("which inspector the right panel shows", () => {
  it("shows nothing of its own with nothing selected, or for a board another panel answers", () => {
    expect(pick([])).toEqual({ kind: "none" });
    expect(pick(["a"])).toEqual({ kind: "other", boardId: "a" });
    expect(pick(["gone"])).toEqual({ kind: "none" });
  });

  it("shows the garment inspector for a garment or launch-era design board", () => {
    expect(pick(["g"])).toEqual({ kind: "garment", boardId: "g", designId: DESIGN });
    expect(pick(["d"])).toEqual({ kind: "garment", boardId: "d", designId: null });
  });

  it("shows an element of the selected garment, and only of that garment", () => {
    expect(pick(["g"], { boardId: "g", id: "crest" })).toEqual({ kind: "element", boardId: "g", designId: DESIGN, elementId: "crest" });
    expect(pick(["g"], { boardId: "other", id: "crest" })).toMatchObject({ kind: "garment" });
    expect(pick(["d"], { boardId: "d", id: "crest" })).toMatchObject({ kind: "garment" });
  });

  it("shows the mockup inspector, in edit mode only for the board being edited", () => {
    expect(pick(["m"])).toEqual({ kind: "mockup", boardId: "m", editing: false });
    expect(pick(["m"], null, "m")).toEqual({ kind: "mockup", boardId: "m", editing: true });
    expect(pick(["m"], null, "x")).toEqual({ kind: "mockup", boardId: "m", editing: false });
  });

  it("shows the group inspector for two or more boards", () => {
    expect(pick(["g", "m"])).toEqual({ kind: "group", boardIds: ["g", "m"] });
  });

  it("finishes an element or an edit mode once the selection moves away", () => {
    expect(staleFocus({ selection: ["g"], element: { boardId: "g", id: "x" }, editing: null })).toEqual({ element: false, editing: false });
    expect(staleFocus({ selection: ["m"], element: { boardId: "g", id: "x" }, editing: "m" })).toEqual({ element: true, editing: false });
    expect(staleFocus({ selection: [], element: null, editing: "m" })).toEqual({ element: false, editing: true });
    expect(staleFocus({ selection: ["m", "g"], element: null, editing: "m" })).toEqual({ element: false, editing: true });
  });

  it("reads a garment board's design only from a garment kind", () => {
    expect(designOfBoard(boards[0])).toBe(DESIGN);
    expect(designOfBoard({ kind: "mockup", settings: { designProjectId: DESIGN } })).toBeNull();
    expect(designOfBoard({ kind: "garment", settings: { designProjectId: "" } })).toBeNull();
  });
});

describe("aligning a selection of boards", () => {
  const boxes = [
    { id: "a", box: { x: 0, y: 0, width: 100, height: 50 } },
    { id: "b", box: { x: 200, y: 100, width: 50, height: 100 } },
  ];

  it("measures the selection's bounds", () => {
    expect(boundsOfBoxes(boxes)).toEqual({ x: 0, y: 0, width: 250, height: 200 });
    expect(boundsOfBoxes([])).toBeNull();
  });

  it("moves each board to the selection's edges and centres, leaving those already there", () => {
    expect(aligned(boxes, "left")).toEqual([{ id: "b", at: { x: 0, y: 100 } }]);
    expect(aligned(boxes, "right")).toEqual([{ id: "a", at: { x: 150, y: 0 } }]);
    expect(aligned(boxes, "top")).toEqual([{ id: "b", at: { x: 200, y: 0 } }]);
    expect(aligned(boxes, "bottom")).toEqual([{ id: "a", at: { x: 0, y: 150 } }]);
    expect(aligned(boxes, "centre")).toEqual([
      { id: "a", at: { x: 75, y: 0 } },
      { id: "b", at: { x: 100, y: 100 } },
    ]);
    expect(aligned(boxes, "middle")).toEqual([
      { id: "a", at: { x: 0, y: 75 } },
      { id: "b", at: { x: 200, y: 50 } },
    ]);
  });

  it("does nothing for one board", () => {
    for (const how of ALIGNMENTS) expect(aligned(boxes.slice(0, 1), how)).toEqual([]);
  });
});
