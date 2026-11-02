import { describe, expect, it } from "vitest";
import type { BoardView, Graph } from "@/lib/launch";
import { canvasOfTemplate, PRESETS, withBoard } from "./fixtures/canvas";
import { operationCost, operationsFor, operationVerdict, planOperation, UPSCALE_FACTORS } from "./operations";
import { STUB_COSTS } from "./stub";

/**
 * Flatten, Upscale and Reframe (spec F-L4's board task bar). Each one is a change to a board's
 * settings and a rerun, so each one is charged, refunded and recorded like any other run.
 */

const ready = (graph: Graph, id: string): Graph => withBoard(graph, id, { status: "ready", outputFileId: "33333333-0000-4000-8000-333333333333" });

const input = (graph: Graph, id: string, over: Readonly<{ factor?: number; presetKey?: string }> = {}) => ({
  graph,
  board: graph.boards.find((one) => one.id === id) as BoardView,
  source: STUB_COSTS,
  presets: PRESETS,
  ...over,
});

describe("all three operations", () => {
  it("refuse a board that has not been run, naming the one thing to do", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");

    for (const id of ["flatten", "upscale", "reframe"] as const) {
      const verdict = operationVerdict(id, input(graph, "render-front", { factor: 2, presetKey: "story-9-16" }));
      expect(verdict.allowed, id).toBe(false);
      expect(verdict.allowed ? "" : verdict.reason).toContain("Run this board first");
    }
  });

  it("appear on the task bar whether or not they can be used, each saying why it is off", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const offers = operationsFor(input(graph, "render-front"));

    expect(offers.map((one) => one.id)).toEqual(["flatten", "upscale", "reframe"]);
    expect(offers.every((one) => one.blocked !== null)).toBe(true);
    expect(offers.every((one) => one.lead.length > 20)).toBe(true);
  });
});

describe("Flatten", () => {
  it("is free, keeps the picture and stops the board following the design", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const plan = planOperation("flatten", input(ready(graph, "render-front"), "render-front"));

    expect(plan?.credits).toBe(0);
    expect(plan?.settings).toMatchObject({ flattened: true, followsDesign: false, scene: "render-front" });
    expect(plan?.size).toEqual({ width: 1080, height: 1080 });
    expect(plan?.note).toContain("free");
  });

  it("costs nothing even on a board a model drew: nothing new is made", () => {
    const { graph } = canvasOfTemplate("brand-drop-pack");

    expect(operationCost("flatten", input(ready(graph, "lifestyle-city"), "lifestyle-city"))).toBe(0);
  });
});

describe("Upscale", () => {
  it("is free for a picture the platform draws, because it is drawn again", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const plan = planOperation("upscale", input(ready(graph, "render-front"), "render-front", { factor: 2 }));

    expect(plan?.credits).toBe(0);
    expect(plan?.size).toEqual({ width: 2160, height: 2160 });
    expect(plan?.settings).toMatchObject({ upscale: 2 });
  });

  it("costs credits for a picture a model made, and for anything that came through one", () => {
    const { graph } = canvasOfTemplate("brand-drop-pack");
    const scene = ready(graph, "lifestyle-city");

    expect(operationCost("upscale", input(scene, "lifestyle-city", { factor: 2 }))).toBe(1);
    expect(operationCost("upscale", input(ready(scene, "drop-post"), "drop-post", { factor: 2 }))).toBe(1);
  });

  it("refuses a factor it does not offer, and one that would be bigger than the canvas draws", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const story = ready(graph, "post-story");

    expect(UPSCALE_FACTORS).toEqual([2, 4]);
    const odd = operationVerdict("upscale", input(story, "post-story", { factor: 3 }));
    expect(odd.allowed ? "" : odd.reason).toContain("goes 2 or 4 times");
    const tooBig = operationVerdict("upscale", input(withBoard(story, "post-story", { size: { width: 6000, height: 6000 } }), "post-story", { factor: 4 }));
    expect(tooBig.allowed ? "" : tooBig.reason).toContain("largest artboard is 20000 px");
  });

  it("takes two times when no factor is given", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");

    expect(planOperation("upscale", input(ready(graph, "render-front"), "render-front"))?.size).toEqual({ width: 2160, height: 2160 });
  });
});

describe("Reframe", () => {
  it("puts the board at another artboard size, from the rows rather than from a number in code", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const plan = planOperation("reframe", input(ready(graph, "render-front"), "render-front", { presetKey: "story-9-16" }));

    expect(plan?.size).toEqual({ width: 1080, height: 1920 });
    expect(plan?.settings).toMatchObject({ aspect: "9:16", preset: "story-9-16" });
    expect(plan?.note).toContain("Placeholder size, not reviewed by anyone");
  });

  it("asks for a shape, refuses one nobody keeps, and refuses the shape it already is", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const front = ready(graph, "render-front");

    expect(operationVerdict("reframe", input(front, "render-front")).allowed).toBe(false);
    const invented = operationVerdict("reframe", input(front, "render-front", { presetKey: "made-up" }));
    expect(invented.allowed ? "" : invented.reason).toContain("not one of the sizes a platform admin keeps");
    const same = operationVerdict("reframe", input(front, "render-front", { presetKey: "social-square-1-1" }));
    expect(same.allowed ? "" : same.reason).toContain("already that shape");
  });

  it("gives no plan at all when it cannot be done", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");

    expect(planOperation("reframe", input(graph, "render-front", { presetKey: "story-9-16" }))).toBeNull();
  });
});
