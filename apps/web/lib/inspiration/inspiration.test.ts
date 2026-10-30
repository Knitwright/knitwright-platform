import { describe, expect, it } from "vitest";
import { ALL_KINDS_STACK, GRAPHIC_STACK, PICTURE_STACK, TILE_STACK, withStack } from "@/lib/techpack/fixtures/stacks";
import { applySchema, boardSchema, removeItemSchema, saveItemSchema, sourceSchema, steerSchema, suggestSchema } from "./input";
import { pictureRefsOf, pixelBreach } from "./no-pixels";
import { UNWIRED_INSPIRATION_PORTS } from "./ports";
import { fetchPreview, previewFromHtml, previewCard } from "./sources/link-preview";
import { moodCard, moodPrompt } from "./sources/ai-mood";
import { pinterestProvider } from "./sources/external";
import { pexelsProvider, unsplashProvider } from "./sources/stock";
import { stubCard, stubFetch } from "./sources/stubs";
import { designContext, styleTagsOf } from "./context-query";
import { jersey, withPattern } from "./fixtures/designs";
import { aiLabelOf, cardView } from "./view";
import { CARD_SOURCES, faultSentence, slowSentence } from "./vocabulary";

/**
 * The parts of the inspiration board the other test files do not reach: what the panel may send, what the ports say
 * before they are wired, and every road a picture can take into a stored design.
 */

const projectId = "11111111-1111-4111-8111-111111111111";

describe("what the panel may send", () => {
  it("takes a design, the product links and whether a mood image was asked for", () => {
    expect(boardSchema.parse({ projectId })).toEqual({ projectId, productLinks: [], withMoodImage: false });
    expect(boardSchema.parse({ projectId, productLinks: ["https://shop.test/a"], withMoodImage: true }).productLinks).toEqual(["https://shop.test/a"]);
  });

  it("refuses a product link that is not an https address, so no page is fetched over plain HTTP", () => {
    expect(boardSchema.safeParse({ projectId, productLinks: ["http://shop.test/a"] }).success).toBe(false);
    expect(boardSchema.safeParse({ projectId, productLinks: ["data:text/html,<b>x</b>"] }).success).toBe(false);
  });

  it("refuses anything that is not a design", () => {
    expect(boardSchema.safeParse({ projectId: "not-a-design" }).success).toBe(false);
    expect(removeItemSchema.safeParse({ projectId, itemId: "nope" }).success).toBe(false);
  });

  it("tidies a steered tag to the word the database keeps, and takes only the two states", () => {
    expect(steerSchema.parse({ projectId, tag: "  Mock  NECK ", state: "pinned" }).tag).toBe("mock neck");
    expect(steerSchema.parse({ projectId, tag: "navy", state: null }).state).toBeNull();
    expect(steerSchema.safeParse({ projectId, tag: "navy", state: "starred" }).success).toBe(false);
  });

  it("names the card and the suggestion, and the version a change is against", () => {
    expect(saveItemSchema.parse({ projectId, cardId: "unsplash:1" }).cardId).toBe("unsplash:1");
    expect(suggestSchema.parse({ projectId, cardId: "unsplash:1" }).cardId).toBe("unsplash:1");
    expect(applySchema.parse({ projectId, expectedVersion: 2, suggestionId: "unsplash:1|{}", cardId: "unsplash:1" })).toMatchObject({ expectedVersion: 2 });
    expect(applySchema.safeParse({ projectId, expectedVersion: 0, suggestionId: "x", cardId: "y" }).success).toBe(false);
  });

  it("knows the same six sources the database and the panel know", () => {
    expect(sourceSchema.options).toEqual([...CARD_SOURCES]);
  });
});

describe("the ports, before the orchestrator wires them", () => {
  it("say nothing is known, so the board is shorter rather than broken", async () => {
    const ports = UNWIRED_INSPIRATION_PORTS;
    expect(await ports.articles.articleFor("team-jersey")).toBeNull();
    expect(await ports.mood.moodWordsFor("brand-1")).toEqual([]);
    expect(await ports.library.search("brand-1", { tags: [], text: "", removed: [] })).toEqual([]);
    const cards = [stubCard("unsplash", "1")];
    expect(await ports.screen.screen(cards)).toEqual(cards);
  });
});

describe("every road a picture takes into a design", () => {
  it("reads an image-fill layer's asset and a graphic layer's asset or file", () => {
    expect(pictureRefsOf(withStack(TILE_STACK)).every((ref) => ref.startsWith("image-fill:"))).toBe(true);
    expect(pictureRefsOf(withStack(PICTURE_STACK))).toEqual(["graphic:crest-1"]);
    expect(pictureRefsOf(withStack(GRAPHIC_STACK)).every((ref) => ref.startsWith("graphic:"))).toBe(true);
    expect(pictureRefsOf(withStack(ALL_KINDS_STACK)).length).toBeGreaterThan(1);
  });

  it("catches a layer added beside the same pictures", () => {
    const before = withStack(GRAPHIC_STACK);
    const after = { ...before, artworkStack: { ...before.artworkStack!, layers: before.artworkStack!.layers.slice(1) } };
    expect(pixelBreach(before, after, { kind: "swap-style", style: "fade" })).not.toBeNull();
  });

  it("lets a design with no stack at all through", () => {
    expect(pixelBreach(jersey(), jersey(), { kind: "swap-style", style: "fade" })).toBeNull();
  });
});

describe("the odd corners of the words", () => {
  it("names a source that was slow and one that faulted in two different sentences", () => {
    expect(slowSentence("Pexels")).not.toBe(faultSentence("Pexels"));
  });

  it("counts the tags an AI mood image was made from, in the singular and the plural", () => {
    expect(aiLabelOf({ tags: [{ text: "rugby", kind: "sport" }], text: "rugby", removed: [] })).toBe("AI mood image from 1 tag");
    expect(aiLabelOf({ tags: [], text: "", removed: [] })).toBe("AI mood image from 0 tags");
  });

  it("says a card with no picture has none, rather than showing a broken one", () => {
    expect(cardView(stubCard("link-preview", "1", { previewUrl: "" })).previewUrl).toBe("");
  });

  it("names the host when a product page gave no site name of its own", () => {
    const preview = previewFromHtml("<html><head><title>A top</title></head></html>");
    expect(previewCard("https://shop.test/a", preview!).attribution.provider).toBe("shop.test");
    expect(previewCard("not a url", preview!).attribution.provider).toBe("the source");
  });

  it("gives the style tags of a design whose type the registry does not know as none", () => {
    expect(styleTagsOf({ ...withPattern(), typeId: "no-such-type" })).toEqual(["hoops"]);
    expect(designContext({ ...jersey(), typeId: "no-such-type" }, { sports: [], articleName: null, moodWords: [] }).articleName).toBeNull();
  });
});

describe("the corners of the sources", () => {
  it("asks for a mood of sport and daylight when the design has no tags yet", () => {
    const empty = { tags: [], text: "   ", removed: [] };
    expect(moodPrompt(empty)).toContain("sport, movement, daylight");
    expect(moodCard(empty, "data:image/png;base64,AAAA").title).toBe("AI mood image: your design");
  });

  it("shows every pin of a chosen board when the design has no tags to match on", async () => {
    const answer = { items: [{ id: "9", media: { images: { "150x150": { url: "https://i.pinimg.test/9.jpg" } } } }] };
    const cards = await pinterestProvider({ accessToken: "t", boardIds: ["b"] }, stubFetch({ "https://api.pinterest.com": answer })).search({ tags: [], text: "", removed: [] });
    expect(cards.map((card) => card.title)).toEqual(["A pin"]);
  });

  it("names Unsplash and Pexels without a link to the photographer when the API gave none", async () => {
    const unsplash = {
      results: [{ id: "a", alt_description: "navy", urls: { small: "https://i.unsplash.test/a.jpg" }, links: { html: "https://unsplash.test/a" }, user: { name: "Ada" } }],
    };
    const cards = await unsplashProvider("k", stubFetch({ "https://api.unsplash.com": unsplash })).search({ tags: [], text: "navy", removed: [] });
    expect(cards[0]?.attribution.creatorUrl).toBeNull();
    const pexels = { photos: [{ id: 1, alt: "gold", url: "https://pexels.test/1", src: { medium: "https://i.pexels.test/1.jpg" }, photographer: "Bo" }] };
    const others = await pexelsProvider("k", stubFetch({ "https://api.pexels.com": pexels })).search({ tags: [], text: "gold", removed: [] });
    expect(others[0]?.attribution.creatorUrl).toBeNull();
  });

  it("reads past a meta tag with no content of its own, and leaves an unknown entity alone", () => {
    expect(previewFromHtml('<html><head><meta property="og:title"><title>A &plusmn; top</title></head></html>')).toMatchObject({ title: "A &plusmn; top" });
    expect(previewFromHtml('<html><head><meta property="og:title" content="   "><title>A top</title></head></html>')).toMatchObject({ title: "A top" });
  });

  it("gives nothing for a page whose fetch answered with no words at all", async () => {
    expect(await fetchPreview("https://shop.test/pro", stubFetch({ "https://shop.test": "" }, 200, "text/html"))).toBeNull();
  });
});
