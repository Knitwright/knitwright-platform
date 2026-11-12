import { describe, expect, it } from "vitest";
import { TASK_ACTIONS, taskBar } from "@/lib/launch";
import { canvasOfTemplate, withBoard } from "./fixtures/canvas";
import { offeredBar, TASK_STEPS, UNOFFERED_TASK_ACTIONS } from "./task-actions";

describe("the task bar's buttons", () => {
  it("gives every button a step of its own, or leaves it off the bar -- none only selects", () => {
    for (const id of TASK_ACTIONS) {
      const step = TASK_STEPS[id];
      expect([id, step === null]).toEqual([id, UNOFFERED_TASK_ACTIONS.includes(id)]);
    }
  });

  it("runs Remix, adds a video board for Generate video, and does not offer Remove background", () => {
    expect(TASK_STEPS.remix).toEqual({ do: "remix" });
    expect(TASK_STEPS["generate-video"]).toEqual({ do: "add", kind: "ai_video" });

    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const scene = withBoard(graph, "line-up", { status: "ready", outputFileId: "22222222-2222-4222-8222-222222222222" }).boards.find((one) => one.id === "line-up")!;
    const bar = offeredBar(taskBar({ board: scene, image: true })!);

    expect(bar.items.map((item) => item.id)).not.toContain("remove-background");
    expect(bar.items.map((item) => item.id)).toEqual(expect.arrayContaining(["remix", "generate-video"]));
  });
});
