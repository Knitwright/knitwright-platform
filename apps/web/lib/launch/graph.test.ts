import { describe, expect, it } from "vitest";
import { board, designBoard, link } from "./fixtures/canvas";
import { canConnect, garmentSource, inputsOf, kindsOnCanvas, nextInput, outputsOf, runnable, runOrder, type Graph } from "./index";

const graph = (boards: Graph["boards"], edges: Graph["edges"] = []): Graph => ({ boards, edges });

/** The pack the spec's acceptance test asks for: a design feeding mockups, a picture and a card. */
const launchPack = (): Graph =>
  graph(
    [
      designBoard("design"),
      board("flat-lay", "mockup"),
      board("line-up", "mockup"),
      board("floodlit", "ai_image"),
      board("size-chart", "info_card"),
      board("story", "marketing"),
      board("walk-out", "ai_video"),
    ],
    [
      link("e1", "design", "flat-lay"),
      link("e2", "design", "line-up"),
      link("e3", "design", "floodlit"),
      link("e4", "design", "size-chart"),
      link("e5", "flat-lay", "story"),
      link("e6", "floodlit", "walk-out"),
    ],
  );

describe("the connectors of a board", () => {
  it("reads the inputs in input order, so image 1 is always the same picture", () => {
    const canvas = graph([designBoard("design"), board("mockup", "mockup"), board("scene", "ai_image")], [
      link("e2", "mockup", "scene", 2),
      link("e1", "design", "scene", 1),
    ]);

    expect(inputsOf(canvas, "scene").map((edge) => edge.fromBoardId)).toEqual(["design", "mockup"]);
    expect(outputsOf(canvas, "design").map((edge) => edge.toBoardId)).toEqual(["scene"]);
  });

  it("names the next free input, and nothing once the board is full", () => {
    const canvas = graph([designBoard("design"), board("card", "info_card")], [link("e1", "design", "card")]);

    expect(nextInput(canvas, "card")).toBeNull();
    expect(nextInput(graph([board("scene", "ai_image")]), "scene")).toBe(1);
    expect(nextInput(graph([designBoard("design")]), "design")).toBeNull();
    expect(nextInput(graph([]), "gone")).toBeNull();
  });
});

describe("the garment lock", () => {
  it("names the design board every picture on a branch comes from, with its version", () => {
    expect(garmentSource(launchPack(), "walk-out")).toEqual({ locked: true, boardId: "design", designProjectId: "project-1", version: 3 });
  });

  it("is the board itself when the board is the design board", () => {
    const source = garmentSource(launchPack(), "design");
    expect(source.locked && source.boardId).toBe("design");
  });

  it("refuses a branch with no design board behind it, and says what to do", () => {
    const loose = graph([board("scene", "ai_image")]);
    const source = garmentSource(loose, "scene");

    expect(source.locked).toBe(false);
    expect(source.locked === false && source.reason).toMatch(/Connect a Design board first/);
    expect(source.locked === false && source.ruleId).toBe("R-GAP-000");
  });

  it("refuses a board that is not on the canvas at all", () => {
    expect(garmentSource(launchPack(), "nowhere").locked).toBe(false);
  });

  it("reads a design board that names no design as locked to no design version", () => {
    const canvas = graph([board("design", "design")]);
    expect(garmentSource(canvas, "design")).toEqual({ locked: true, boardId: "design", designProjectId: null, version: null });
  });
});

describe("drawing a connector", () => {
  const canvas = launchPack();

  it("allows a pair the board table allows", () => {
    expect(canConnect(canvas, "line-up", "story", 2)).toEqual({ allowed: true });
  });

  it("refuses a board feeding itself", () => {
    expect(canConnect(canvas, "story", "story", 1)).toMatchObject({ allowed: false, reason: "A board cannot feed itself." });
  });

  it("refuses a board that is not on the canvas", () => {
    expect(canConnect(canvas, "gone", "story", 1)).toMatchObject({ allowed: false });
    expect(canConnect(canvas, "story", "gone", 1)).toMatchObject({ allowed: false });
  });

  it("refuses anything into a design board or an artboard", () => {
    expect(canConnect(canvas, "flat-lay", "design", 1)).toMatchObject({ allowed: false, reason: "A Design board takes nothing from another board." });
  });

  it("refuses a pair the board table does not list", () => {
    expect(canConnect(canvas, "size-chart", "walk-out", 1)).toMatchObject({
      allowed: false,
      reason: "An AI video board cannot start from an Info card board.",
    });
  });

  it("refuses an input number the kind does not have", () => {
    expect(canConnect(canvas, "design", "size-chart", 2)).toMatchObject({ allowed: false, reason: "An Info card board has 1 input." });
    expect(canConnect(canvas, "line-up", "story", 0)).toMatchObject({ allowed: false, reason: "A Marketing board has 6 inputs." });
  });

  it("refuses an input that is already connected, and a board that already feeds this one", () => {
    expect(canConnect(canvas, "line-up", "story", 1)).toMatchObject({ allowed: false, reason: "Input 1 is already connected." });
    expect(canConnect(canvas, "flat-lay", "story", 2)).toMatchObject({ allowed: false, reason: "That board already feeds this one." });
  });

  it("refuses a loop, which could never finish", () => {
    const loopy = graph([designBoard("design"), board("a", "ai_image"), board("b", "ai_image")], [link("e1", "design", "a"), link("e2", "a", "b")]);

    expect(canConnect(loopy, "b", "a", 2)).toMatchObject({ allowed: false, reason: "That would make a loop, and a loop could never finish." });
  });
});

describe("running a board", () => {
  it("runs a board with its inputs connected and a design behind it", () => {
    expect(runnable(launchPack(), "floodlit")).toEqual({ canRun: true });
  });

  it("does not run a design board or an artboard: there is nothing to run", () => {
    expect(runnable(launchPack(), "design")).toMatchObject({ canRun: false, reason: "A Design board holds what you put in it; there is nothing to run." });
  });

  it("refuses a board with nothing connected into it", () => {
    const canvas = graph([designBoard("design"), board("scene", "ai_image")]);
    expect(runnable(canvas, "scene")).toMatchObject({ canRun: false, reason: "Connect a board into this AI image board first." });
  });

  it("refuses a board whose chain has no design board, which is the garment lock", () => {
    const canvas = graph([board("art", "artboard"), board("post", "marketing")], [link("e1", "art", "post")]);
    expect(runnable(canvas, "post")).toMatchObject({ canRun: false, reason: expect.stringMatching(/Connect a Design board first/) });
  });

  it("refuses a board that is not on the canvas", () => {
    expect(runnable(launchPack(), "gone")).toMatchObject({ canRun: false });
  });
});

describe("run all downstream", () => {
  it("lists every board the chosen one feeds, each after the boards that feed it", () => {
    const order = runOrder(launchPack(), "design");

    expect(order).toHaveLength(6);
    expect(order.indexOf("story")).toBeGreaterThan(order.indexOf("flat-lay"));
    expect(order.indexOf("walk-out")).toBeGreaterThan(order.indexOf("floodlit"));
  });

  it("lists nothing for a board at the end of a chain", () => {
    expect(runOrder(launchPack(), "story")).toEqual([]);
  });

  it("places a board whose other input sits outside the run as soon as its own chain allows", () => {
    const canvas = graph([designBoard("design"), board("card", "info_card"), board("scene", "ai_image"), board("post", "marketing")], [
      link("e1", "design", "card"),
      link("e2", "design", "scene"),
      link("e3", "scene", "post", 1),
      link("e4", "card", "post", 2),
    ]);

    expect(runOrder(canvas, "scene")).toEqual(["post"]);
  });
});

describe("what is on the canvas", () => {
  it("lists each kind once, for the empty state and the run summary", () => {
    expect(kindsOnCanvas(launchPack()).toSorted()).toEqual(["ai_image", "ai_video", "design", "info_card", "marketing", "mockup"]);
  });
});

describe("the one canvas's kinds (decision 0145)", () => {
  const garment = board("garment", "garment", { settings: { designProjectId: "project-9" }, inputVersion: 4 });

  it("locks a picture to a garment board exactly as to a design board", () => {
    const canvas = graph([garment, board("mock", "mockup")], [link("e1", "garment", "mock")]);
    expect(garmentSource(canvas, "mock")).toEqual({ locked: true, boardId: "garment", designProjectId: "project-9", version: 4 });
    expect(runnable(canvas, "mock")).toEqual({ canRun: true });
  });

  it("links a tech pack and an order to a garment, and never runs them", () => {
    const canvas = graph([garment, board("pack", "tech_pack"), board("order", "order")], [link("e1", "garment", "pack")]);
    expect(canConnect(canvas, "garment", "order", 1)).toEqual({ allowed: true });
    expect(canConnect(canvas, "pack", "order", 1).allowed).toBe(false);
    expect(runnable(canvas, "pack").canRun).toBe(false);
  });
});
