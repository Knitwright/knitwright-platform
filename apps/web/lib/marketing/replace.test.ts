import { describe, expect, it } from "vitest";
import type { DrawnAsset } from "@/lib/launch";
import { emptySlots, fillLayout, type SlotFill } from "./assets";
import { PICTURE_FIT, clearSlot, colourFor, replaceFill } from "./replace";
import { buildLayouts } from "./templates/plans";

const layout = () => buildLayouts().find((one) => one.key === "new-kit-reveal")!;

const picture = (fileId: string): SlotFill => ({
  kind: "picture",
  asset: { role: "panel_layer", provenance: "deterministic", file: { fileId, contentType: "image/png" } } satisfies DrawnAsset,
});

const filledWith = (entries: readonly [string, SlotFill][]) => fillLayout(layout().slots, new Map(entries));

describe("Replace", () => {
  it("keeps the slot's size and its colour role, and says what it kept", () => {
    const slots = layout().slots;
    const before = filledWith([["mockup", picture("one")]]);
    const after = replaceFill(slots, before, "mockup", picture("two"));

    const slot = slots.find((one) => one.id === "mockup")!;
    expect(after.ok && after.kept).toEqual({ width: slot.rect.width, height: slot.rect.height, colourRole: slot.colourRole, fit: PICTURE_FIT });
    expect(after.ok && after.fills.get("mockup")).toEqual(picture("two"));
  });

  it("leaves every other slot exactly as it was", () => {
    const slots = layout().slots;
    const before = filledWith([
      ["mockup", picture("one")],
      ["headline", { kind: "words", text: "New kit" }],
    ]);
    const after = replaceFill(slots, before, "mockup", picture("two"));

    expect(after.ok && after.fills.get("headline")).toEqual({ kind: "words", text: "New kit" });
    expect(after.ok && after.fills.size).toBe(2);
    // The layout itself is a value nothing wrote to.
    expect(slots).toEqual(layout().slots);
  });

  it("refuses a fill the slot does not take, and a picture a model made", () => {
    const slots = layout().slots;
    const before = filledWith([]);

    const words = replaceFill(slots, before, "mockup", { kind: "words", text: "New kit" });
    expect(words.ok ? "" : words.reason).toBe("Mockup does not take that.");

    const generated = replaceFill(slots, before, "mockup", {
      kind: "picture",
      asset: { role: "scene", provenance: "generated", file: { fileId: "g", contentType: "image/png" } } as unknown as DrawnAsset,
    });
    expect(generated.ok ? "" : generated.reason).toContain("never becomes the picture in a layout");
  });

  it("says plainly when the slot is not in this layout", () => {
    expect(replaceFill(layout().slots, filledWith([]), "nope", picture("one")).ok).toBe(false);
    expect(clearSlot(layout().slots, filledWith([]), "nope").ok).toBe(false);
  });

  it("takes a fill out again without changing the slot", () => {
    const slots = layout().slots;
    const before = filledWith([["headline", { kind: "words", text: "New kit" }]]);
    const after = clearSlot(slots, before, "headline");

    expect(after.ok && after.fills.has("headline")).toBe(false);
    expect(after.ok && after.kept.colourRole).toBe(slots.find((one) => one.id === "headline")!.colourRole);
  });
});

describe("the colours a layout shows", () => {
  it("takes the brand's colour for the slot's role, and the layout's when the brand has none", () => {
    const slot = layout().slots.find((one) => one.id === "headline")!;
    expect(colourFor(slot, { primary: "#1b2a49" }, { primary: "#000000" })).toBe("#1b2a49");
    expect(colourFor(slot, {}, { primary: "#000000" })).toBe("#000000");
    expect(colourFor(slot, {}, {})).toBeNull();
  });

  it("changes every slot at once, because a slot names a role and never a colour", () => {
    const brand = { primary: "#c8102e", secondary: "#ffffff", background: "#111111", trim: "#d4af37", accent: "#00843d" };
    const colours = layout().slots.map((one) => colourFor(one, brand, {}));
    expect(colours.every((colour) => colour !== null)).toBe(true);
  });
});

describe("what a person still has to fill", () => {
  it("names every slot with nothing in it, leaving the background out", () => {
    const slots = layout().slots;
    const filled = filledWith([["mockup", picture("one")]]);
    const left = emptySlots(slots, filled).map((one) => one.id);

    expect(left).toEqual(["logo", "headline", "subheadline"]);
  });

  it("names nothing once every slot is filled", () => {
    const slots = layout().slots;
    const filled = filledWith([
      ["logo", picture("logo")],
      ["mockup", picture("one")],
      ["headline", { kind: "words", text: "New kit" }],
      ["subheadline", { kind: "words", text: "Out Friday" }],
    ]);
    expect(emptySlots(slots, filled)).toEqual([]);
  });
});
