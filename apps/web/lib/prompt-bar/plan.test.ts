import { describe, expect, it } from "vitest";
import { GARMENT_BOX } from "@/lib/canvas";
import { board, link } from "@/lib/launch/fixtures/canvas";
import { DEFAULT_CHOICES, type PromptChoices } from "./modes";
import { editedBoard, NEEDS_END_FRAME, NO_GARMENT, NO_WORDS, placeAfter, planGeneration, referenceOf, settingsFor, sizeForAspect } from "./plan";

const garment = board("g", "garment", { size: GARMENT_BOX, settings: { designProjectId: "d1" } });
const mockup = board("m", "mockup", { at: { x: 500, y: 0 } });
const shot = board("s", "ai_image", { at: { x: 900, y: 0 }, settings: { prompt: "old words", sceneSlug: "pitch", count: 2 } });
const clip = board("v", "ai_video", { settings: { prompt: "clip words", modelKey: "veo-3" } });
const artboard = board("a", "artboard");
const graph = { boards: [garment, mockup, shot, clip, artboard], edges: [link("e1", "g", "m"), link("e2", "m", "s")] };

const choose = (over: Partial<PromptChoices>): PromptChoices => ({ ...DEFAULT_CHOICES, prompt: "On a floodlit pitch", ...over });

describe("planGeneration", () => {
  it("refuses an empty prompt", () => {
    expect(planGeneration(graph, [], choose({ prompt: "   " }))).toEqual({ ok: false, reason: NO_WORDS });
  });

  it("edits the selected AI board of the mode's kind, keeping its other settings", () => {
    const plan = planGeneration(graph, ["s"], choose({ count: 3, imageAspect: "4:5" }));
    expect(plan).toMatchObject({ ok: true, action: "edit", board: { id: "s" } });
    if (!plan.ok || plan.action !== "edit") throw new Error("expected an edit");
    expect(plan.settings).toMatchObject({ prompt: "On a floodlit pitch", sceneSlug: "pitch", count: 3, aspect: "4:5" });
  });

  it("adds an image fed by the selected board when the image board accepts it", () => {
    const plan = planGeneration(graph, ["m"], choose({}));
    if (!plan.ok || plan.action !== "add") throw new Error("expected an add");
    expect(plan.boards).toHaveLength(1);
    expect(plan.boards[0]).toMatchObject({ kind: "ai_image", feeds: [{ from: "m", inputIndex: 1 }], at: placeAfter(mockup) });
    expect(plan.scope).toBe("board");
  });

  it("falls back to the first garment when the selection cannot feed an image", () => {
    const plan = planGeneration(graph, ["a"], choose({}));
    if (!plan.ok || plan.action !== "add") throw new Error("expected an add");
    expect(plan.boards[0]?.feeds).toEqual([{ from: "g", inputIndex: 1 }]);
  });

  it("refuses when the canvas has no garment to put in a scene", () => {
    expect(planGeneration({ boards: [artboard], edges: [] }, [], choose({}))).toEqual({ ok: false, reason: NO_GARMENT });
    expect(planGeneration({ boards: [artboard], edges: [] }, [], choose({ mode: "video" }))).toEqual({ ok: false, reason: NO_GARMENT });
  });

  it("animates a selected picture straight away", () => {
    const plan = planGeneration(graph, ["m"], choose({ mode: "video", videoModelKey: "wan-2.2", seconds: 8 }));
    if (!plan.ok || plan.action !== "add") throw new Error("expected an add");
    expect(plan.boards[0]).toMatchObject({ kind: "ai_video", feeds: [{ from: "m", inputIndex: 1 }] });
    expect(plan.boards[0]?.settings).toMatchObject({ modelKey: "wan-2.2", seconds: 8, aspect: "9:16" });
  });

  it("puts a free first-frame mockup in front of a video made from a garment", () => {
    const plan = planGeneration(graph, ["g"], choose({ mode: "video" }));
    if (!plan.ok || plan.action !== "add") throw new Error("expected an add");
    expect(plan.boards.map((one) => one.kind)).toEqual(["mockup", "ai_video"]);
    expect(plan.boards[1]?.feeds).toEqual([{ from: "frame", inputIndex: 1 }]);
    expect(plan).toMatchObject({ runKey: "frame", scope: "downstream" });
    expect(plan.boards[1]!.at.x).toBeGreaterThan(plan.boards[0]!.at.x);
  });

  it("starts from the first garment when nothing is selected in video mode", () => {
    const plan = planGeneration(graph, [], choose({ mode: "video" }));
    if (!plan.ok || plan.action !== "add") throw new Error("expected an add");
    expect(plan.boards[0]?.feeds).toEqual([{ from: "g", inputIndex: 1 }]);
  });

  it("needs two pictures for frames to video", () => {
    expect(planGeneration(graph, ["m"], choose({ mode: "video", referenceMode: "frames" }))).toEqual({ ok: false, reason: NEEDS_END_FRAME });
    const plan = planGeneration(graph, ["m", "s"], choose({ mode: "video", referenceMode: "frames" }));
    if (!plan.ok || plan.action !== "add") throw new Error("expected an add");
    expect(plan.boards[0]?.feeds).toEqual([
      { from: "m", inputIndex: 1 },
      { from: "s", inputIndex: 2 },
    ]);
  });

  it("edits a selected video board, keeping its model when none is picked", () => {
    const plan = planGeneration(graph, ["v"], choose({ mode: "video" }));
    if (!plan.ok || plan.action !== "edit") throw new Error("expected an edit");
    expect(plan.settings).toMatchObject({ modelKey: "veo-3", prompt: "On a floodlit pitch" });
  });
});

describe("the reference and the edited board", () => {
  it("names the board being edited only in its own mode", () => {
    expect(editedBoard(graph, ["s"], "image")?.id).toBe("s");
    expect(editedBoard(graph, ["s"], "video")).toBeNull();
    expect(editedBoard(graph, ["v"], "video")?.id).toBe("v");
    expect(editedBoard(graph, [], "image")).toBeNull();
    expect(editedBoard(graph, ["m"], "image")).toBeNull();
  });

  it("shows what a new board would be fed from", () => {
    expect(referenceOf(graph, ["s"], "image")?.id).toBe("m");
    expect(referenceOf(graph, ["m"], "image")?.id).toBe("m");
    expect(referenceOf(graph, ["g"], "video")?.id).toBe("g");
    expect(referenceOf(graph, ["a"], "video")?.id).toBe("g");
    expect(referenceOf(graph, [], "image")?.id).toBe("g");
  });
});

describe("sizes and settings", () => {
  it("sizes an output 1080 on the short side", () => {
    expect(sizeForAspect("9:16")).toEqual({ width: 1080, height: 1920 });
    expect(sizeForAspect("16:9")).toEqual({ width: 1920, height: 1080 });
    expect(sizeForAspect("1:1")).toEqual({ width: 1080, height: 1080 });
    expect(sizeForAspect("match")).toEqual({ width: 1080, height: 1080 });
  });

  it("cuts the words to the boards' limit", () => {
    expect(settingsFor(choose({ prompt: "x".repeat(900) }))["prompt"]).toHaveLength(400);
  });
});
