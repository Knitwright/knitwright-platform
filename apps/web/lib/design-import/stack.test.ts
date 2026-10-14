import { describe, expect, it } from "vitest";
import { parseArtworkStack } from "@/lib/artwork-stack";
import { buildStack } from "./stack";

const colours = [{ hex: "#1b2a49", share: 0.8 }, { hex: "#d4af37", share: 0.2 }];

describe("buildStack", () => {
  it("makes a valid stack with the main colour as the ground, every value read from the picture", () => {
    const stack = buildStack({ views: ["front"], colours });
    expect(stack).not.toBeNull();
    expect(parseArtworkStack(stack).ok).toBe(true);
    expect(stack!.layers).toHaveLength(1);
    expect(stack!.layers[0]).toMatchObject({ kind: "ground", colourId: "main", views: ["front"], provenance: "read-from-image" });
    expect(stack!.colours.map((c) => [c.id, c.role, c.screen, c.codes.length, c.provenance])).toEqual([
      ["main", "Main colour", "#1b2a49", 0, "read-from-image"],
      ["second", "Second colour", "#d4af37", 0, "read-from-image"],
    ]);
    expect(stack!.colourways[0].colours.main.screen).toBe("#1b2a49");
  });

  it("covers only the views that were found", () => {
    expect(buildStack({ views: ["front", "back"], colours })!.layers[0].views).toEqual(["front", "back"]);
  });

  it("gives nothing when a colour is not a valid screen colour", () => {
    expect(buildStack({ views: ["front"], colours: [{ hex: "red", share: 1 }] })).toBeNull();
  });

  it("gives nothing when there is no view or no colour", () => {
    expect(buildStack({ views: [], colours })).toBeNull();
    expect(buildStack({ views: ["front"], colours: [] })).toBeNull();
  });
});
