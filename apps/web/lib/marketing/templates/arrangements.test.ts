import { describe, expect, it } from "vitest";
import { ARRANGEMENTS, LIMITS, MARGIN } from "./arrangements";
import { buildLayouts } from "./plans";
import { SLOT_KINDS, type MarketingSlot } from "./types";

/** Every slot of every arrangement, with the arrangement's name, so a failure says where. */
const everySlot = (): readonly Readonly<{ name: string; one: MarketingSlot }>[] =>
  Object.entries(ARRANGEMENTS).flatMap(([name, build]) => build().map((one) => ({ name, one })));

const isBackdrop = (one: MarketingSlot): boolean => one.rect.width >= 1 && one.rect.height >= 1;

const overlap = (a: MarketingSlot, b: MarketingSlot): boolean =>
  a.rect.x < b.rect.x + b.rect.width - 0.0001 &&
  b.rect.x < a.rect.x + a.rect.width - 0.0001 &&
  a.rect.y < b.rect.y + b.rect.height - 0.0001 &&
  b.rect.y < a.rect.y + a.rect.height - 0.0001;

describe("the arrangements a layout is built from", () => {
  it("keeps every slot inside the artboard, with the margin round it", () => {
    for (const { name, one } of everySlot()) {
      if (isBackdrop(one)) continue;
      expect(one.rect.x, `${name}/${one.id}`).toBeGreaterThanOrEqual(MARGIN - 0.0001);
      expect(one.rect.y, `${name}/${one.id}`).toBeGreaterThanOrEqual(MARGIN - 0.0001);
      expect(one.rect.x + one.rect.width, `${name}/${one.id}`).toBeLessThanOrEqual(1 - MARGIN + 0.0001);
      expect(one.rect.y + one.rect.height, `${name}/${one.id}`).toBeLessThanOrEqual(1 - MARGIN + 0.0001);
    }
  });

  it("puts nothing on top of anything, in any arrangement", () => {
    for (const [name, build] of Object.entries(ARRANGEMENTS)) {
      const placed = build().filter((one) => !isBackdrop(one));
      for (const [index, one] of placed.entries()) {
        for (const other of placed.slice(index + 1)) {
          expect(overlap(one, other), `${name}: ${one.id} over ${other.id}`).toBe(false);
        }
      }
    }
  });

  it("gives every slot an id of its own within its arrangement", () => {
    for (const [name, build] of Object.entries(ARRANGEMENTS)) {
      const ids = build().map((one) => one.id);
      expect(new Set(ids).size, name).toBe(ids.length);
    }
  });

  it("uses only the slot kinds this directory knows", () => {
    for (const { one } of everySlot()) expect(SLOT_KINDS).toContain(one.kind);
  });

  it("names a colour role on every slot and never a colour", () => {
    for (const { name, one } of everySlot()) {
      expect(one.colourRole, `${name}/${one.id}`).toBeTruthy();
      expect(JSON.stringify(one)).not.toMatch(/#[0-9a-f]{3,6}/i);
    }
  });

  it("holds a headline to one line's worth of characters, and body text to more", () => {
    expect(LIMITS.headline).toBeLessThan(LIMITS.subheadline);
    expect(LIMITS.subheadline).toBeLessThan(LIMITS.body);
    expect(LIMITS.callout).toBeLessThan(LIMITS.body);
  });

  it("gives every layout of 07 at least one slot a person fills, and most of them a mockup", () => {
    const layouts = buildLayouts();
    for (const layout of layouts) {
      expect(layout.slots.filter((one) => one.kind !== "shape").length, layout.key).toBeGreaterThan(0);
    }
    const withMockup = layouts.filter((layout) => layout.slots.some((one) => one.kind === "mockup"));
    expect(withMockup.length).toBeGreaterThan(layouts.length / 2);
  });

  it("is used by at least one layout of 07, each arrangement", () => {
    const used = new Set(buildLayouts().map((layout) => JSON.stringify(layout.slots.map((one) => one.id))));
    for (const [name, build] of Object.entries(ARRANGEMENTS)) {
      expect(used.has(JSON.stringify(build().map((one) => one.id))), name).toBe(true);
    }
  });
});
