import { describe, expect, it } from "vitest";
import { acceptAsset, GENERATED_LABEL, type LaunchAsset } from "@/lib/launch/assets";
import {
  CHARGING_OFF_NOTE,
  DEFAULT_SETTINGS,
  promptFor,
  readBoardSettings,
  runButtonLabel,
  runVerdict,
  videoSceneAsset,
  writeBoardSettings,
  type AiVideoSettings,
  type RunFacts,
} from "./ai-board";
import { VIDEO_GAP_RULE } from "./formats";
import { MODEL_CATALOGUE, type VideoModel } from "./models";
import { GARMENT_LOCK_SENTENCE, PROMPT_PRESETS } from "./prompt-presets";

const model = (over: Partial<VideoModel> = {}): VideoModel => ({ ...(MODEL_CATALOGUE[0] as VideoModel), creditsPerSecond: 2, commercialLicence: true, ...over });

const settings = (over: Partial<AiVideoSettings> = {}): AiVideoSettings => ({ ...DEFAULT_SETTINGS, modelKey: model().key, seconds: 5, ...over });

const facts = (over: Partial<RunFacts> = {}): RunFacts => ({ garmentLocked: true, hasFirstFrame: true, balance: 100, creditsEnforced: true, ...over });

describe("a board's saved settings", () => {
  it("start as a 9:16 story of five seconds, with no model and no preset chosen", () => {
    expect(readBoardSettings()).toEqual(DEFAULT_SETTINGS);
    expect(readBoardSettings({})).toEqual({ modelKey: null, presetKey: null, prompt: "", aspect: "9:16", seconds: 5, audio: false });
  });

  it("read what was stored", () => {
    expect(readBoardSettings({ modelKey: "veo-3", presetKey: "walk_out", prompt: " rain ", aspect: "16:9", seconds: 12, audio: true })).toEqual({
      modelKey: "veo-3",
      presetKey: "walk_out",
      prompt: "rain",
      aspect: "16:9",
      seconds: 12,
      audio: true,
    });
  });

  it("falls back rather than failing on a value of the wrong shape", () => {
    expect(readBoardSettings({ modelKey: 7, presetKey: "moonwalk", prompt: 9, aspect: "4:5", seconds: "ten", audio: "yes" })).toEqual(DEFAULT_SETTINGS);
  });

  it("refuses a length outside the spec's range by falling back, never by clamping to the bound", () => {
    expect(readBoardSettings({ seconds: 2 }).seconds).toBe(5);
    expect(readBoardSettings({ seconds: 99 }).seconds).toBe(5);
    expect(readBoardSettings({ seconds: 3 }).seconds).toBe(3);
    expect(readBoardSettings({ seconds: 15 }).seconds).toBe(15);
  });

  it("goes back out as a record, so Regenerate reruns the board unchanged", () => {
    const mine = settings({ presetKey: "slow_orbit", prompt: "night" });
    expect(readBoardSettings(writeBoardSettings(mine))).toEqual(mine);
  });
});

describe("the prompt a board sends", () => {
  it("is the preset, then the person's words, then the garment lock last", () => {
    const built = promptFor(settings({ presetKey: "walk_out", prompt: "rain" }));
    expect(built.startsWith(PROMPT_PRESETS.walk_out.prompt)).toBe(true);
    expect(built.endsWith(GARMENT_LOCK_SENTENCE)).toBe(true);
  });

  it("carries the garment lock even when nothing at all was typed", () => {
    expect(promptFor(DEFAULT_SETTINGS)).toBe(GARMENT_LOCK_SENTENCE);
  });
});

describe("whether a board may be run", () => {
  const models = [model()];

  it("may, when a design is behind it, a frame feeds it, a priced model is picked and the balance covers it", () => {
    const verdict = runVerdict(settings(), models, facts());
    expect(verdict.canRun).toBe(true);
    if (!verdict.canRun) return;
    expect(verdict.cost).toMatchObject({ priced: true, credits: 10 });
    expect(runButtonLabel(verdict)).toBe("Generate (10 credits)");
  });

  it("refuses a board with no design behind it, naming what to do", () => {
    const verdict = runVerdict(settings(), models, facts({ garmentLocked: false }));
    expect(verdict).toMatchObject({ canRun: false, ruleId: VIDEO_GAP_RULE });
    if (verdict.canRun) return;
    expect(verdict.reason).toContain("Join a Design board");
    expect(runButtonLabel(verdict)).toBe("Generate");
  });

  it("refuses a board with no first frame, because a clip starts from a picture the platform drew", () => {
    const verdict = runVerdict(settings(), models, facts({ hasFirstFrame: false }));
    expect(verdict.canRun).toBe(false);
    if (verdict.canRun) return;
    expect(verdict.reason).toContain("first frame");
  });

  it("asks for a model before it asks for anything else about the model", () => {
    const verdict = runVerdict(settings({ modelKey: null }), models, facts());
    expect(verdict.canRun).toBe(false);
    if (verdict.canRun) return;
    expect(verdict.reason).toContain("Pick a model");
  });

  it("refuses a model nobody has priced, rather than charging a number nobody chose", () => {
    const verdict = runVerdict(settings(), [model({ creditsPerSecond: null })], facts());
    expect(verdict.canRun).toBe(false);
    if (verdict.canRun) return;
    expect(verdict.reason).toMatch(/Nobody has set what a second/);
  });

  it("refuses a length outside the spec's range, with the bounds in the message", () => {
    const verdict = runVerdict({ ...settings(), seconds: 30 }, models, facts());
    expect(verdict.canRun).toBe(false);
    if (verdict.canRun) return;
    expect(verdict.reason).toContain("3 to 15 seconds");
  });

  it("refuses a run the balance does not cover, naming the cost and the balance", () => {
    const verdict = runVerdict(settings(), models, facts({ balance: 4 }));
    expect(verdict.canRun).toBe(false);
    if (verdict.canRun) return;
    expect(verdict.reason).toBe("This clip costs 10 credits and you have 4.");
  });

  it("refuses rather than guessing when the balance could not be read", () => {
    const verdict = runVerdict(settings(), models, facts({ balance: null }));
    expect(verdict.canRun).toBe(false);
    if (verdict.canRun) return;
    expect(verdict.reason).toMatch(/could not be read/);
  });

  it("does not look at the balance at all while charging is off, and still shows the cost", () => {
    const verdict = runVerdict(settings(), models, facts({ balance: null, creditsEnforced: false }));
    expect(verdict.canRun).toBe(true);
    if (!verdict.canRun) return;
    expect(verdict.cost).toMatchObject({ credits: 10 });
    expect(CHARGING_OFF_NOTE).toMatch(/not being charged/);
  });
});

describe("the finished clip as an asset", () => {
  const asset = videoSceneAsset({ fileId: "file-1", contentType: "video/mp4" }, true);

  it("is scenery, labelled as something a model made", () => {
    expect(asset.role).toBe("scene");
    expect(asset.provenance).toBe("generated");
    expect(asset.label).toBe(GENERATED_LABEL);
  });

  it("is taken by an AI video board", () => {
    expect(acceptAsset("ai_video", asset)).toEqual({ accepted: true, role: "asset" });
  });

  it("can never be artwork: a generated clip offered as a panel layer or a print file is refused", () => {
    for (const role of ["panel_layer", "print_file"] as const) {
      // Cast past the compiler on purpose: `SceneAsset` has no such role, and this watches the
      // second door -- the one that catches a value read back out of the database (spec decision 13).
      const forged = { ...asset, role } as unknown as LaunchAsset;
      expect(acceptAsset("ai_video", forged), role).toMatchObject({ accepted: false });
    }
  });

  it("can never stand in for a picture the platform drew", () => {
    for (const kind of ["design", "mockup", "marketing", "info_card", "artboard"] as const) {
      expect(acceptAsset(kind, asset), kind).toMatchObject({ accepted: false });
    }
  });
});
