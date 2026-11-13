import { describe, expect, it } from "vitest";
import type { ArtboardPreset } from "@/lib/launch";
import { ALL_MOCKUP_SCENES } from "@/lib/mockups/scenes";
import { DEFAULT_SIDE, GAP, designBoard, formatSize, landingPath, launchName, marketingBoard, mockupBoard } from "./plan";
import { startLaunchBody } from "./schemas";

const story: ArtboardPreset = { key: "story-9-16", label: "Story", width: 1080, height: 1920, unit: "px", dpi: 72, ruleId: "R-GAP-000", note: "" };
const DESIGN = "00000000-0000-4000-8000-000000000001";

describe("the boards a dashboard page puts on a new canvas", () => {
  it("puts the brand's design on a Design board at the origin", () => {
    expect(designBoard({ id: DESIGN, name: "Home kit", version: 3 })).toMatchObject({
      kind: "design",
      name: "Home kit",
      x: 0,
      settings: { designProjectId: DESIGN },
      inputVersion: 3,
    });
  });

  it("puts a mockup board beside it, on the scene and the colourway asked for", () => {
    const scene = ALL_MOCKUP_SCENES.find((one) => one.slug === "hanger-on-wall")!;
    const board = mockupBoard(scene, "away");
    expect(board).toMatchObject({ kind: "mockup", name: scene.title, x: DEFAULT_SIDE + GAP, settings: { sceneSlug: "hanger-on-wall", colourwayId: "away", kitRole: "home" } });
  });

  it("sizes a marketing board by its format's own row, and an empty ad as the default square", () => {
    const board = marketingBoard({ slug: "matchday-story", title: "Matchday", layoutKey: "matchday", format: "story-9-16" }, [story]);
    expect(board).toMatchObject({ kind: "marketing", width: 1080, height: 1920, settings: { templateSlug: "matchday-story", layoutKey: "matchday", format: "story-9-16" } });
    expect(marketingBoard(null, [story])).toMatchObject({ name: "New ad", width: DEFAULT_SIDE, height: DEFAULT_SIDE, settings: {} });
    expect(formatSize("a4-print", [story])).toEqual({ width: DEFAULT_SIDE, height: DEFAULT_SIDE });
  });

  it("lands on the canvas with the new board selected", () => {
    expect(landingPath("p 1", "b", "mockups")).toBe("/project/p%201?panel=mockups&board=b");
    expect(landingPath("p", null, null)).toBe("/project/p");
  });

  it("names the launch after what it started from", () => {
    expect(launchName("  Matchday ")).toBe("Matchday");
    expect(launchName(" ")).toBe("New launch");
    expect(launchName("x".repeat(120))).toHaveLength(80);
  });
});

describe("what the start buttons send", () => {
  it("reads a form, treating an empty field as not given", () => {
    expect(startLaunchBody.parse({ source: "mockup", slug: "hanger-on-wall", designProjectId: "", colourwayId: "" })).toEqual({
      source: "mockup",
      slug: "hanger-on-wall",
      designProjectId: null,
      colourwayId: null,
    });
    expect(startLaunchBody.parse({ source: "ad", designProjectId: DESIGN })).toMatchObject({ slug: null, designProjectId: DESIGN });
  });

  it("refuses a template button with no template, and anything that is not an id", () => {
    expect(startLaunchBody.safeParse({ source: "flow", slug: "" }).success).toBe(false);
    expect(startLaunchBody.safeParse({ source: "marketing", slug: "../x" }).success).toBe(false);
    expect(startLaunchBody.safeParse({ source: "ad", designProjectId: "nope" }).success).toBe(false);
    expect(startLaunchBody.safeParse({ source: "ad", colourwayId: "<b>" }).success).toBe(false);
    expect(startLaunchBody.safeParse({ source: "print" }).success).toBe(false);
  });
});
