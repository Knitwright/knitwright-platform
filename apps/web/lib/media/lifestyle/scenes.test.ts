import { describe, expect, it } from "vitest";
import { MEDIA_VIEWS } from "../contract";
import { SCENE_IDS, SCENE_LABELS, SCENE_VIEWS, promptFor } from "./scenes";

describe("scenes", () => {
  it("has the four pictures of the spec: pitch, changing room, street and one on a model", () => {
    expect([...SCENE_IDS]).toEqual(["pitch", "changing_room", "street", "on_model"]);
  });

  it("gives each scene its own view, because an item is unique by set, kind and view", () => {
    const views = SCENE_IDS.map((id) => SCENE_VIEWS[id]);
    expect(new Set(views).size).toBe(SCENE_IDS.length);
    for (const view of views) expect(MEDIA_VIEWS).toContain(view);
  });

  it("labels every scene in plain words", () => {
    for (const id of SCENE_IDS) expect(SCENE_LABELS[id].length).toBeGreaterThan(3);
  });

  it("builds fixed prompts that tell the model to leave marks and colours alone", () => {
    for (const id of SCENE_IDS) {
      const prompt = promptFor(id);
      expect(prompt).toBe(promptFor(id));
      expect(prompt).toMatch(/crest, sponsor logos, names and numbers/);
      expect(prompt).toMatch(/Do not add, remove, redraw or restyle any logo/);
    }
    expect(new Set(SCENE_IDS.map(promptFor)).size).toBe(SCENE_IDS.length);
  });
});
