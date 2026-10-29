import { describe, expect, it } from "vitest";
import { ACTION_CARDS, CREATE_GROUPS, CREATE_WAYS, waysOf } from "./actions";
import { hrefOf, isLater } from "./targets";

/**
 * Decision 0074: the action cards of spec F-S4 and the ways the create-new modal offers. The rule
 * the modal exists to keep is that there is no blank canvas: a custom pattern goes through the
 * pattern service request, so nobody can draft a garment the factory has not approved a block for.
 */

const words = (cards: readonly { title: string; text: string }[]): string => cards.map((card) => `${card.title} ${card.text}`).join(" ").toLowerCase();

describe("the action cards", () => {
  it("holds the six cards spec F-S4 lists, in its order", () => {
    expect(ACTION_CARDS.map((card) => card.title)).toEqual([
      "Start a new design",
      "Browse bases and templates",
      "Moodboard",
      "Collection plan",
      "Pattern fill",
      "Launch pack",
    ]);
  });

  it("opens the modal from the first card and the catalogue from the second", () => {
    expect(ACTION_CARDS[0]!.target).toEqual({ kind: "new-design" });
    expect(hrefOf(ACTION_CARDS[1]!.target)).toBe("/catalogue");
  });

  it("marks the four cards whose features are not built as coming later", () => {
    expect(ACTION_CARDS.filter((card) => isLater(card.target)).map((card) => card.id)).toEqual([
      "moodboard",
      "collection",
      "pattern-fill",
      "launch-pack",
    ]);
  });

  it("names the spec feature each card belongs to", () => {
    for (const card of ACTION_CARDS) expect(card.feature, card.id).toMatch(/^F-[A-Z]\d+$/);
  });
});

describe("the ways into a new design", () => {
  it("offers Base products, Templates, From your crest or logo and Your team", () => {
    expect(CREATE_WAYS.map((way) => way.title)).toEqual(["Base products", "Templates", "From your crest or logo", "Your team"]);
  });

  it("offers no blank canvas and no way to draft a pattern from nothing", () => {
    expect(words(CREATE_WAYS)).not.toMatch(/blank|from scratch|draft your own|pattern studio/);
    expect(words(ACTION_CARDS)).not.toMatch(/blank canvas|from scratch/);
  });

  it("never calls a base factory-approved: every seeded article is a Knitwright draft", () => {
    expect(words(CREATE_WAYS)).not.toMatch(/factory-approved|approved/);
  });

  it("sends Base products and Templates to the catalogue's two tabs", () => {
    expect(hrefOf(CREATE_WAYS[0]!.target)).toBe("/catalogue");
    expect(hrefOf(CREATE_WAYS[1]!.target)).toBe("/catalogue?tab=templates");
  });

  it("sends the crest way to the club kit, which puts a crest on a design today", () => {
    expect(hrefOf(CREATE_WAYS[2]!.target)).toBe("/club");
  });

  it("marks shared team designs as coming later rather than opening nothing", () => {
    expect(isLater(CREATE_WAYS[3]!.target)).toBe(true);
  });

  it("draws every way in exactly one group", () => {
    const grouped = CREATE_GROUPS.flatMap((group) => waysOf(group));
    expect(grouped.map((way) => way.id)).toEqual(CREATE_WAYS.map((way) => way.id));
    expect(CREATE_GROUPS.map((group) => group.label)).toEqual(["Knitwright library", "Your own"]);
  });
});
