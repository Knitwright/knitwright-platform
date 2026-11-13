import { describe, expect, it } from "vitest";
import { GARMENT_BOX } from "@/lib/canvas";
import { board, link } from "@/lib/launch/fixtures/canvas";
import { estimatePlan, plannedGraph, plannedId, sendLabel } from "./estimate";
import { DEFAULT_CHOICES } from "./modes";
import { planGeneration } from "./plan";

const costs = { perGeneratedBoard: 20, note: "Made-up prices.", ruleId: "R-GAP-000" };
const garment = board("g", "garment", { size: GARMENT_BOX, settings: { designProjectId: "d1" }, inputVersion: 3 });
const shot = board("s", "ai_image", { settings: { prompt: "old" } });
const graph = { boards: [garment, shot], edges: [link("e1", "g", "s")] };
const choices = { ...DEFAULT_CHOICES, prompt: "On a pitch" };

describe("the cost shown before send", () => {
  it("prices a new image board fed by the garment as one generated board", () => {
    const plan = planGeneration(graph, ["g"], choices);
    const estimate = estimatePlan(graph, plan, costs);
    expect(estimate?.credits).toBe(20);
    expect(sendLabel(estimate, "image")).toBe("Generate image · 20 credits");
  });

  it("prices an edited board on its new settings", () => {
    const plan = planGeneration(graph, ["s"], choices);
    expect(estimatePlan(graph, plan, costs)?.credits).toBe(20);
    const after = plannedGraph(graph, plan);
    expect(after.boards.find((one) => one.id === "s")?.settings["prompt"]).toBe("On a pitch");
  });

  it("counts the free first frame and the clip of a video from a garment", () => {
    const plan = planGeneration(graph, ["g"], { ...choices, mode: "video" });
    const after = plannedGraph(graph, plan);
    expect(after.boards.map((one) => one.id)).toEqual(["g", "s", plannedId("frame"), plannedId("clip")]);
    expect(after.edges.at(-1)).toMatchObject({ fromBoardId: plannedId("frame"), toBoardId: plannedId("clip") });
    const estimate = estimatePlan(graph, plan, costs);
    expect(estimate?.lines.map((line) => line.kind)).toEqual(["mockup", "ai_video"]);
    expect(estimate?.credits).toBe(20);
  });

  it("has no estimate for a refusal, and leaves the canvas alone", () => {
    const plan = planGeneration(graph, [], { ...choices, prompt: "" });
    expect(estimatePlan(graph, plan, costs)).toBeNull();
    expect(plannedGraph(graph, plan)).toBe(graph);
    expect(sendLabel(null, "video")).toBe("Generate video");
  });

  it("says when the run would be free or blocked", () => {
    const free = { lines: [], credits: 0, assets: 1, blocked: 0, note: "", ruleId: "R-GAP-000" };
    expect(sendLabel(free, "image")).toBe("Generate image · free");
    expect(sendLabel({ ...free, blocked: 1 }, "image")).toBe("Generate image · cannot run yet");
    expect(sendLabel({ ...free, credits: 1 }, "video")).toBe("Generate video · 1 credit");
  });
});
