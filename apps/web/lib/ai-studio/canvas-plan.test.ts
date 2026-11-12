import { describe, expect, it } from "vitest";
import { isGeneratedKind, type ArtboardPreset } from "@/lib/launch";
import { flowTemplate } from "@/lib/flows/templates";
import { readBoardSettings } from "@/lib/shoots/board";
import { checkAnswers, initialAnswers } from "./answers";
import { WORKFLOWS } from "./catalogue";
import { formOf } from "./forms";
import { placeBoards, planCanvas, type PlannedBoard } from "./canvas-plan";

const preset = (key: string, width: number, height: number, unit: "px" | "mm" = "px"): ArtboardPreset =>
  ({ key, label: key, width, height, unit, dpi: unit === "px" ? 72 : 300, sort: 1, note: "test" }) as ArtboardPreset;

const PRESETS = [preset("social-square-1-1", 1080, 1080), preset("story-9-16", 1080, 1920), preset("social-post-4-5", 1080, 1350), preset("a4-print", 210, 297, "mm")];

const answersFor = (id: string, extra: Record<string, string> = {}) => ({ ...initialAnswers(formOf(id)!), product: "p", deadline: "2026-12-04", highlight: "Out now", headline: "Northfield", body: "Sat 3 pm", ...extra });

const boardsOf = (id: string, count = 1, extra: Record<string, string> = {}): readonly PlannedBoard[] => {
  const plan = planCanvas(id, answersFor(id, extra), count, PRESETS);
  if (plan === null || !("boards" in plan)) throw new Error(`${id} is not a board plan`);
  return plan.boards;
};

describe("planCanvas", () => {
  it("has a plan for every canvas workflow, and every form the server checks", () => {
    for (const workflow of WORKFLOWS.filter((one) => one.engine === "canvas" || one.engine === "resize")) {
      const form = formOf(workflow.id);
      expect(form, workflow.id).not.toBeNull();
      expect(checkAnswers(form!, answersFor(workflow.id)).ok, workflow.id).toBe(true);
      expect(planCanvas(workflow.id, answersFor(workflow.id), 1, PRESETS), workflow.id).not.toBeNull();
    }
    expect(planCanvas("crest-to-kit", {}, 1, PRESETS)).toBeNull();
  });

  it("names a flow template that exists where one is the workflow", () => {
    for (const id of ["colourway-set", "shopify-listing-set"]) {
      const plan = planCanvas(id, {}, 1, PRESETS);
      expect(plan && "template" in plan && flowTemplate(plan.template)).toBeTruthy();
    }
  });

  it("starts every plan from the Design board, and feeds every board from one that exists", () => {
    for (const id of ["on-model-try-on", "flat-lay-studio", "try-on-video", "kit-launch-ad", "team-store-promo", "matchday-graphic", "resize-for-all-socials"]) {
      const boards = boardsOf(id);
      expect(boards[0]?.kind).toBe("design");
      for (const board of boards) for (const from of board.feeds) expect(boards.some((one) => one.key === from)).toBe(true);
    }
  });

  it("never lets a generated board feed a marketing or mockup board (AI never draws the garment)", () => {
    for (const id of ["on-model-try-on", "flat-lay-studio", "try-on-video", "kit-launch-ad"]) {
      const boards = boardsOf(id);
      for (const board of boards.filter((one) => one.kind === "marketing" || one.kind === "mockup")) {
        for (const from of board.feeds) expect(isGeneratedKind(boards.find((one) => one.key === from)!.kind)).toBe(false);
      }
    }
  });

  it("puts the try-on answers into the shoot board's own settings", () => {
    const shot = boardsOf("on-model-try-on", 3).find((one) => one.kind === "ai_image")!;
    const settings = readBoardSettings(shot.settings);
    expect(settings.count).toBe(3);
    expect(settings.modelSource).toBe("preset");
    expect(settings.modelPresetKey).toBe(answersFor("on-model-try-on").model);
  });

  it("makes as many launch posts as asked for, at the destination's size, with the highlight written in", () => {
    const posts = boardsOf("kit-launch-ad", 2, { destination: "story-9-16" }).filter((one) => one.kind === "marketing");
    expect(posts.length).toBeGreaterThan(0);
    expect(posts.length).toBeLessThanOrEqual(2);
    expect(Object.values(posts[0]!.settings.words as Record<string, string>)).toContain("Out now");
  });

  it("writes the store's closing date on its posts", () => {
    const posts = boardsOf("team-store-promo").filter((one) => one.kind === "marketing");
    expect(posts).toHaveLength(3);
    expect(JSON.stringify(posts[0]!.settings)).toContain("4 Dec");
  });

  it("draws the design once per screen size, never at a print size", () => {
    const sizes = boardsOf("resize-for-all-socials").filter((one) => one.kind === "mockup");
    expect(sizes).toHaveLength(3);
    expect(sizes.map((one) => one.size.height)).toEqual([1080, 1920, 1350]);
  });
});

describe("placeBoards", () => {
  it("puts each board a column to the right of what feeds it, with no two on top of each other", () => {
    const boards = boardsOf("kit-launch-ad", 3);
    const places = placeBoards(boards);
    expect(places[0]).toEqual({ key: "design", x: 0, y: 0 });
    const keys = new Set(places.map((one) => `${one.x}:${one.y}`));
    expect(keys.size).toBe(places.length);
    expect(places.find((one) => one.key === "hanger")?.x).toBe(1600);
  });
});
