import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildBoard } from "@/lib/inspiration/board";
import { moodCard } from "@/lib/inspiration/sources/ai-mood";
import { stubCard, stubProvider } from "@/lib/inspiration/sources/stubs";
import type { ContextQuery, InspirationCard, MoodboardItem } from "@/lib/inspiration/types";
import { boardView, moodboardView, suggestionsView, tagChip } from "@/lib/inspiration/view";
import { AI_MOOD_LABEL, noKeySentence } from "@/lib/inspiration/vocabulary";
import { listProps, openProps, panelProps, pinTagProps, removeTagProps, suggestProps } from "./a11y";
import { CardTile } from "./CardTile";
import { SuggestionList } from "./SuggestionList";
import { TagChips } from "./TagChips";

/**
 * The inspiration panel's words and attributes (spec F-S1, decision 0082): every card shows its source and opens it,
 * an AI mood image is labelled, a switched-off source says so in one sentence, and the panel says plainly that an
 * inspiration picture never goes on the garment.
 */

const query: ContextQuery = {
  tags: [
    { text: "rugby", kind: "sport" },
    { text: "90s away kit", kind: "pinned" },
  ],
  text: "rugby 90s away kit",
  removed: [],
};

const render = (element: Parameters<typeof renderToStaticMarkup>[0]): string => renderToStaticMarkup(element);

describe("the attributes a screen reader reads", () => {
  it("labels the panel by its heading and says when it is busy", () => {
    expect(panelProps("h1", true)).toEqual({ role: "region", "aria-labelledby": "h1", "aria-busy": true });
  });

  it("names the tag each button acts on, and says whether a tag is pinned", () => {
    expect(removeTagProps("navy")).toEqual({ type: "button", "aria-label": "Remove the tag navy" });
    expect(pinTagProps("navy", false)).toEqual({ type: "button", "aria-label": "Pin the tag navy", "aria-pressed": false });
    expect(pinTagProps("navy", true)).toEqual({ type: "button", "aria-label": "Unpin the tag navy", "aria-pressed": true });
  });

  it("opens a card's source in a new tab, telling nobody where the person came from", () => {
    expect(openProps("https://unsplash.test/photos/1", "Open it")).toEqual({
      href: "https://unsplash.test/photos/1",
      target: "_blank",
      rel: "noreferrer noopener",
      "aria-label": "Open it",
    });
    expect(suggestProps("Suggest from this")).toEqual({ type: "button", "aria-label": "Suggest from this" });
    expect(listProps("Cards")).toEqual({ role: "list", "aria-label": "Cards" });
  });
});

describe("one card", () => {
  const card = stubCard("unsplash", "1", {
    title: "A rugby player in navy",
    openUrl: "https://unsplash.test/photos/abc",
    previewUrl: "https://images.unsplash.test/abc.jpg",
    attribution: { creator: "Ada", creatorUrl: null, provider: "Unsplash", providerUrl: null, notice: "Photo by Ada on Unsplash" },
  });

  it("shows its source, its attribution, and a link that opens the source", () => {
    const html = render(createElement(CardTile, { card: boardView({ query, sources: [{ source: "unsplash", label: "Unsplash", cards: [card], unavailable: null }], searchLinks: [], tookMs: 1 }).sources[0]!.cards[0]! }));
    expect(html).toContain("Unsplash");
    expect(html).toContain("Photo by Ada on Unsplash");
    expect(html).toContain('href="https://unsplash.test/photos/abc"');
    expect(html).toContain('aria-label="Open &quot;A rugby player in navy&quot; on Unsplash"');
  });

  it("hotlinks the picture the provider serves, and sends no referrer with it", () => {
    const html = render(createElement(CardTile, { card: { ...cardViewOf(card) } }));
    expect(html).toContain('src="https://images.unsplash.test/abc.jpg"');
    expect(html).toContain('referrerPolicy="no-referrer"');
  });

  it("labels an AI mood image and says it cannot be saved", () => {
    const html = render(createElement(CardTile, { card: cardViewOf(moodCard(query, "data:image/png;base64,AAAA")) }));
    expect(html).toContain(AI_MOOD_LABEL);
    expect(html).toContain("An AI mood image is not stored");
    expect(html).not.toContain('aria-label="Save');
  });

  it("offers Save on a card that can be saved", () => {
    expect(render(createElement(CardTile, { card: cardViewOf(card) }))).toContain('aria-label="Save &quot;A rugby player in navy&quot; to the moodboard"');
  });
});

const cardViewOf = (card: InspirationCard) =>
  boardView({ query, sources: [{ source: card.source, label: card.sourceLabel, cards: [card], unavailable: null }], searchLinks: [], tookMs: 1 }).sources[0]!.cards[0]!;

describe("the tags", () => {
  it("shows each tag with where it came from, and says so when there are none", () => {
    const html = render(createElement(TagChips, { tags: query.tags.map(tagChip) }));
    expect(html).toContain("rugby");
    expect(html).toContain("Sport");
    expect(html).toContain("Pinned by you");
    expect(html).toContain("Unpin");
    expect(render(createElement(TagChips, { tags: [] }))).toContain("The board follows the design as you make it.");
  });
});

describe("the suggestions", () => {
  const suggestion = {
    id: "unsplash:1|{}",
    cardId: "unsplash:1",
    diff: { kind: "swap-style" as const, style: "fade" as const },
    line: "The pattern as fade. No blocker was raised against Knitwright default.",
    warnings: ["Six colours cost more."],
    ruleId: "R-GAP-000",
  };

  it("shows one line per suggestion, its warnings and an Apply button", () => {
    const html = render(createElement(SuggestionList, { made: suggestionsView({ suggestions: [suggestion], notPossible: [] }) }));
    expect(html).toContain("The pattern as fade.");
    expect(html).toContain("Six colours cost more.");
    expect(html).toContain('aria-label="Apply: The pattern as fade.');
    expect(html).toContain("Why? Rulebook R-GAP-000");
  });

  it("says what the base article cannot do rather than leaving it out silently", () => {
    const html = render(
      createElement(SuggestionList, {
        made: suggestionsView({ suggestions: [], notPossible: ["That jacket's welded zip is not available on this base's fit. The closest is mock neck."] }),
      }),
    );
    expect(html).toContain("welded zip is not available on this base");
    expect(html).toContain("No suggestion came out of that card for this base article.");
  });

  it("says that an inspiration picture never goes on the garment", () => {
    const html = render(createElement(SuggestionList, { made: suggestionsView({ suggestions: [suggestion], notPossible: [] }) }));
    expect(html).toContain("An inspiration picture never goes on the garment.");
  });
});

describe("the whole board's view model", () => {
  it("keeps the spec's source order, and carries each source's own sentence when it shows nothing", async () => {
    const board = await buildBoard(query, {
      sources: [
        stubProvider("knitwright-library", [stubCard("knitwright-library", "1")]),
        { source: "unsplash", unavailable: noKeySentence("Unsplash", "UNSPLASH_ACCESS_KEY") },
      ],
    });
    const view = boardView(board);
    expect(view.sources.map((source) => source.label)).toEqual(["Knitwright library", "Unsplash"]);
    expect(view.notices).toEqual(["Unsplash is not switched on here, so it shows nothing. Knitwright needs UNSPLASH_ACCESS_KEY for it."]);
    expect(view.empty).toBeNull();
  });

  it("says the board is empty when every source came back with nothing", async () => {
    const view = boardView(await buildBoard(query, { sources: [stubProvider("unsplash", [])] }));
    expect(view.empty).toBe("No inspiration yet. Add a tag, or switch a source on.");
  });

  it("draws a saved item with its attribution and a remove button", () => {
    const item: MoodboardItem = {
      id: "11111111-1111-4111-8111-111111111111",
      source: "pexels",
      title: "A sprinter in gold",
      openUrl: "https://pexels.test/photo/1",
      previewUrl: "https://images.pexels.test/1.jpg",
      attribution: { creator: "Bo", creatorUrl: null, provider: "Pexels", providerUrl: null, notice: "Photo by Bo on Pexels" },
      addedAt: "2026-11-20T10:00:00Z",
    };
    const view = moodboardView([item]);
    expect(view.items[0]).toMatchObject({ notice: "Photo by Bo on Pexels", removeLabel: 'Remove "A sprinter in gold" from the moodboard' });
    expect(moodboardView([]).empty).toBe("Nothing saved yet. Save a card to keep it with this design.");
  });
});
