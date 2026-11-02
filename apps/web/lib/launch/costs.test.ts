import { describe, expect, it } from "vitest";
import { board, designBoard, link } from "./fixtures/canvas";
import { affordable, boardCost, estimateRun, runLabel, type Graph, type LaunchCostSource } from "./index";

const source: LaunchCostSource = { perGeneratedBoard: 20, note: "Placeholder credit price, not set by the owner", ruleId: "R-GAP-000" };

const pack = (): Graph => ({
  boards: [designBoard("design"), board("flat-lay", "mockup"), board("floodlit", "ai_image"), board("walk-out", "ai_video")],
  edges: [link("e1", "design", "flat-lay"), link("e2", "design", "floodlit"), link("e3", "floodlit", "walk-out")],
});

describe("what one board costs", () => {
  it("is nothing for every board the platform draws itself", () => {
    for (const kind of ["design", "artboard", "mockup", "marketing", "info_card"] as const) {
      expect(boardCost(kind, source)).toBe(0);
    }
  });

  it("is the credit price for a board a model draws, read from the platform's own settings", () => {
    expect(boardCost("ai_image", source)).toBe(20);
    expect(boardCost("ai_video", source)).toBe(20);
  });

  it("never goes below nothing, whatever a setting holds", () => {
    expect(boardCost("ai_image", { ...source, perGeneratedBoard: -5 })).toBe(0);
  });
});

describe("the estimate before anything is spent", () => {
  it("covers one board on its own", () => {
    const estimate = estimateRun(pack(), "floodlit", source);

    expect(estimate.lines).toEqual([{ boardId: "floodlit", kind: "ai_image", credits: 20, blocked: null }]);
    expect(estimate.credits).toBe(20);
  });

  it("covers every board downstream when asked, in run order", () => {
    const estimate = estimateRun(pack(), "design", source, true);

    expect(estimate.lines.map((line) => line.boardId)).toEqual(["design", "flat-lay", "floodlit", "walk-out"]);
    expect(estimate.credits).toBe(40);
  });

  it("charges nothing for a board that cannot run, and says why", () => {
    const loose: Graph = { boards: [board("scene", "ai_image")], edges: [] };
    const estimate = estimateRun(loose, "scene", source);

    expect(estimate.lines[0]).toMatchObject({ credits: 0, blocked: "Connect a board into this AI image board first." });
    expect(estimate.credits).toBe(0);
  });

  it("leaves out a board that is not on the canvas", () => {
    expect(estimateRun(pack(), "gone", source).lines).toEqual([]);
  });

  it("carries the note that says where the figure came from, and its rule id", () => {
    const estimate = estimateRun(pack(), "floodlit", source);

    expect(estimate.note).toBe(source.note);
    expect(estimate.ruleId).toBe("R-GAP-000");
  });
});

describe("whether the brand can afford a run", () => {
  const estimate = estimateRun(pack(), "floodlit", source);

  it("allows a free run without reading a balance at all", () => {
    expect(affordable(estimateRun(pack(), "flat-lay", source), null)).toEqual({ affordable: true, credits: 0 });
  });

  it("allows a paid run the balance covers", () => {
    expect(affordable(estimate, 20)).toEqual({ affordable: true, credits: 20 });
  });

  it("refuses a paid run the balance does not cover, with both numbers", () => {
    expect(affordable(estimate, 5)).toMatchObject({ affordable: false, reason: "This run costs 20 credits and you have 5." });
  });

  it("refuses a paid run when the balance could not be read, rather than treating it as nothing", () => {
    expect(affordable(estimate, null)).toMatchObject({ affordable: false, reason: expect.stringMatching(/could not be read/) });
  });
});

describe("the words on the Run button", () => {
  it("shows the cost before the run, as the spec asks", () => {
    expect(runLabel(estimateRun(pack(), "floodlit", source))).toBe("Run (20 credits)");
    expect(runLabel(estimateRun(pack(), "flat-lay", source))).toBe("Run (free)");
  });

  it("says there is nothing to run when every board is blocked", () => {
    const loose: Graph = { boards: [board("scene", "ai_image")], edges: [] };
    expect(runLabel(estimateRun(loose, "scene", source))).toBe("Nothing to run");
  });
});
