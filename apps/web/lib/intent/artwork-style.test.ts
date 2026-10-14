import { describe, expect, it } from "vitest";
import { deriveStack } from "@/lib/artwork-stack/from-spec";
import { jersey, kitPatternOf } from "@/lib/artwork-stack/fixtures/designs";
import { resolveColour } from "@/lib/artwork-stack/colours";
import type { ArtworkStack } from "@/lib/artwork-stack/schema";
import type { PatternLayer } from "@/lib/artwork-stack/layers";
import { adjustArtworkStyleWire, applyArtworkStyle, ARTWORK_STYLE_PROMPT, explainArtworkStyle, readArtworkStyleWords, setArtworkStyle, setArtworkStyleWire } from "./artwork-style";

const base = (): ArtworkStack =>
  deriveStack(jersey({ kitPattern: kitPatternOf("hoops", { colours: [{ colour: "Green", swatch: "#2f5d34" }, { colour: "Tan", swatch: "#c8b27a" }] }) }));

const camoStack = (): ArtworkStack => {
  const made = setArtworkStyle(base(), { type: "set-artwork-style", generatorId: "camo", presetId: "camo-woodland" });
  if (!made.ok) throw new Error(made.reason);
  return made.stack;
};

const camoLayer = (stack: ArtworkStack): PatternLayer => stack.layers.find((layer): layer is PatternLayer => layer.kind === "pattern")!;

describe("'make the camo bigger and darker green'", () => {
  it("is read as a step up in blob size and a darker green, with no number made up", () => {
    const wire = readArtworkStyleWords("make the camo bigger and darker green", camoStack());
    expect(wire).toMatchObject({ type: "adjust-artwork-style", changes: [{ paramId: "scale", direction: "up", steps: 1 }], colour: { shade: "darker", hue: "green", steps: 1 } });
    expect(adjustArtworkStyleWire.safeParse(wire).success).toBe(true);
  });

  it("changes the blob size by one step and the green by one shade, with before and after", () => {
    const stack = camoStack();
    const wire = readArtworkStyleWords("make the camo bigger and darker green", stack)!;
    const result = applyArtworkStyle(stack, wire);
    if (!result.ok) throw new Error(result.reason);
    expect(camoLayer(result.stack).params.scale).toBe(70);
    expect(result.steps[0]).toEqual({ what: "Camo blob size", before: "6 cm", after: "7 cm" });
    const colourId = camoLayer(stack).colourIds[0];
    const [was, now] = [resolveColour(stack, "main", colourId)!.screen!, resolveColour(result.stack, "main", colourId)!.screen!];
    expect(now).not.toBe(was);
    expect(result.steps[1]).toEqual({ what: "Green in the camo", before: "#2f5d34", after: now });
    expect(parseInt(now.slice(1, 3), 16)).toBeLessThan(parseInt(was.slice(1, 3), 16) + 1);
    expect(resolveColour(result.stack, "main", colourId)!.provenance).toBe("ai-suggested");
    expect(explainArtworkStyle(result)[0]).toBe("Camo blob size: from 6 cm to 7 cm.");
    expect(stack).toEqual(camoStack());
  });

  it("clamps with a sentence when the ask goes past the largest blob", () => {
    const stack = camoStack();
    const big = applyArtworkStyle(stack, { type: "adjust-artwork-style", changes: [{ paramId: "scale", direction: "up", steps: 5 }] });
    if (!big.ok) throw new Error(big.reason);
    expect(camoLayer(big.stack).params.scale).toBe(110);
    const again = applyArtworkStyle(big.stack, { type: "adjust-artwork-style", changes: [{ paramId: "scale", direction: "up", steps: 5 }] });
    if (!again.ok) throw new Error(again.reason);
    expect(camoLayer(again.stack).params.scale).toBe(120);
    expect(again.notes).toContain("Largest camo blob is 12 cm.");
    expect(explainArtworkStyle(again)).toContain("Largest camo blob is 12 cm.");
  });
});

describe("reading words", () => {
  it("gives nothing for words that name no setting or shade, or a stack with no style", () => {
    expect(readArtworkStyleWords("make it blue", camoStack())).toBeNull();
    expect(readArtworkStyleWords("bigger", deriveStack(jersey()))).toBeNull();
    expect(readArtworkStyleWords("make the camo bigger", { ...camoStack(), layers: [...camoStack().layers, { ...camoLayer(camoStack()), id: "second" }] })).toMatchObject({ layerId: expect.any(String) });
  });

  it("reads a shade without a colour word, lighter, and a pick by name", () => {
    expect(readArtworkStyleWords("a lot lighter", camoStack())).toMatchObject({ changes: [], colour: { shade: "lighter", steps: 3 } });
    expect(readArtworkStyleWords("make the camo deeper", camoStack())?.colour).toMatchObject({ shade: "darker" });
    const geo = setArtworkStyle(base(), { type: "set-artwork-style", generatorId: "geometric" });
    if (!geo.ok) throw new Error(geo.reason);
    expect(readArtworkStyleWords("make the geometric diamonds", geo.stack)).toMatchObject({ picks: { motif: 1 } });
    const halftone = setArtworkStyle(base(), { type: "set-artwork-style", generatorId: "halftone" });
    if (!halftone.ok) throw new Error(halftone.reason);
    expect(readArtworkStyleWords("make the halftone lighter dots", halftone.stack)).toMatchObject({ changes: [{ paramId: "maxDot", direction: "down" }] });
    expect(readArtworkStyleWords("make the halftone lighter dots", halftone.stack)?.colour).toBeUndefined();
  });
});

describe("applying a change", () => {
  it("refuses with a sentence when there is no style, or no such layer, or an unknown style", () => {
    expect(applyArtworkStyle(deriveStack(jersey()), { type: "adjust-artwork-style", changes: [] })).toEqual({ ok: false, reason: "This design has no printed style to change. Nothing was changed." });
    const two: ArtworkStack = { ...camoStack(), layers: [...camoStack().layers, { ...camoLayer(camoStack()), id: "second" }] };
    expect(applyArtworkStyle(two, { type: "adjust-artwork-style", changes: [] })).toEqual({ ok: false, reason: "Say which printed style you mean. Nothing was changed." });
    expect(applyArtworkStyle(two, { type: "adjust-artwork-style", layerId: "nope", changes: [] }).ok).toBe(false);
    const unknown: ArtworkStack = { ...camoStack(), layers: camoStack().layers.map((layer) => (layer.kind === "pattern" ? { ...layer, generatorId: "mystery" } : layer)) };
    expect(applyArtworkStyle(unknown, { type: "adjust-artwork-style", changes: [] })).toMatchObject({ ok: false });
    expect(applyArtworkStyle(camoStack(), { type: "adjust-artwork-style", changes: [] })).toEqual({ ok: false, reason: "That is already how it is. Nothing was changed." });
  });

  it("says when there is no such colour to shade, and when a colour cannot go further", () => {
    const none = applyArtworkStyle(camoStack(), { type: "adjust-artwork-style", changes: [], colour: { shade: "darker", hue: "purple", steps: 1 } });
    if (!none.ok) throw new Error(none.reason);
    expect(none.notes).toContain("There is no purple in the camo to make darker.");
    expect(none.steps).toEqual([]);
    const black: ArtworkStack = { ...camoStack(), colours: camoStack().colours.map((entry) => ({ ...entry, screen: "#000000" })), colourways: [{ ...camoStack().colourways[0], colours: {} }] };
    const dark = applyArtworkStyle(black, { type: "adjust-artwork-style", changes: [], colour: { shade: "darker", steps: 1 } });
    if (!dark.ok) throw new Error(dark.reason);
    expect(dark.notes).toContain("That colour is as dark as it goes.");
    const light = applyArtworkStyle(camoStack(), { type: "adjust-artwork-style", changes: [], colour: { shade: "lighter", steps: 1 } });
    if (!light.ok) throw new Error(light.reason);
    expect(light.steps.length).toBeGreaterThan(0);
    const white: ArtworkStack = { ...camoStack(), colours: camoStack().colours.map((entry) => ({ ...entry, screen: "#ffffff" })), colourways: [{ ...camoStack().colourways[0], colours: {} }] };
    const bright = applyArtworkStyle(white, { type: "adjust-artwork-style", changes: [], colour: { shade: "lighter", steps: 1 } });
    if (!bright.ok) throw new Error(bright.reason);
    expect(bright.notes).toContain("That colour is as light as it goes.");
  });

  it("can pick a shape by name, reseed, and leaves unknown picks alone", () => {
    const geo = setArtworkStyle(base(), { type: "set-artwork-style", generatorId: "geometric", presetId: "geometric-chevrons" });
    if (!geo.ok) throw new Error(geo.reason);
    const out = applyArtworkStyle(geo.stack, { type: "adjust-artwork-style", changes: [], picks: { motif: 1, size: 3, nothing: 1 }, reseed: 9 });
    if (!out.ok) throw new Error(out.reason);
    expect(camoLayer(out.stack).params.motif).toBe(1);
    expect(camoLayer(out.stack).seed).toBe(9);
    expect(out.steps).toEqual([
      { what: "Shape", before: "chevron", after: "diamonds" },
      { what: "Arrangement (seed)", before: "7", after: "9" },
    ]);
    const same = applyArtworkStyle(out.stack, { type: "adjust-artwork-style", changes: [], picks: { motif: 1 } });
    expect(same.ok).toBe(false);
  });
});

describe("setting a style", () => {
  it("replaces the printed style from a preset, or adds one over the ground", () => {
    const replaced = setArtworkStyle(base(), { type: "set-artwork-style", generatorId: "gingham", presetId: "gingham-large", seed: 3 });
    if (!replaced.ok) throw new Error(replaced.reason);
    expect(camoLayer(replaced.stack)).toMatchObject({ generatorId: "gingham", seed: 3, params: { size: 40, contrast: 0.4 }, provenance: "ai-suggested" });
    expect(replaced.steps[0]).toEqual({ what: "Printed style", before: "Hoops", after: "Large gingham" });
    const plain = deriveStack(jersey());
    const added = setArtworkStyle(plain, { type: "set-artwork-style", generatorId: "checks" });
    if (!added.ok) throw new Error(added.reason);
    expect(added.stack.layers.filter((layer) => layer.kind === "pattern")).toHaveLength(1);
    expect(added.steps[0]).toEqual({ what: "Printed style", before: "none", after: "Checks" });
  });

  it("refuses an unknown style or preset, and a stack with no colour to print in", () => {
    expect(setArtworkStyle(base(), { type: "set-artwork-style", generatorId: "mystery" })).toEqual({ ok: false, reason: "There is no style called mystery. Nothing was changed." });
    expect(setArtworkStyle(base(), { type: "set-artwork-style", generatorId: "camo", presetId: "nope" }).ok).toBe(false);
    expect(setArtworkStyle(base(), { type: "set-artwork-style", generatorId: "camo", presetId: "gingham-large" }).ok).toBe(false);
    const noColours: ArtworkStack = { ...deriveStack(jersey()), colours: [], layers: [], colourways: [{ id: "main", name: "Main", colours: {} }] };
    expect(setArtworkStyle(noColours, { type: "set-artwork-style", generatorId: "camo" })).toEqual({ ok: false, reason: "Add a colour for the style first. Nothing was changed." });
  });

  it("reads its own wire shape strictly and tells a model about itself", () => {
    expect(setArtworkStyleWire.safeParse({ type: "set-artwork-style", generatorId: "camo", extra: 1 }).success).toBe(false);
    expect(setArtworkStyleWire.safeParse({ type: "set-artwork-style", generatorId: "camo" }).success).toBe(true);
    expect(ARTWORK_STYLE_PROMPT).toContain("adjust-artwork-style");
    expect(explainArtworkStyle({ ok: false, reason: "No." })).toEqual(["No."]);
  });
});
