import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as copy from "./copy";
import { CARD, TO_BE_CONFIRMED } from "./charts";
import { DRAWN_BY_US } from "./backdrops";
import { MOCKUP_EDGE_NOTE } from "./crops";
import { MIN_TURN_WIDTH_NOTE } from "./views";
import { FOR_L3_NOTE, SEEDED_SCENE_NOTE } from "./scenes/build";

/**
 * Every word the mockup studio shows, held to the three rules the plan sets for copy:
 *
 *   * **nothing reads as settled** -- the same forbidden words `lib/techpack/wording.test.ts`
 *     scans the tech pack for, applied here because the scan does not reach this directory;
 *   * **every empty state names the one action that fills it**, and every error says what to do;
 *   * **every seeded default says it was not reviewed by anyone.**
 */

const SETTLED = /\b(checked|verified|approved|confirmed|final|production[- ]ready|passed|validated|certified)\b/i;

/** The one phrase allowed to hold such a word: the words this app uses for a missing value. */
const withoutAllowed = (text: string): string => text.split(TO_BE_CONFIRMED).join(" ");

const sentences = (): readonly string[] => (Object.values(copy) as unknown[]).filter((value): value is string => typeof value === "string");

describe("the words on the mockup studio's screens", () => {
  it("has a word for every part of the surface", () => {
    expect(sentences().length).toBeGreaterThan(30);
  });

  it("says nothing that reads as settled", () => {
    for (const sentence of sentences()) expect(withoutAllowed(sentence), sentence).not.toMatch(SETTLED);
  });

  it("names the one action that fills each empty state", () => {
    expect(copy.NO_SCENES_BODY).toContain("Ask a platform admin");
    expect(copy.NO_MATCH_BODY).toContain("Clear the filters");
    expect(copy.NO_PHOTOS_BODY).toContain("Upload a photograph");
    expect(copy.NO_BOARD_SCENE_BODY).toContain("Mockups panel");
  });

  it("says what to do about each error, and what is happening while a render runs", () => {
    expect(copy.RENDER_FAILED_BODY).toMatch(/Try the scene again/);
    expect(copy.SCENES_FAILED_BODY).toMatch(/Reload the page/);
    expect(copy.RENDERING).toMatch(/…$/);
    expect(copy.RENDERING_HINT).toContain("Nothing is spent");
    expect(copy.LOADING_SCENES).toMatch(/…$/);
  });

  it("says the two rules the spec puts on the page, on the page", () => {
    expect(copy.PLACEMENT_FIXED).toContain("cannot be dragged");
    expect(copy.GARMENT_LOCKED).toContain("never the garment");
    expect(copy.NEEDS_DESIGN).toContain("Connect a Design board");
  });

  it("labels every control it offers", () => {
    for (const label of [copy.SEARCH_LABEL, copy.SCENE_LABEL, copy.CROP_LABEL, copy.KIT_LABEL, copy.COLOURWAY_LABEL, copy.ROSTER_NAME_LABEL, copy.ROSTER_NUMBER_LABEL, copy.RENDER_LABEL]) {
      expect(label).toMatch(/^\S/);
    }
    expect(copy.PREMIUM_TITLE).toContain("costs credits");
    expect(copy.FREE_BADGE).toBe("Free");
  });
});

describe("every seeded default says who reviewed it", () => {
  it("answers nobody, in each of the four places a default is seeded", () => {
    for (const note of [DRAWN_BY_US, MOCKUP_EDGE_NOTE, MIN_TURN_WIDTH_NOTE, SEEDED_SCENE_NOTE]) {
      expect(note.toLowerCase(), note).toContain("not reviewed by anyone");
    }
    expect(FOR_L3_NOTE).toContain("never the garment");
  });

  it("keeps the card's own size a labelled default rather than a magic number", () => {
    expect(CARD.width).toBeGreaterThan(0);
    expect(MOCKUP_EDGE_NOTE).toContain("longest side");
  });
});

describe("the decision record", () => {
  const record = (): string => readFileSync(join(__dirname, "..", "..", "..", "..", "docs", "decisions", "0092-mockup-studio.md"), "utf8");

  it("exists, and lists the scenes this workstream draws against the ones marked for L3", () => {
    const text = record();
    expect(text).toContain("0092");
    expect(text).toContain("R-GAP-000");
    expect(text).toMatch(/Owner questions/);
  });
});
