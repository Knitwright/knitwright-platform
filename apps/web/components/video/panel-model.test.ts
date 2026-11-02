import { describe, expect, it } from "vitest";
import { board, designBoard, link, project, ready } from "@/lib/launch/fixtures/canvas";
import { panelDouble, PANEL_OF_KIND, type ArtboardPreset, type BoardView, type LaunchContext } from "@/lib/launch";
import { readBoardSettings, writeBoardSettings } from "@/lib/media/video/ai-board";
import { PLACEHOLDER_MODEL_CONFIG } from "@/lib/media/video/model-settings";
import { videoModelsFrom, type VideoModel } from "@/lib/media/video/models";
import * as copy from "./copy";
import { framesOf, panelView } from "./panel-model";

const PRESETS: readonly ArtboardPreset[] = [];

const models = (over: Partial<VideoModel> = {}): readonly VideoModel[] =>
  videoModelsFrom(PLACEHOLDER_MODEL_CONFIG).map((model) => ({ ...model, ...over }));

const context = (boards: readonly BoardView[], edges = [] as never[], selected: string | null = "clip", over: Partial<LaunchContext> = {}): LaunchContext => {
  const selection = selected ? boards.find((one) => one.id === selected) : undefined;
  return {
    project: project(boards, edges),
    selection: selection ? { board: selection, image: false } : null,
    credits: 100,
    presets: PRESETS,
    unit: "px",
    zoom: 100,
    dockTool: "select",
    busy: false,
    ...over,
  };
};

/** A design, a mockup fed by it, and an AI video board fed by the mockup: the spec's own wiring. */
const wired = () => {
  const boards = [designBoard("design"), board("mock", "mockup"), board("clip", "ai_video", { settings: { modelKey: "kling-2.1-standard", seconds: 5 } })];
  const edges = [link("e1", "design", "mock"), link("e2", "mock", "clip")] as never[];
  return { boards, edges };
};

describe("the panel this workstream fills", () => {
  it("is the one L1 left for it", () => {
    expect(PANEL_OF_KIND.ai_video).toBe("board-ai-video");
  });
});

describe("the empty states", () => {
  it("asks for a board when nothing is selected", () => {
    const view = panelView({ context: context([board("clip", "ai_video")], [] as never[], null), settings: readBoardSettings(), models: models(), creditsEnforced: false });
    expect(view.empty).toBe(copy.EMPTY_NO_BOARD);
    expect(view.empty?.action).toMatch(/\w/);
  });

  it("asks for a design when no design board can be reached backwards", () => {
    const view = panelView({ context: context([board("clip", "ai_video")]), settings: readBoardSettings(), models: models(), creditsEnforced: false });
    expect(view.empty).toBe(copy.EMPTY_NO_DESIGN);
  });

  it("asks for a first frame when a design is behind the board but only the end frame is fed", () => {
    const boards = [designBoard("design"), board("mock", "mockup"), board("clip", "ai_video")];
    const edges = [link("e1", "design", "mock"), link("e2", "mock", "clip", 2)] as never[];
    const view = panelView({ context: context(boards, edges), settings: readBoardSettings(), models: models(), creditsEnforced: false });
    expect(view.empty).toBe(copy.EMPTY_NO_FRAME);
  });

  it("is out of the way once a design and a first frame are there", () => {
    const { boards, edges } = wired();
    expect(panelView({ context: context(boards, edges), settings: readBoardSettings(boards[2]?.settings), models: models(), creditsEnforced: false }).empty).toBeNull();
  });

  it("names exactly one action in every empty state", () => {
    for (const empty of [copy.EMPTY_NO_BOARD, copy.EMPTY_NO_DESIGN, copy.EMPTY_NO_FRAME, copy.STUDIO_EMPTY]) {
      expect(empty.title.length).toBeGreaterThan(3);
      expect(empty.line).toMatch(/\w/);
      expect(empty.action).toMatch(/\w/);
    }
  });
});

describe("the two frames", () => {
  it("reads the first frame from input 1 and the end frame from input 2", () => {
    const boards = [designBoard("design"), board("mock", "mockup"), board("scene", "ai_image"), board("clip", "ai_video")];
    const edges = [link("e1", "design", "mock"), link("e2", "mock", "clip", 1), link("e3", "scene", "clip", 2)] as never[];
    const frames = framesOf(context(boards, edges), boards[3] as BoardView);
    expect(frames.first?.id).toBe("mock");
    expect(frames.end?.id).toBe("scene");
  });

  it("says plainly that an input is empty, and that the end frame is optional", () => {
    const { boards, edges } = wired();
    const view = panelView({ context: context(boards, edges), settings: readBoardSettings(), models: models(), creditsEnforced: false });
    expect(view.frames.first).toMatchObject({ filled: true, from: "mock" });
    expect(view.frames.end).toMatchObject({ filled: false });
    expect(view.frames.end.line).toBe(copy.END_FRAME_OPTIONAL);
  });
});

describe("what the panel offers", () => {
  const { boards, edges } = wired();
  const settings = readBoardSettings(boards[2]?.settings);

  it("offers the eight presets and the three aspects, with the chosen one marked", () => {
    const view = panelView({ context: context(boards, edges), settings: { ...settings, presetKey: "slow_orbit", aspect: "1:1" }, models: models(), creditsEnforced: false });
    expect(view.presets).toHaveLength(8);
    expect(view.presets.filter((preset) => preset.selected).map((preset) => preset.key)).toEqual(["slow_orbit"]);
    expect(view.aspects.map((choice) => choice.aspect)).toEqual(["9:16", "1:1", "16:9"]);
    expect(view.aspects.filter((choice) => choice.selected)).toHaveLength(1);
  });

  it("puts the credits a second, the waiting time and the licence on every model card", () => {
    const view = panelView({ context: context(boards, edges), settings, models: models({ creditsPerSecond: 2 }), creditsEnforced: false });
    expect(view.models[0]).toMatchObject({ price: "2 credits a second", licence: "Commercial licence not confirmed" });
    expect(view.models[0]?.wait).toMatch(/^About \d+:\d\d of waiting$/);
  });

  it("says on the card when nobody has priced a model", () => {
    const view = panelView({ context: context(boards, edges), settings, models: models({ creditsPerSecond: null }), creditsEnforced: false });
    expect(view.models[0]?.price).toBe(copy.COST_UNKNOWN);
  });

  it("marks a model that does hold a commercial licence", () => {
    const view = panelView({ context: context(boards, edges), settings, models: models({ commercialLicence: true }), creditsEnforced: false });
    expect(view.models[0]).toMatchObject({ licence: "Commercial licence", commercialLicence: true });
  });

  it("says when no model is offered at all, and names a key nothing describes", () => {
    const none = panelView({ context: context(boards, edges), settings, models: [], creditsEnforced: false });
    expect(none.modelsLine).toBe(copy.MODEL_NONE_LINE);
    const unknown = panelView({ context: context(boards, edges), settings, models: models(), creditsEnforced: false, unknownModels: ["made-up"] });
    expect(unknown.modelsLine).toContain("made-up");
  });

  it("turns the Audio switch off, with the reason, for a model that makes no sound", () => {
    const quiet = panelView({ context: context(boards, edges), settings: { ...settings, audio: true }, models: models({ audio: false }), creditsEnforced: false });
    expect(quiet.audio).toMatchObject({ on: false, available: false, note: copy.AUDIO_UNAVAILABLE });
    const loud = panelView({ context: context(boards, edges), settings: { ...settings, audio: true }, models: models({ audio: true }), creditsEnforced: false });
    expect(loud.audio).toMatchObject({ on: true, available: true, note: null });
  });

  it("shows the spec's own length bounds and where they came from", () => {
    const view = panelView({ context: context(boards, edges), settings, models: models(), creditsEnforced: false });
    expect(view.duration).toMatchObject({ seconds: 5, min: 3, max: 15 });
    expect(view.duration.note).toMatch(/F-L3/);
  });
});

describe("the Generate button", () => {
  const { boards, edges } = wired();
  const settings = readBoardSettings(boards[2]?.settings);

  it("shows the cost before anything is spent", () => {
    const view = panelView({ context: context(boards, edges), settings, models: models({ creditsPerSecond: 3 }), creditsEnforced: false });
    expect(view.run.label).toBe("Generate (15 credits)");
    expect(view.run.disabled).toBe(false);
    expect(view.run.reason).toBeNull();
  });

  it("is off, with the reason, when the board cannot be run", () => {
    const view = panelView({ context: context([board("clip", "ai_video")]), settings, models: models({ creditsPerSecond: 3 }), creditsEnforced: false });
    expect(view.run.disabled).toBe(true);
    expect(view.run.reason).toMatch(/Join a Design board/);
  });

  it("is off while the shell is busy, and says so", () => {
    const view = panelView({ context: context(boards, edges, "clip", { busy: true }), settings, models: models({ creditsPerSecond: 1 }), creditsEnforced: false });
    expect(view.run.disabled).toBe(true);
    expect(view.busy).toBe(true);
  });

  it("carries the placeholder notice and the catalogue note wherever a credit figure appears", () => {
    const view = panelView({ context: context(boards, edges), settings, models: models({ creditsPerSecond: 1 }), creditsEnforced: false });
    expect(view.notes).toContain(copy.PLACEHOLDER_NOTICE);
    expect(view.notes.some((note) => /placeholder/i.test(note))).toBe(true);
    expect(view.notes.some((note) => /not being charged/.test(note))).toBe(true);
  });

  it("says the balance could not be read only when charging is on", () => {
    const made = (creditsEnforced: boolean) =>
      panelView({ context: context(boards, edges, "clip", { credits: null }), settings, models: models({ creditsPerSecond: 1 }), creditsEnforced });
    expect(made(true).notes).toContain(copy.BALANCE_UNKNOWN);
    expect(made(false).notes).not.toContain(copy.BALANCE_UNKNOWN);
  });

  it("gives the chosen model's own estimate of the wait, in milliseconds", () => {
    const view = panelView({ context: context(boards, edges), settings, models: models({ estimatedWaitPerSecond: 12 }), creditsEnforced: false });
    expect(view.estimateMs).toBe(60_000);
    const none = panelView({ context: context(boards, edges), settings: { ...settings, modelKey: null }, models: models(), creditsEnforced: false });
    expect(none.estimateMs).toBeNull();
  });
});

describe("against the shell's own test double", () => {
  it("records a settings change as a request, never a write", () => {
    const double = panelDouble();
    const settings = { ...readBoardSettings(), presetKey: "walk_out" as const, modelKey: "veo-3" };
    double.commands.setBoardSettings("clip", writeBoardSettings(settings));
    double.commands.requestRun("clip");
    expect(double.calls.map((call) => call.name)).toEqual(["setBoardSettings", "requestRun"]);
    expect(readBoardSettings(double.calls[0]?.args[1] as Record<string, unknown>)).toEqual(settings);
  });

  it("asks for a mockup board rather than making one, when the first frame is missing", () => {
    const double = panelDouble();
    double.commands.addBoard("mockup", { x: -320, y: 0 }, "clip");
    expect(double.calls).toEqual([{ name: "addBoard", args: ["mockup", { x: -320, y: 0 }, "clip"] }]);
  });
});

describe("a board that has run", () => {
  it("has a file to play when it is ready", () => {
    const { boards, edges } = wired();
    const done = [...boards.slice(0, 2), ready(boards[2] as BoardView, "file-9")];
    const view = panelView({ context: context(done, edges), settings: readBoardSettings(), models: models(), creditsEnforced: false });
    expect(view.empty).toBeNull();
    expect(done[2]?.outputFileId).toBe("file-9");
  });
});
