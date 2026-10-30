import { describe, expect, it } from "vitest";
import { stubImageProvider, failingImageProvider } from "@/lib/providers/image-stub";
import { countingMeter } from "../fixtures/meter";
import type { ContextQuery } from "../types";
import { AI_MOOD_LABEL } from "../vocabulary";
import { ALLOWANCE_USED_UP, MOOD_IMAGE_COST_MICRODOLLARS, aiMoodProvider, moodPrompt } from "./ai-mood";
import { pinterestOn, pinterestProvider, searchLinks } from "./external";
import { libraryProvider, scoreItem } from "./library";
import { fetchPreview, previewCard, previewFromHtml, previewUrlSchema, linkPreviewProvider } from "./link-preview";
import { pexelsProvider, unsplashProvider } from "./stock";
import { stubFetch } from "./stubs";
import type { LibraryItem, LibraryReader } from "../ports";

/**
 * The six sources of F-S1. Every one is an interface with a deterministic stand-in, so no test here reaches the
 * network or a paid model: the real adapters are driven by a fetch the test supplies.
 */

const query = (text: string): ContextQuery => ({ tags: text.split(" ").map((word) => ({ text: word, kind: "sport" as const })), text, removed: [] });

describe("Unsplash", () => {
  const answer = {
    results: [
      {
        id: "abc",
        description: "A rugby player in navy",
        alt_description: "navy kit",
        urls: { small: "https://images.unsplash.test/abc.jpg" },
        links: { html: "https://unsplash.test/photos/abc" },
        user: { name: "Ada Photographer", links: { html: "https://unsplash.test/@ada" } },
      },
    ],
  };

  it("searches with the context query and hotlinks the address the API gave", async () => {
    const fetcher = stubFetch({ "https://api.unsplash.com/search/photos": answer });
    const cards = await unsplashProvider("key-123", fetcher).search(query("rugby navy"));
    expect(fetcher.calls[0]).toContain("query=rugby%20navy");
    expect(cards[0]?.previewUrl).toBe("https://images.unsplash.test/abc.jpg");
  });

  it("names the photographer and Unsplash, and adds the referral marks their terms ask for", async () => {
    const cards = await unsplashProvider("key-123", stubFetch({ "https://api.unsplash.com": answer })).search(query("rugby"));
    expect(cards[0]?.attribution).toEqual({
      creator: "Ada Photographer",
      creatorUrl: "https://unsplash.test/@ada?utm_source=knitwright&utm_medium=referral",
      provider: "Unsplash",
      providerUrl: "https://unsplash.com/?utm_source=knitwright&utm_medium=referral",
      notice: "Photo by Ada Photographer on Unsplash",
    });
    expect(cards[0]?.openUrl).toBe("https://unsplash.test/photos/abc?utm_source=knitwright&utm_medium=referral");
    expect(cards[0]?.sourceLabel).toBe("Unsplash");
    expect(cards[0]?.owned).toBe(false);
  });

  it("asks for nothing when the query is empty, and shows nothing for a reply it cannot read", async () => {
    const empty = stubFetch({ "https://api.unsplash.com": answer });
    expect(await unsplashProvider("key", empty).search(query(""))).toEqual([]);
    expect(empty.calls).toEqual([]);
    expect(await unsplashProvider("key", stubFetch({ "https://api.unsplash.com": { results: [{ id: 1 }] } })).search(query("rugby"))).toEqual([]);
    expect(await unsplashProvider("key", stubFetch({}, 500)).search(query("rugby"))).toEqual([]);
  });

  it("shows nothing for a photo whose addresses are not https", async () => {
    const plain = { results: [{ ...answer.results[0], urls: { small: "http://images.unsplash.test/abc.jpg" } }] };
    expect(await unsplashProvider("key", stubFetch({ "https://api.unsplash.com": plain })).search(query("rugby"))).toEqual([]);
  });
});

describe("Pexels", () => {
  const answer = {
    photos: [
      {
        id: 7788,
        alt: "A sprinter in gold",
        url: "https://pexels.test/photo/7788",
        src: { medium: "https://images.pexels.test/7788.jpg" },
        photographer: "Bo Shooter",
        photographer_url: "https://pexels.test/@bo",
      },
    ],
  };

  it("searches with the context query, hotlinks the picture and names the photographer", async () => {
    const fetcher = stubFetch({ "https://api.pexels.com/v1/search": answer });
    const cards = await pexelsProvider("pex-key", fetcher).search(query("sprint gold"));
    expect(fetcher.calls[0]).toContain("query=sprint%20gold");
    expect(cards[0]).toMatchObject({
      id: "pexels:7788",
      title: "A sprinter in gold",
      openUrl: "https://pexels.test/photo/7788",
      previewUrl: "https://images.pexels.test/7788.jpg",
      sourceLabel: "Pexels",
    });
    expect(cards[0]?.attribution.notice).toBe("Photo by Bo Shooter on Pexels");
  });

  it("says a stock photo with no words of its own is one, rather than leaving the card unnamed", async () => {
    const unnamed = { photos: [{ ...answer.photos[0], alt: "" }] };
    const cards = await pexelsProvider("pex-key", stubFetch({ "https://api.pexels.com": unnamed })).search(query("sprint"));
    expect(cards[0]?.title).toBe("A stock photo");
  });

  it("shows nothing for an empty query or a reply it cannot read", async () => {
    expect(await pexelsProvider("k", stubFetch({ "https://api.pexels.com": answer })).search(query(""))).toEqual([]);
    expect(await pexelsProvider("k", stubFetch({ "https://api.pexels.com": { photos: "no" } })).search(query("x"))).toEqual([]);
  });
});

describe("the Knitwright library", () => {
  const item = (id: string, tags: readonly string[]): LibraryItem => ({
    id,
    title: `Template ${id}`,
    openUrl: `https://knitwright.test/templates/${id}`,
    previewUrl: `https://knitwright.test/templates/${id}.png`,
    tags: [...tags],
    kindLabel: "Template",
  });
  const reader = (items: readonly LibraryItem[]): LibraryReader => ({ search: async () => items });

  it("counts the tags an item shares with the query", () => {
    expect(scoreItem(["rugby", "navy"], query("rugby navy gold"))).toBe(2);
    expect(scoreItem(["hockey"], query("rugby"))).toBe(0);
  });

  it("keeps only the items that match, best first, and marks them as Knitwright's own", async () => {
    const cards = await libraryProvider(reader([item("b", ["rugby"]), item("a", ["rugby", "navy"]), item("c", ["hockey"])]), "brand-1").search(query("rugby navy"));
    expect(cards.map((card) => card.id)).toEqual(["library:a", "library:b"]);
    expect(cards[0]?.owned).toBe(true);
    expect(cards[0]?.attribution).toEqual({ creator: null, creatorUrl: null, provider: "Knitwright", providerUrl: null, notice: "Template from the Knitwright library" });
  });

  it("gives the same order for the same board twice", async () => {
    const items = [item("b", ["rugby"]), item("a", ["rugby"])];
    const first = await libraryProvider(reader(items), "brand-1").search(query("rugby"));
    const second = await libraryProvider(reader(items), "brand-1").search(query("rugby"));
    expect(first.map((card) => card.id)).toEqual(second.map((card) => card.id));
    expect(first.map((card) => card.id)).toEqual(["library:a", "library:b"]);
  });
});

describe("a product link", () => {
  const page = [
    "<html><head>",
    '<meta property="og:title" content="Pro Compression Top &amp; Shorts">',
    '<meta property="og:image" content="https://shop.test/pro.jpg">',
    '<meta property="product:price:amount" content="54.00">',
    '<meta property="product:price:currency" content="GBP">',
    '<meta property="og:site_name" content="Shop Test">',
    "</head><body>a very long page body</body></html>",
  ].join("");

  it("reads the Open Graph title, picture, price and site out of the page", () => {
    expect(previewFromHtml(page)).toEqual({ title: "Pro Compression Top & Shorts", previewUrl: "https://shop.test/pro.jpg", price: "54.00 GBP", siteName: "Shop Test" });
  });

  it("falls back to the page's own title, and keeps no picture that is not https", () => {
    expect(previewFromHtml('<html><head><title>  A plain page </title><meta property="og:image" content="http://shop.test/a.jpg"></head></html>')).toEqual({
      title: "A plain page",
      previewUrl: null,
      price: null,
      siteName: null,
    });
  });

  it("gives nothing for a page with no title at all", () => {
    expect(previewFromHtml("<html><body>nothing</body></html>")).toBeNull();
  });

  it("shows the price on the card, says it is never artwork, and opens the source", () => {
    const made = previewCard("https://shop.test/pro", previewFromHtml(page)!);
    expect(made.title).toBe("Pro Compression Top & Shorts — 54.00 GBP");
    expect(made.openUrl).toBe("https://shop.test/pro");
    expect(made.attribution.notice).toBe("From Shop Test. Shown as a link, never used as artwork.");
  });

  it("fetches the page once, logged out, with Knitwright's own user agent", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const fetcher = async (url: string, init?: RequestInit): Promise<Response> => {
      seen.push({ url, init: init ?? {} });
      return new Response(page, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
    };
    const preview = await fetchPreview("https://shop.test/pro", fetcher);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe("https://shop.test/pro");
    expect(seen[0]?.init.headers).toMatchObject({ "User-Agent": "KnitwrightInspiration/1.0 (+https://knitwright.com/bot)" });
    expect(seen[0]?.init).not.toHaveProperty("credentials");
    expect(preview?.title).toBe("Pro Compression Top & Shorts");
  });

  it("reads nothing from an address that is not https, a page that is not HTML, or a fetch that fails", async () => {
    expect(previewUrlSchema.safeParse("http://shop.test/pro").success).toBe(false);
    expect(await fetchPreview("ftp://shop.test/pro", stubFetch({}))).toBeNull();
    expect(await fetchPreview("https://shop.test/pro", stubFetch({ "https://shop.test": "{}" }))).toBeNull();
    expect(await fetchPreview("https://shop.test/pro", stubFetch({}, 500))).toBeNull();
    expect(
      await fetchPreview("https://shop.test/pro", async () => {
        throw new Error("no network");
      }),
    ).toBeNull();
  });

  it("makes one card per link that gave a preview, and leaves the others out", async () => {
    const fetcher = stubFetch({ "https://shop.test/pro": page, "https://shop.test/none": "<html></html>" }, 200, "text/html");
    const cards = await linkPreviewProvider(["https://shop.test/pro", "https://shop.test/none"], fetcher).search(query("x"));
    expect(cards.map((card) => card.openUrl)).toEqual(["https://shop.test/pro"]);
  });
});

describe("the Behance and Pinterest buttons", () => {
  it("open the site with the context query, and the site's own search when there is none", () => {
    expect(searchLinks(query("rugby navy")).map((link) => link.url)).toEqual([
      "https://www.behance.net/search/projects?search=rugby%20navy",
      "https://www.pinterest.com/search/pins/?q=rugby%20navy",
    ]);
    expect(searchLinks(query("")).map((link) => link.url)).toEqual(["https://www.behance.net/search/projects", "https://www.pinterest.com/search/pins/"]);
  });
});

describe("a person's own Pinterest boards", () => {
  it("are off unless both the application id and the flag are set", () => {
    expect(pinterestOn({})).toBe(false);
    expect(pinterestOn({ PINTEREST_APP_ID: "app-1" })).toBe(false);
    expect(pinterestOn({ NEXT_PUBLIC_INSPIRATION_PINTEREST: "on" })).toBe(false);
    expect(pinterestOn({ PINTEREST_APP_ID: "app-1", NEXT_PUBLIC_INSPIRATION_PINTEREST: "on" })).toBe(true);
  });

  it("shows the pins of the chosen boards that match the query, each linking back to the pin", async () => {
    const answer = {
      items: [
        { id: "123", title: "Navy away kit", media: { images: { "150x150": { url: "https://i.pinimg.test/150/123.jpg" } } } },
        { id: "456", title: "A kitchen", media: { images: { "150x150": { url: "https://i.pinimg.test/150/456.jpg" } } } },
      ],
    };
    const fetcher = stubFetch({ "https://api.pinterest.com/v5/boards": answer });
    const cards = await pinterestProvider({ accessToken: "token", boardIds: ["board-1"] }, fetcher).search(query("navy"));
    expect(cards.map((card) => card.id)).toEqual(["pin:123"]);
    expect(cards[0]?.openUrl).toBe("https://www.pinterest.com/pin/123/");
    expect(cards[0]?.attribution.notice).toContain("link back");
  });

  it("shows nothing for a board that faults or a pin with no picture", async () => {
    expect(await pinterestProvider({ accessToken: "t", boardIds: ["b"] }, stubFetch({}, 500)).search(query("navy"))).toEqual([]);
    const noPicture = { items: [{ id: "1", title: "navy", media: { images: {} } }] };
    expect(await pinterestProvider({ accessToken: "t", boardIds: ["b"] }, stubFetch({ "https://api.pinterest.com": noPicture })).search(query("navy"))).toEqual([]);
  });
});

describe("an AI mood image", () => {
  it("asks for a mood photograph and never for a garment", () => {
    const prompt = moodPrompt(query("rugby navy"));
    expect(prompt).toContain("colour, light and texture only");
    expect(prompt).toContain("No garment, no clothing, no person, no logo and no text");
  });

  it("is labelled wherever it is shown, and says it is never saved", async () => {
    const paid = countingMeter();
    const cards = await aiMoodProvider(stubImageProvider(), paid, { brandId: "brand-1", userId: "user-1" }).search(query("rugby"));
    expect(cards[0]?.aiLabel).toBe(AI_MOOD_LABEL);
    expect(cards[0]?.title).toBe("AI mood image: rugby");
    expect(cards[0]?.previewUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(cards[0]?.unsaveable).toContain("not stored");
  });

  it("goes through the meter before the call, as a photoreal cost", async () => {
    const paid = countingMeter();
    await aiMoodProvider(stubImageProvider(), paid, { brandId: "brand-1", userId: "user-1" }).search(query("rugby"));
    expect(paid.reserved()).toBe(1);
    expect(MOOD_IMAGE_COST_MICRODOLLARS).toBeGreaterThan(0);
  });

  it("makes no call and says the allowance is used up when the meter refuses", async () => {
    const provider = stubImageProvider();
    await expect(aiMoodProvider(provider, countingMeter(false), { brandId: "b", userId: "u" }).search(query("rugby"))).rejects.toThrow(ALLOWANCE_USED_UP);
    expect(provider.requests).toHaveLength(0);
  });

  it("gives the cost back when the model fails", async () => {
    const paid = countingMeter();
    await expect(aiMoodProvider(failingImageProvider(), paid, { brandId: "b", userId: "u" }).search(query("rugby"))).rejects.toThrow();
    expect(paid.refunded()).toBe(1);
  });
});
