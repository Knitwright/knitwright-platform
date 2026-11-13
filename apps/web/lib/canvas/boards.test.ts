import { describe, expect, it } from "vitest";
import { CARD_SIZE } from "@/lib/flows/canvas";
import { board, link } from "@/lib/launch/fixtures/canvas";
import {
  boxOf,
  connectorsBetween,
  contentBounds,
  CULL_FROM,
  curve,
  GARMENT_BOX,
  hasOwnBox,
  inDot,
  marqueeHits,
  newBoardSize,
  nextInOrder,
  outDot,
  visibleBoards,
  visibleConnectors,
} from "./boards";
import { HOME } from "./viewport";

const at = (x: number, y: number) => ({ at: { x, y } });

describe("a board's box", () => {
  it("is the card for a launch kind, whatever artboard it exports at", () => {
    expect(boxOf(board("m", "mockup", { ...at(40, 80), size: { width: 1080, height: 1920 } }))).toEqual({ x: 40, y: 80, ...CARD_SIZE });
  });

  it("is the board's own size for a garment, a tech pack and an order, never smaller than a card", () => {
    expect(boxOf(board("g", "garment", { size: GARMENT_BOX }))).toEqual({ x: 0, y: 0, ...GARMENT_BOX });
    expect(boxOf(board("t", "tech_pack", { size: { width: 16, height: 16 } }))).toEqual({ x: 0, y: 0, ...CARD_SIZE });
    expect(["garment", "tech_pack", "order", "design"].map((kind) => hasOwnBox(kind as never))).toEqual([true, true, true, false]);
  });

  it("gives a new board of the canvas's own kinds the box it will be drawn in", () => {
    expect(newBoardSize("garment")).toEqual(GARMENT_BOX);
    expect(newBoardSize("order")).toEqual({ width: 320, height: 220 });
    expect(newBoardSize("mockup")).toBeNull();
  });
});

describe("connectors", () => {
  const box = { x: 0, y: 0, width: 100, height: 120 };

  it("leave from the right edge's middle and arrive at the numbered input", () => {
    expect(outDot(box)).toEqual({ x: 100, y: 60 });
    expect(inDot(box, "ai_image", 1)).toEqual({ x: 0, y: 24 });
    expect(inDot(box, "ai_image", 9)).toEqual({ x: 0, y: 96 });
    expect(inDot(box, "artboard", 1)).toEqual({ x: 0, y: 60 });
  });

  it("curve level out of one board and into the next", () => {
    expect(curve({ x: 0, y: 0 }, { x: 200, y: 50 })).toBe("M 0 0 C 100 0, 100 50, 200 50");
  });

  it("fan out from one board and in to another, and skip an edge to a board that is gone", () => {
    const graph = {
      boards: [board("g", "garment", { size: GARMENT_BOX }), board("m1", "mockup", at(400, 0)), board("m2", "mockup", at(400, 300)), board("ai", "ai_image", at(800, 0))],
      edges: [link("e1", "g", "m1"), link("e2", "g", "m2"), link("e3", "m1", "ai", 1), link("e4", "m2", "ai", 2), link("e5", "gone", "ai", 3)],
    };
    const connectors = connectorsBetween(graph);
    expect(connectors.map((one) => one.edgeId)).toEqual(["e1", "e2", "e3", "e4"]);
    expect(connectors[0]?.path.startsWith("M 320 190")).toBe(true);
    expect(connectors[0]?.span).toEqual({ x: 320, y: 84, width: 80, height: 106 });
  });
});

describe("culling", () => {
  const near = board("near", "mockup", at(10, 10));
  const far = board("far", "mockup", at(50_000, 0));

  it("draws a small canvas whole", () => {
    expect(visibleBoards([near, far], HOME, { width: 1000, height: 600 }).map((one) => one.id)).toEqual(["near", "far"]);
  });

  it("draws only the boards the screen shows on a large canvas, and always the selected ones", () => {
    const screen = { width: 1000, height: 600 };
    const many = [near, ...Array.from({ length: CULL_FROM }, (_, n) => board(`far-${n}`, "mockup", at(50_000 + n * 400, 0)))];
    expect(visibleBoards(many, HOME, screen).map((one) => one.id)).toEqual(["near"]);
    expect(visibleBoards(many, HOME, screen, ["far-3"]).map((one) => one.id)).toEqual(["near", "far-3"]);
  });

  it("draws only the connectors that could cross the screen, a long one from far away included", () => {
    const connectors = connectorsBetween({ boards: [near, board("next", "ai_image", at(400, -26)), far], edges: [link("a", "near", "next"), link("b", "far", "next", 2)] });
    expect(visibleConnectors(connectors, HOME, { width: 1000, height: 600 }).map((one) => one.edgeId)).toEqual(["a", "b"]);
    const far2 = board("far2", "artboard", at(60_000, 0));
    expect(visibleConnectors(connectorsBetween({ boards: [far, far2], edges: [link("c", "far", "far2")] }), HOME, { width: 10, height: 10 })).toEqual([]);
  });
});

describe("the marquee and the keyboard", () => {
  const boards = [board("a", "mockup", at(0, 0)), board("b", "mockup", at(400, 0)), board("c", "mockup", at(0, 400))];

  it("catches every board whose box it touches", () => {
    expect(marqueeHits(boards, { x: 200, y: 100, width: 300, height: 10 })).toEqual(["a", "b"]);
    expect(marqueeHits(boards, { x: 5000, y: 0, width: 1, height: 1 })).toEqual([]);
  });

  it("moves Tab through the boards in reading order, wrapping, and Shift-Tab back", () => {
    expect(nextInOrder(boards, null, false)).toBe("a");
    expect(nextInOrder(boards, null, true)).toBe("c");
    expect(nextInOrder(boards, "a", false)).toBe("b");
    expect(nextInOrder(boards, "c", false)).toBe("a");
    expect(nextInOrder(boards, "a", true)).toBe("c");
    expect(nextInOrder(boards, "missing", false)).toBe("a");
    expect(nextInOrder([], "a", false)).toBeNull();
  });

  it("bounds the content for fit, or says there is none", () => {
    expect(contentBounds([])).toBeNull();
    expect(contentBounds(boards)).toEqual({ x: 0, y: 0, width: 400 + CARD_SIZE.width, height: 400 + CARD_SIZE.height });
  });
});
