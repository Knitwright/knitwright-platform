import { describe, expect, it } from "vitest";
import { artworkStackSchema, type ArtworkStack } from "@/lib/artwork-stack/schema";
import { applyArtworkStyle, hueName, setArtworkStyleWire, shiftLightness } from "./artwork-style";

const colour = (id: string, screen: string) => ({ id, role: id, screen, codes: [], provenance: "user-edited" as const });

function camoStack(): ArtworkStack {
  return artworkStackSchema.parse({
    schemaVersion: 1,
    views: ["front"],
    colours: [colour("navy", "#1b2a49"), colour("moss", "#3d6b2f"), colour("sand", "#d8c9a0")],
    layers: [
      { id: "ground", kind: "ground", views: ["front"], opacity: 1, blend: "normal", provenance: "user-edited", colourId: "navy" },
      {
        id: "camo-one",
        kind: "pattern",
        views: ["front"],
        opacity: 1,
        blend: "normal",
        provenance: "user-edited",
        generatorId: "camo",
        params: { scaleMm: 60 },
        seed: 7,
        datum: { anchor: "chest-line", offsetMm: { x: 0, y: 0 } },
        colourIds: ["moss", "sand"],
      },
    ],
    colourways: [{ id: "home", name: "Home", colours: { moss: { screen: "#3d6b2f", codes: [], provenance: "user-edited" } } }],
  });
}

const wire = (patch: Record<string, unknown>) => setArtworkStyleWire.parse({ type: "set-artwork-style", generatorId: "camo", ...patch });

describe("set-artwork-style", () => {
  it("reads 'make the camo bigger and darker green' as steps with a before and after", () => {
    const stack = camoStack();
    const result = applyArtworkStyle(stack, wire({ steps: [{ word: "bigger" }], colour: { target: "green", tone: "darker" } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.steps).toEqual([expect.objectContaining({ paramId: "scaleMm", before: 60, after: 70 })]);
    const layer = result.stack.layers.find((entry) => entry.id === "camo-one");
    expect(layer).toMatchObject({ params: { scaleMm: 70 }, provenance: "ai-suggested" });
    const before = stack.colours.find((entry) => entry.id === "moss")?.screen ?? "";
    const after = result.stack.colours.find((entry) => entry.id === "moss")?.screen ?? "";
    expect(hueName(after)).toBe("green");
    expect(after < before).toBe(true);
    expect(result.stack.colourways[0]?.colours.moss?.screen).toBe(after);
    expect(result.stack.colours.find((entry) => entry.id === "sand")?.screen).toBe("#d8c9a0");
    expect(artworkStackSchema.safeParse(result.stack).success).toBe(true);
  });

  it("does not change the stack it was given", () => {
    const stack = camoStack();
    const copy = structuredClone(stack);
    applyArtworkStyle(stack, wire({ steps: [{ word: "bigger", times: 2 }], colour: { target: "moss", tone: "lighter" } }));
    expect(stack).toEqual(copy);
  });

  it("clamps at the end of the range and says so", () => {
    const result = applyArtworkStyle(camoStack(), wire({ steps: [{ word: "bigger", times: 5 }, { word: "bigger", times: 5 }, { word: "bigger", times: 5 }] }));
    expect(result.ok && result.stack.layers.find((entry) => entry.id === "camo-one")).toMatchObject({ params: { scaleMm: 120 } });
    expect(result.ok && result.notes).toContain("Largest camo blob size is 12 cm.");
  });

  it("picks a choice by name, and says when a word or a choice is not known", () => {
    const stack = camoStack();
    const result = applyArtworkStyle(stack, wire({ steps: [{ word: "busier" }, { word: "spicy" }], choices: [{ param: "colourCount", name: "x" }] }));
    expect(result.ok && result.notes).toEqual(['Camo cannot be made "spicy".', 'Camo has no choice "x".']);
    expect(applyArtworkStyle(stack, wire({ steps: [{ word: "spicy" }] }))).toEqual({ ok: false, reason: 'Camo cannot be made "spicy".' });
  });

  it("refuses plainly when there is nothing to change", () => {
    const stack = camoStack();
    expect(applyArtworkStyle(stack, wire({ generatorId: "nope" }))).toEqual({ ok: false, reason: "Knitwright has no pattern called nope." });
    expect(applyArtworkStyle(stack, wire({ generatorId: "gradient", steps: [{ word: "longer" }] }))).toEqual({ ok: false, reason: "This design has no gradient pattern to change." });
    expect(applyArtworkStyle(stack, wire({ layerId: "other", steps: [{ word: "bigger" }] })).ok).toBe(false);
    expect(applyArtworkStyle(stack, wire({ colour: { target: "purple", tone: "darker" } }))).toEqual({ ok: false, reason: "No purple in this pattern's colours." });
    expect(applyArtworkStyle(stack, wire({}))).toEqual({ ok: false, reason: "Nothing to change." });
  });

  it("can target a layer by id and a colour by id", () => {
    const result = applyArtworkStyle(camoStack(), wire({ layerId: "camo-one", colour: { target: "sand", tone: "lighter" } }));
    expect(result.ok && result.stack.colours.find((entry) => entry.id === "sand")?.screen).not.toBe("#d8c9a0");
  });

  it("rejects a wire with a number or an unknown field", () => {
    expect(setArtworkStyleWire.safeParse({ type: "set-artwork-style", generatorId: "camo", scale: 99 }).success).toBe(false);
  });
});

describe("colour words", () => {
  it("names a hue and shifts lightness within limits", () => {
    expect(["#ff0000", "#ff8000", "#ffee00", "#00aa00", "#00aaaa", "#0000ff", "#8800ff", "#ff0066", "#808080", "#000000", "#ffffff", "#ff0020"].map(hueName)).toEqual([
      "red", "orange", "yellow", "green", "teal", "blue", "purple", "pink", "grey", "black", "white", "red",
    ]);
    expect(shiftLightness("#000000", "darker")).toBe("#0d0d0d");
    expect(shiftLightness("#ffffff", "lighter")).toBe("#f2f2f2");
    expect(hueName(shiftLightness("#3d6b2f", "darker"))).toBe("green");
  });
});
