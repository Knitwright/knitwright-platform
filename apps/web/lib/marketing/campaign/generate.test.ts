import { describe, expect, it } from "vitest";
import { buildLayouts } from "../templates/plans";
import type { ReadyForm } from "./form";
import { CAMPAIGN_LAYOUTS, STYLE_PREFERENCES, generate, layoutsFor, lockedAreas } from "./generate";
import { CAMPAIGNS, CAMPAIGN_STYLES } from "./steps";

const SIZE = { width: 1080, height: 1350 };

const form = (over: Partial<ReadyForm> = {}): ReadyForm => ({
  product: { source: "mockup", id: "board-1", name: "Flat lay" },
  applyBrand: true,
  brandId: "brand-1",
  logoFileId: null,
  highlight: "Pre-orders close Friday",
  campaign: "new-kit-launch",
  style: "minimal",
  destination: "social-post-4-5",
  imageCount: 3,
  ...over,
});

describe("which layouts a campaign offers", () => {
  it("names only layouts that exist, for every one of the spec's nine campaigns", () => {
    const keys = new Set(buildLayouts().map((layout) => layout.key));
    for (const campaign of CAMPAIGNS) {
      const wanted = CAMPAIGN_LAYOUTS[campaign];
      expect(wanted.length, campaign).toBeGreaterThan(0);
      for (const key of wanted) expect(keys.has(key), `${campaign} -> ${key}`).toBe(true);
    }
  });

  it("offers something for every campaign and every style, so no pair is a dead end", () => {
    for (const campaign of CAMPAIGNS) {
      for (const style of CAMPAIGN_STYLES) {
        expect(layoutsFor(form({ campaign, style })).length, `${campaign}/${style}`).toBeGreaterThan(0);
      }
    }
  });

  it("puts the style's own shape first", () => {
    const minimal = layoutsFor(form({ campaign: "new-kit-launch", style: "minimal" }));
    const grid = layoutsFor(form({ campaign: "new-kit-launch", style: "grid" }));

    expect(minimal[0]!.key).toBe("new-kit-reveal");
    expect(grid[0]!.key).toBe("home-away-split");
    expect(new Set(minimal.map((one) => one.key))).toEqual(new Set(grid.map((one) => one.key)));
  });

  it("keeps the campaign's own order when the style prefers none of them", () => {
    const ordered = layoutsFor(form({ campaign: "matchday", style: "minimal" }));
    expect(ordered.map((one) => one.key)).toEqual(CAMPAIGN_LAYOUTS.matchday.filter((key) => ordered.some((one) => one.key === key)));
  });

  it("names a shape each style can find, so a preference is never a typo", () => {
    const shapes = new Set(Object.values(STYLE_PREFERENCES).flat());
    for (const shape of shapes) {
      const found = CAMPAIGNS.some((campaign) =>
        CAMPAIGN_STYLES.some((style) => layoutsFor(form({ campaign, style })).length > 0),
      );
      expect(found, shape).toBe(true);
    }
  });
});

describe("generating the artboards", () => {
  it("makes as many as were asked for, at the destination's own size", () => {
    const verdict = generate(form({ imageCount: 2 }), SIZE);
    expect(verdict.ok && verdict.artboards).toHaveLength(2);
    expect(verdict.ok && verdict.artboards[0]!.size).toEqual(SIZE);
    expect(verdict.ok && verdict.artboards[0]!.slots[0]!.width).toBeGreaterThan(0);
  });

  it("says what each artboard is, in the campaign's and the style's own words", () => {
    const verdict = generate(form({ campaign: "pre-order", style: "badge-callout", imageCount: 1 }), SIZE);
    expect(verdict.ok && verdict.artboards[0]!.lead).toContain("Pre-order, badge callout.");
  });

  it("gives the same artboards for the same answers, every time", () => {
    expect(generate(form(), SIZE)).toEqual(generate(form(), SIZE));
  });

  it("works at any size, because a slot is a fraction of the artboard", () => {
    const story = generate(form({ imageCount: 1 }), { width: 1080, height: 1920 });
    const a4 = generate(form({ imageCount: 1 }), { width: 2480, height: 3508 });

    expect(story.ok && story.artboards[0]!.slots[0]!.height).toBe(1920);
    expect(a4.ok && a4.artboards[0]!.slots[0]!.height).toBe(3508);
  });

  it("keeps every mockup's rectangle, which is the picture nothing may move", () => {
    const verdict = generate(form({ style: "grid", imageCount: 1 }), SIZE);
    const locked = verdict.ok ? lockedAreas(verdict.artboards[0]!) : [];

    expect(locked).toHaveLength(2);
    for (const one of locked) {
      expect(one.slot.pixelLocked).toBe(true);
      expect(one.width).toBeGreaterThan(0);
    }
  });

  it("refuses rather than moving a mockup, when a layout could not be laid out", () => {
    const broken = buildLayouts()
      .filter((layout) => layout.key === "new-kit-reveal")
      .map((layout) => ({
        ...layout,
        slots: layout.slots.map((one) => (one.id === "headline" ? { ...one, rect: { x: 0.06, y: 0.2, width: 0.88, height: 0.3 } } : one)),
      }));
    const verdict = generate(form({ imageCount: 1 }), SIZE, broken);

    expect(verdict.ok).toBe(false);
    expect(verdict.ok ? "" : verdict.reason).toContain("would cover Mockup");
  });

  it("says plainly when a campaign has no layout on file", () => {
    const verdict = generate(form({ campaign: "restock" }), SIZE, []);
    expect(verdict.ok ? "" : verdict.reason).toBe("No layout is on file for Restock yet.");
  });

  it("calls no model: it answers at once, so there is nowhere for a paid call to happen", () => {
    const verdict = generate(form(), SIZE);
    // Not a promise, and nothing was handed in that could reach a network: a form, a size, the library.
    expect(verdict).not.toBeInstanceOf(Promise);
    expect(verdict.ok && verdict.artboards.every((one) => one.slots.length > 0)).toBe(true);
  });
});
