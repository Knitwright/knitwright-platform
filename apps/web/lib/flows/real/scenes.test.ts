import { describe, expect, it } from "vitest";
import { sceneBySlug } from "@/lib/mockups/scenes";
import { FLOW_TEMPLATES } from "../templates";
import { mockupSettingsOf, sceneOfBoard, sceneSlugOfBoard } from "./scenes";

describe("the packs' scene names", () => {
  it("name a scene the mockup library really has, for every mockup and AI image step of every pack", () => {
    for (const template of FLOW_TEMPLATES) {
      for (const step of template.steps) {
        if (step.kind !== "mockup" && step.kind !== "ai_image") continue;
        // A turntable or a carousel is a video recorded from the 3D view: the mockup capability
        // refuses it by its format, with that sentence (mockup.test.ts).
        if (step.settings["scene"] === undefined || step.format === "mp4") continue;
        const scene = sceneOfBoard(step.settings);
        expect([template.slug, step.key, scene?.slug ?? null]).toEqual([template.slug, step.key, expect.any(String)]);
        // A free render must be a scene the platform draws; a teamwear scene is the model's.
        expect([step.key, scene?.source]).toEqual([step.key, step.kind === "mockup" ? "deterministic" : "ai"]);
      }
    }
  });

  it("keeps a board's own scene and picks an aspect-specific one from the board's aspect", () => {
    expect(sceneSlugOfBoard({ sceneSlug: "flat-lay-grass", scene: "flat-lay" })).toBe("flat-lay-grass");
    expect(sceneSlugOfBoard({ scene: "ecommerce-white", aspect: "4:5" })).toBe("ecommerce-white-four-five");
    expect(sceneSlugOfBoard({ scene: "ecommerce-white", aspect: "1:1" })).toBe("ecommerce-white-square");
    expect(sceneSlugOfBoard({ scene: "no-such-scene" })).toBeNull();
    expect(sceneSlugOfBoard({})).toBeNull();
  });

  it("hands the renderer the slug and a crop the scene has, and changes nothing else", () => {
    const settings = mockupSettingsOf({ scene: "render-front", aspect: "1:1", colourway: "away" });
    expect(settings).toMatchObject({ scene: "render-front", aspect: "1:1", colourway: "away", sceneSlug: "product-front" });
    expect(sceneBySlug(settings["sceneSlug"] as string)?.crops).toContain(settings["crop"] ?? "1:1");
  });
});
