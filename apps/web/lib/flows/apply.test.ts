import { describe, expect, it } from "vitest";
import { canConnect } from "@/lib/launch";
import { COLUMN_PX, planTemplate, ROW_PX, settingsForStep, sizeForStep } from "./apply";
import { graphOfPlan, PRESETS } from "./fixtures/canvas";
import { CLUB_KIT_LAUNCH_PACK, flowTemplate, FLOW_TEMPLATES } from "./templates";

/** Opening a flow template on a canvas: the boards, their places, their settings and the connectors. */

const plan = (slug = "club-kit-launch-pack", origin?: Readonly<{ x: number; y: number }>) =>
  planTemplate(flowTemplate(slug)!, {
    designProjectId: "11111111-1111-4111-8111-111111111111",
    designVersion: 7,
    presets: PRESETS,
    ...(origin ? { origin } : {}),
  });

describe("the size a step's board opens at", () => {
  it("comes from an artboard row, not from a number in this file", () => {
    const story = CLUB_KIT_LAUNCH_PACK.steps.find((one) => one.key === "post-story")!;
    const square = CLUB_KIT_LAUNCH_PACK.steps.find((one) => one.key === "post-square")!;

    expect(sizeForStep(story, PRESETS)).toEqual({ width: 1080, height: 1920 });
    expect(sizeForStep(square, PRESETS)).toEqual({ width: 1080, height: 1080 });
  });

  it("reads a physical size at its own resolution, so A4 becomes print pixels", () => {
    const poster = flowTemplate("sponsor-pack")!.steps.find((one) => one.key === "poster")!;

    expect(sizeForStep(poster, PRESETS)).toEqual({ width: 2480, height: 3508 });
  });

  it("opens square when no row matches, rather than inventing a size", () => {
    expect(sizeForStep({ ...CLUB_KIT_LAUNCH_PACK.steps[0]!, settings: { aspect: "7:3" } }, PRESETS)).toEqual({ width: 1080, height: 1080 });
    expect(sizeForStep({ ...CLUB_KIT_LAUNCH_PACK.steps[0]!, settings: { preset: "made-up" } }, [])).toEqual({ width: 1080, height: 1080 });
  });
});

describe("what a board keeps of its step", () => {
  it("keeps the step's own prompt and scene, and five facts a rerun reads off the board", () => {
    const step = CLUB_KIT_LAUNCH_PACK.steps.find((one) => one.key === "line-up")!;
    const settings = settingsForStep("club-kit-launch-pack", step);

    expect(settings).toMatchObject({
      scene: "team-line-up-11",
      aspect: "4:5",
      flowTemplate: "club-kit-launch-pack",
      flowStep: "line-up",
      generation: "model",
      format: "png",
      assets: 1,
    });
  });

  it("writes the design on the Design board, so the garment is locked the moment the pack opens", () => {
    const design = plan().boards.find((one) => one.key === "design");

    expect(design?.settings["designProjectId"]).toBe("11111111-1111-4111-8111-111111111111");
    expect(design?.inputVersion).toBe(7);
    expect(plan().boards.filter((one) => one.inputVersion !== null)).toHaveLength(1);
  });
});

describe("where the boards land", () => {
  it("puts a column per yellow section label and a row per board under it", () => {
    const laid = plan();
    const design = laid.boards.find((one) => one.key === "design");
    const second = laid.boards.find((one) => one.key === "render-back");

    expect(design?.at).toEqual({ x: 0, y: 0 });
    expect(second?.at).toEqual({ x: COLUMN_PX, y: ROW_PX });
    expect(laid.sections.map((one) => one.label)).toEqual([...CLUB_KIT_LAUNCH_PACK.sections]);
    expect(laid.sections[1]?.steps).toHaveLength(9);
  });

  it("drops a second pack where it is asked for, so it does not land on the first", () => {
    expect(plan("sponsor-pack", { x: 2_000, y: 400 }).boards[0]?.at).toEqual({ x: 2_000, y: 400 });
  });

  it("puts the section labels just above their column", () => {
    expect(plan().sections[0]?.at).toEqual({ x: 0, y: -48 });
  });
});

describe("the connectors a pack opens with", () => {
  it("are every feed of every step, numbered in input order", () => {
    const laid = plan();

    expect(laid.links.filter((link) => link.to === "post-square")).toEqual([
      { from: "render-front", to: "post-square", inputIndex: 1 },
      { from: "line-up", to: "post-square", inputIndex: 2 },
    ]);
  });

  it("are each one L1 would allow, for every one of the six packs", () => {
    for (const spec of FLOW_TEMPLATES) {
      const laid = planTemplate(spec, { designProjectId: null, designVersion: null, presets: PRESETS });
      const graph = graphOfPlan(laid);
      for (const link of laid.links) {
        const without = { boards: graph.boards, edges: graph.edges.filter((one) => one.toBoardId !== link.to || one.inputIndex !== link.inputIndex) };
        expect(canConnect(without, link.from, link.to, link.inputIndex), `${spec.slug}: ${link.from} -> ${link.to}`).toEqual({ allowed: true });
      }
    }
  });

  it("carries the pack's own asset count through to the plan", () => {
    expect(plan().assets).toBe(14);
    expect(plan("brand-drop-pack").assets).toBe(16);
  });
});
