import { describe, expect, it } from "vitest";
import { asPercent, lockedSlots, mockupCount, place, placeRect, placementVerdict } from "./layout";
import { buildLayouts } from "./templates/plans";
import { slot } from "./templates/types";

const SIZE = { width: 1080, height: 1350 };

const mockupAt = (rect: { x: number; y: number; width: number; height: number }) =>
  slot({ id: "mockup", kind: "mockup", label: "Mockup", rect });

describe("placing a layout on an artboard", () => {
  it("turns fractions into whole pixels", () => {
    expect(placeRect({ x: 0.5, y: 0.25, width: 0.25, height: 0.5 }, SIZE)).toEqual({ x: 540, y: 338, width: 270, height: 675 });
  });

  it("keeps the layout's own order, so what is drawn last stays last", () => {
    const layout = buildLayouts().find((one) => one.key === "new-kit-reveal")!;
    expect(place(layout.slots, SIZE).map((one) => one.slot.id)).toEqual(layout.slots.map((one) => one.id));
  });

  it("writes a rectangle as percentages for a preview", () => {
    expect(asPercent({ x: 0.06, y: 0.18, width: 0.88, height: 0.46 })).toEqual({ left: "6.000%", top: "18.000%", width: "88.000%", height: "46.000%" });
  });
});

describe("whether a layout can be laid out at all", () => {
  it("accepts every layout of 07, at every format it is offered in", () => {
    for (const layout of buildLayouts()) {
      const verdict = placementVerdict(layout.slots);
      expect(verdict.ok, `${layout.key}: ${verdict.ok ? "" : verdict.reason}`).toBe(true);
    }
  });

  it("refuses a slot that hangs off the artboard, and names it", () => {
    const verdict = placementVerdict([mockupAt({ x: 0.8, y: 0.1, width: 0.4, height: 0.2 })]);
    expect(verdict).toEqual({ ok: false, reason: "Mockup does not fit on the artboard.", ruleId: "R-GAP-000" });
  });

  it("refuses a slot with no size", () => {
    const verdict = placementVerdict([mockupAt({ x: 0.1, y: 0.1, width: 0, height: 0.2 })]);
    expect(verdict.ok).toBe(false);
  });

  it("refuses text over a pixel-locked mockup rather than moving the mockup", () => {
    const over = slot({ id: "headline", kind: "text", label: "Headline", rect: { x: 0.1, y: 0.2, width: 0.5, height: 0.2 }, style: "headline", limit: 40 });
    const verdict = placementVerdict([mockupAt({ x: 0.1, y: 0.1, width: 0.6, height: 0.5 }), over]);

    expect(verdict.ok).toBe(false);
    expect(verdict.ok ? "" : verdict.reason).toBe("Headline would cover Mockup, and a placed mockup is never moved or covered.");
  });

  it("lets the background sit under everything, because it is the artboard and not a thing on it", () => {
    const backdrop = slot({ id: "backdrop", kind: "shape", label: "Background", rect: { x: 0, y: 0, width: 1, height: 1 }, colourRole: "background" });
    expect(placementVerdict([backdrop, mockupAt({ x: 0.1, y: 0.1, width: 0.5, height: 0.5 })]).ok).toBe(true);
  });

  it("lets two mockups sit beside each other, because neither covers the other", () => {
    const left = slot({ id: "mockup-1", kind: "mockup", label: "Mockup 1", rect: { x: 0.05, y: 0.2, width: 0.42, height: 0.4 } });
    const right = slot({ id: "mockup-2", kind: "mockup", label: "Mockup 2", rect: { x: 0.53, y: 0.2, width: 0.42, height: 0.4 } });
    expect(placementVerdict([left, right]).ok).toBe(true);
  });
});

describe("what a layout expects to be fed", () => {
  it("counts the pixel-locked pictures, and only those", () => {
    const layouts = buildLayouts();
    const split = layouts.find((one) => one.key === "home-away-split")!;
    const reveal = layouts.find((one) => one.key === "new-kit-reveal")!;

    expect(mockupCount(split.slots)).toBe(2);
    expect(mockupCount(reveal.slots)).toBe(1);
    expect(lockedSlots(reveal.slots).every((one) => one.kind === "mockup")).toBe(true);
  });

  it("marks nothing but a mockup as pixel-locked, in any layout of 07", () => {
    for (const layout of buildLayouts()) {
      for (const one of layout.slots) expect(one.pixelLocked, `${layout.key}/${one.id}`).toBe(one.kind === "mockup");
    }
  });
});
