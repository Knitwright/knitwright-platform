import { describe, expect, it } from "vitest";
import type { ArtboardPreset } from "@/lib/launch";
import { readBoardSettings as readVideo } from "@/lib/media/video/ai-board";
import { readBoardSettings as readShoot } from "@/lib/shoots/board";
import { AGENT_PATH, agentAddress } from "./agent-address";
import { checkAnswers, initialAnswers } from "./answers";
import { GENERATORS, runnableById, workflowById } from "./catalogue";
import { planCanvas, type PlannedBoard } from "./canvas-plan";
import { formOf } from "./forms";
import { applyVariantBody, recolourBody, remixBody, startWorkflowBody } from "./schemas";

const PRESETS: readonly ArtboardPreset[] = [{ key: "social-square-1-1", label: "Square", width: 1080, height: 1080, unit: "px", dpi: 72, ruleId: "R-GAP-000", note: "t" }];
const UUID = "5f0e6a52-6b1f-4c1e-9a43-2f3b8a5d7c11";

const boards = (id: string, answers: Record<string, string>, count = 1): readonly PlannedBoard[] => {
  const plan = planCanvas(id, answers, count, PRESETS);
  if (!plan || !("boards" in plan)) throw new Error("no boards");
  return plan.boards;
};

describe("agentAddress", () => {
  it("carries the words and the sketch start, and nothing when there is nothing", () => {
    expect(agentAddress({})).toBe(AGENT_PATH);
    expect(agentAddress({ say: "  home kit  " })).toBe(`${AGENT_PATH}?say=home+kit`);
    expect(agentAddress({ from: "sketch" })).toBe(`${AGENT_PATH}?from=sketch`);
    expect(agentAddress({ say: "x".repeat(600) }).length).toBeLessThan(600);
  });
});

describe("the generators", () => {
  it("are runnable but not cards of the hub", () => {
    for (const generator of GENERATORS) {
      expect(runnableById(generator.id)).toBe(generator);
      expect(workflowById(generator.id)).toBeNull();
      expect(formOf(generator.id)).not.toBeNull();
    }
    expect(runnableById("crest-to-kit")?.id).toBe("crest-to-kit");
    expect(runnableById("nope")).toBeNull();
  });

  it("puts the image answers on one AI image board fed by the design", () => {
    const form = formOf("image-generator")!;
    const answers = { ...initialAnswers(form), product: "p", prompt: "On a frosty pitch", model: "none", style: "retro-film" };
    expect(checkAnswers(form, answers, 2).ok).toBe(true);
    const image = boards("image-generator", answers, 2).find((one) => one.kind === "ai_image")!;
    const settings = readShoot(image.settings);
    expect(settings).toMatchObject({ count: 2, style: "retro-film", modelSource: "none", prompt: "On a frosty pitch" });
    const withModel = readShoot(boards("image-generator", { ...answers, model: "slim-18-25-light" }).find((one) => one.kind === "ai_image")!.settings);
    expect(withModel.modelSource).toBe("preset");
    expect(readShoot(boards("image-generator", {}).find((one) => one.kind === "ai_image")!.settings).aspect).toBe("1:1");
  });

  it("feeds the clip from a first frame the platform drew, and an end frame when asked", () => {
    const form = formOf("video-generator")!;
    const answers = { ...initialAnswers(form), product: "p", seconds: "8", end: "render-back" };
    const planned = boards("video-generator", answers);
    const clip = planned.find((one) => one.kind === "ai_video")!;
    expect(clip.feeds).toEqual(["frame", "end"]);
    expect(readVideo(clip.settings)).toMatchObject({ seconds: 8, audio: true });
    expect(boards("video-generator", { ...answers, end: "none", audio: "off", preset: "nope" }).find((one) => one.kind === "ai_video")!.feeds).toEqual(["frame"]);
    expect(boards("video-generator", {}).find((one) => one.kind === "ai_video")).toBeDefined();
  });

  it("falls back to defaults for a try-on or a flat lay with missing answers", () => {
    expect(boards("on-model-try-on", {}).some((one) => one.kind === "ai_image")).toBe(true);
    expect(JSON.stringify(boards("flat-lay-studio", {}))).toContain("White surface");
    expect(boards("try-on-video", { setting: "nope" }).some((one) => one.kind === "ai_video")).toBe(true);
    expect(boards("matchday-graphic", { format: "pin-2-3" }).find((one) => one.kind === "marketing")?.settings.format).toBe("social-square-1-1");
    expect(boards("team-store-promo", {}).filter((one) => one.kind === "marketing")).toHaveLength(3);
  });
});

describe("the action bodies", () => {
  it("check the workflow, the design and the answers", () => {
    expect(startWorkflowBody.safeParse({ workflowId: "kit-launch-ad", projectId: UUID, answers: { campaign: "matchday" }, count: 2 }).success).toBe(true);
    expect(startWorkflowBody.safeParse({ workflowId: "../x", projectId: UUID }).success).toBe(false);
    expect(startWorkflowBody.safeParse({ workflowId: "x", projectId: UUID, count: 9 }).success).toBe(false);
  });

  it("check the remix, the recolour and the variant to save", () => {
    expect(remixBody.safeParse({ projectId: UUID, era: "90s", family: "hoops" }).success).toBe(true);
    expect(remixBody.safeParse({ projectId: UUID, era: "60s", family: "hoops" }).success).toBe(false);
    expect(recolourBody.parse({ projectId: UUID, main: " #B22222 " })).toEqual({ projectId: UUID, main: "#b22222", second: null });
    expect(recolourBody.safeParse({ projectId: UUID, main: "red" }).success).toBe(false);
    expect(applyVariantBody.safeParse({ kind: "remix", projectId: UUID, era: "80s", family: "sash", expectedVersion: 2, variantId: "v-0123abcd" }).success).toBe(true);
    expect(applyVariantBody.safeParse({ kind: "recolour", projectId: UUID, main: "#000000", expectedVersion: 2, variantId: "nope" }).success).toBe(false);
  });
});
