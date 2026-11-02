import { describe, expect, it } from "vitest";
import {
  CLEAR_FILTERS,
  EMPTY_ACTIONS,
  EMPTY_BODIES,
  EMPTY_TITLES,
  FAILED,
  LIKES_GAP,
  LOADING,
  PANEL_LEADS,
  PANEL_TITLES,
  RIGHTS_GAP,
  SHOWN_PER_COLLECTION,
  BUILT_HERE,
  collectionsOf,
  dayOf,
  paletteApplied,
  type TemplateCard,
} from "./index";

/**
 * The shapes and the words the four panels of this directory share (plan v5, decision 0108).
 *
 * The grouping is here rather than on the server because which collections are open is the panel's
 * own state and changes without a read. Everything it needs has already been narrowed.
 */

const card = (title: string, collection: string): TemplateCard => ({
  id: `id-${title}`,
  slug: title.toLowerCase().replaceAll(" ", "-"),
  title,
  collection,
  articleLabel: "Short sleeve jersey",
  reviewLabel: "Knitwright starter, not reviewed by a factory",
  attribution: null,
  gap: null,
});

const many = (collection: string, count: number): readonly TemplateCard[] =>
  Array.from({ length: count }, (_, at) => card(`${collection} ${at + 1}`, collection));

describe("the collections a panel draws", () => {
  it("keeps the library's own order, and shows a few of each until it is opened", () => {
    const cards = [...many("Football", SHOWN_PER_COLLECTION + 3), ...many("Cricket", 2)];
    const [football, cricket] = collectionsOf(cards, []);
    expect(football?.label).toBe("Football");
    expect(football?.shown).toHaveLength(SHOWN_PER_COLLECTION);
    expect(football?.hidden).toBe(3);
    expect(cricket?.hidden).toBe(0);
  });

  it("shows all of a collection that has been opened, and hides none of it", () => {
    const cards = many("Football", SHOWN_PER_COLLECTION + 3);
    const [only] = collectionsOf(cards, ["Football"]);
    expect(only?.shown).toHaveLength(SHOWN_PER_COLLECTION + 3);
    expect(only?.hidden).toBe(0);
  });

  it("draws nothing at all when nothing matched", () => {
    expect(collectionsOf([], [])).toEqual([]);
  });
});

describe("the words every panel shows", () => {
  it("gives each built panel a title, a lead, a loading line, a failure and an empty state", () => {
    for (const id of BUILT_HERE) {
      expect(PANEL_TITLES[id].length, id).toBeGreaterThan(0);
      expect(PANEL_LEADS[id].length, id).toBeGreaterThan(20);
      expect(LOADING[id].length, id).toBeGreaterThan(0);
      // A failure says what to do and that nothing on the canvas changed.
      expect(FAILED[id], id).toContain("Try again");
      expect(FAILED[id], id).toContain("nothing on your canvas has changed");
      expect(EMPTY_TITLES[id].length, id).toBeGreaterThan(0);
      expect(EMPTY_BODIES[id].length, id).toBeGreaterThan(20);
      // Every empty state names one action, and it opens an address that exists.
      expect(EMPTY_ACTIONS[id].label.length, id).toBeGreaterThan(0);
      expect(EMPTY_ACTIONS[id].href, id).toMatch(/^\//);
    }
  });

  it("says what the panel did after a palette was used, naming the palette", () => {
    expect(paletteApplied("Primary")).toContain("Primary");
    expect(CLEAR_FILTERS).toBe("Clear the filters");
  });

  /**
   * The two gaps these panels open. Both are `R-GAP-000` because the rulebook has no entry for
   * either: what evidence a brand must keep for a picture it prints, and what a like even is.
   */
  it("carries the rule behind each gap it reports", () => {
    for (const gap of [RIGHTS_GAP, LIKES_GAP]) {
      expect(gap.ruleId).toBe("R-GAP-000");
      expect(gap.line.length).toBeGreaterThan(40);
    }
    expect(LIKES_GAP.line).toContain("Nothing in the platform records a like");
  });

  it("reads a day as a person reads it, and says nothing for a stamp it cannot read", () => {
    expect(dayOf("2026-10-03T09:30:00.000Z")).toBe("3 Oct 2026");
    expect(dayOf("")).toBe("");
  });
});
