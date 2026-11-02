import { describe, expect, it } from "vitest";
import { applyFlowTemplateBody, exportFlowBody, flowOperationBody, publishFlowListingBody, runFlowBody } from "./schemas";

/** What the flow screens may send. The brand and the person are never in a body. */

const CANVAS = "33333333-3333-4333-8333-333333333333";
const BOARD = "55555555-5555-4555-8555-555555555555";

describe("opening a pack", () => {
  it("takes one of the six packs, a design and a place to drop it", () => {
    const parsed = applyFlowTemplateBody.parse({ launchProjectId: CANVAS, template: "club-kit-launch-pack" });

    expect(parsed).toEqual({ launchProjectId: CANVAS, template: "club-kit-launch-pack", designProjectId: null, designVersion: null, x: 0, y: 0 });
  });

  it("refuses a pack nobody keeps, and a place off the canvas", () => {
    expect(applyFlowTemplateBody.safeParse({ launchProjectId: CANVAS, template: "made-up" }).success).toBe(false);
    expect(applyFlowTemplateBody.safeParse({ launchProjectId: CANVAS, template: "colourway-set", x: 9_000_000 }).success).toBe(false);
  });

  it("carries no brand and no person: they come from the session", () => {
    const parsed = applyFlowTemplateBody.parse({ launchProjectId: CANVAS, template: "sponsor-pack", brandId: CANVAS, userId: CANVAS });

    expect(Object.keys(parsed).sort()).toEqual(["designProjectId", "designVersion", "launchProjectId", "template", "x", "y"]);
  });
});

describe("running", () => {
  it("names the scope and the figure the person was shown", () => {
    expect(runFlowBody.parse({ launchProjectId: CANVAS, scope: "all", shownCredits: 3 })).toEqual({
      launchProjectId: CANVAS,
      boardId: null,
      scope: "all",
      shownCredits: 3,
    });
  });

  it("refuses a scope it does not know, and a figure that is not a count of credits", () => {
    expect(runFlowBody.safeParse({ launchProjectId: CANVAS, scope: "everything", shownCredits: 0 }).success).toBe(false);
    expect(runFlowBody.safeParse({ launchProjectId: CANVAS, scope: "all", shownCredits: -1 }).success).toBe(false);
    expect(runFlowBody.safeParse({ launchProjectId: CANVAS, scope: "all" }).success).toBe(false);
  });

  it("carries no price of its own: the cost comes from the platform's credit prices", () => {
    const parsed = runFlowBody.parse({ launchProjectId: CANVAS, scope: "board", boardId: BOARD, shownCredits: 1, price: 99 });

    expect(Object.keys(parsed)).not.toContain("price");
  });
});

describe("the three operations", () => {
  it("take a factor Upscale offers and a preset key Reframe can look up", () => {
    expect(flowOperationBody.parse({ launchProjectId: CANVAS, boardId: BOARD, operation: "upscale", factor: 4 }).factor).toBe(4);
    expect(flowOperationBody.parse({ launchProjectId: CANVAS, boardId: BOARD, operation: "reframe", presetKey: "story-9-16" }).presetKey).toBe("story-9-16");
    expect(flowOperationBody.parse({ launchProjectId: CANVAS, boardId: BOARD, operation: "flatten" }).factor).toBeUndefined();
  });

  it("refuse a factor nobody offers, an operation nobody has and a key that is not a key", () => {
    expect(flowOperationBody.safeParse({ launchProjectId: CANVAS, boardId: BOARD, operation: "upscale", factor: 3 }).success).toBe(false);
    expect(flowOperationBody.safeParse({ launchProjectId: CANVAS, boardId: BOARD, operation: "enhance" }).success).toBe(false);
    expect(flowOperationBody.safeParse({ launchProjectId: CANVAS, boardId: BOARD, operation: "reframe", presetKey: "Story 9:16" }).success).toBe(false);
  });
});

describe("handing over and exporting", () => {
  it("take a title and the boards to offer, or every finished board", () => {
    expect(publishFlowListingBody.parse({ launchProjectId: CANVAS, title: " Home kit " })).toEqual({ launchProjectId: CANVAS, title: "Home kit", boardIds: [] });
    expect(exportFlowBody.parse({ launchProjectId: CANVAS, boardIds: [BOARD] }).boardIds).toEqual([BOARD]);
  });

  it("refuse a listing with no title and a list of boards that is not a list of boards", () => {
    expect(publishFlowListingBody.safeParse({ launchProjectId: CANVAS, title: "  " }).success).toBe(false);
    expect(exportFlowBody.safeParse({ launchProjectId: CANVAS, boardIds: ["not-a-board"] }).success).toBe(false);
  });
});
