import { describe, expect, it } from "vitest";
import { FLOW_TEMPLATES } from "@/lib/flows/templates";
import { VIDEO_TEMPLATES } from "@/lib/media/video/social-frames";
import type { TemplateSummary } from "../filters";
import { designItem, matchesWords, packItem, socialItems, techpackItem, videoItem, withPicture, type FeedItem } from "./items";
import { discoverRows, feedView, filteredView, forYou, itemsOfTab, ROW_LIMIT, shownDesignIds } from "./rows";
import { isSportTab, searchFromQuery, sportTabsOf, tabFromQuery, tabHref, TEMPLATE_TABS, TEMPLATE_TAB_LABELS } from "./tabs";

const summary = (id: string, sport: TemplateSummary["sport"], over: Partial<TemplateSummary> = {}): TemplateSummary => ({
  id,
  slug: id,
  title: `Kit ${id}`,
  sport,
  articleId: "team-jersey",
  style: "plain",
  styleTags: ["plain"],
  colourFamily: "navy",
  reviewState: "not_reviewed",
  ...over,
});

const designs: readonly FeedItem[] = [
  designItem({ summary: summary("a", "football"), sportTags: ["football"] }),
  designItem({ summary: summary("b", "football"), sportTags: [] }),
  designItem({ summary: summary("c", "cricket"), sportTags: ["cricket"] }),
  designItem({ summary: summary("d", "general", { attribution: "Ada" }), sportTags: ["running-gym", "combat", "esports"] }),
  designItem({ summary: summary("e", "training"), sportTags: ["training"] }),
];

const social = socialItems([
  { slug: "order-your-kit-1", title: "Order your kit", group: "team-store", format: "social-square-1-1", layoutKey: "order-your-kit" },
  { slug: "order-your-kit-2", title: "Order your kit", group: "team-store", format: "story-9-16", layoutKey: "order-your-kit" },
  { slug: "matchday-1", title: "Matchday", group: "club-life", format: "story-9-16", layoutKey: "matchday" },
  { slug: "size-chart-image-1", title: "Size chart image", group: "e-commerce", format: "social-square-1-1", layoutKey: "size-chart-image" },
]);

const all: readonly FeedItem[] = [
  ...designs,
  ...FLOW_TEMPLATES.map(packItem),
  ...social,
  videoItem(VIDEO_TEMPLATES[0]!, "/studio/x?view=3d", null),
  videoItem(VIDEO_TEMPLATES[5]!, "/studio/x?view=3d", "Not yet."),
  techpackItem({ id: "t1", title: "Team jersey tech pack" }),
];

describe("the template tabs", () => {
  it("reads a tab and a search from the address, and falls back to Discover", () => {
    expect(tabFromQuery("cricket")).toBe("cricket");
    expect(tabFromQuery(["videos", "x"])).toBe("videos");
    expect(tabFromQuery("nonsense")).toBe("discover");
    expect(tabFromQuery(undefined)).toBe("discover");
    expect(searchFromQuery("  retro  ")).toBe("retro");
    expect(searchFromQuery(undefined)).toBe("");
    expect(searchFromQuery("x".repeat(200))).toHaveLength(80);
  });

  it("writes a tab's address, keeping the search", () => {
    expect(tabHref("discover")).toBe("/templates");
    expect(tabHref("football")).toBe("/templates?tab=football");
    expect(tabHref("discover", "hoops")).toBe("/templates?q=hoops");
  });

  it("labels every tab, and knows which are sports", () => {
    for (const tab of TEMPLATE_TABS) expect(TEMPLATE_TAB_LABELS[tab]).toBeTruthy();
    expect(isSportTab("gym")).toBe(true);
    expect(isSportTab("social")).toBe(false);
  });

  it("files running-gym under both Running and Gym, and reads the old sport column too", () => {
    expect(sportTabsOf(["running-gym"], "general")).toEqual(["running", "gym"]);
    expect(sportTabsOf([], "running")).toEqual(["running"]);
    expect(sportTabsOf(["combat", "esports"], "football")).toEqual(["football", "combat", "esports"]);
    expect(sportTabsOf([], "general")).toEqual([]);
  });
});

describe("the template cards", () => {
  it("credits Knitwright or the designer, and uses the design template's own action", () => {
    expect(designs[0]!.author).toBe("Knitwright");
    expect(designs[3]!.author).toBe("Ada");
    expect(designs[0]!.use).toEqual({ type: "design", templateId: "a" });
  });

  it("shows one social card per layout, opening a launch canvas on its first format", () => {
    expect(social.map((item) => item.title)).toEqual(["Order your kit", "Matchday", "Size chart image"]);
    expect(social[0]!.use).toEqual({ type: "launch", source: "marketing", slug: "order-your-kit-1" });
  });

  it("opens a flow pack on a launch canvas", () => {
    expect(packItem(FLOW_TEMPLATES[0]!).use).toEqual({ type: "launch", source: "flow", slug: FLOW_TEMPLATES[0]!.slug });
  });

  it("offers a video the platform draws, says why another waits, and crowns an AI clip", () => {
    const ready = videoItem(VIDEO_TEMPLATES[0]!, "/studio/x?view=3d", null);
    expect(ready.use).toEqual({ type: "link", href: "/studio/x?view=3d" });
    const clip = VIDEO_TEMPLATES.find((one) => one.source === "ai_clip")!;
    const waiting = videoItem(clip, "/s", "Waits.");
    expect(waiting.use).toEqual({ type: "unavailable", reason: "Waits." });
    expect(waiting.premium).toBe(true);
    expect(ready.premium).toBe(false);
  });

  it("starts a design from a tech pack template", () => {
    expect(techpackItem({ id: "t", title: "T" }).use).toEqual({ type: "link", href: "/studio/start" });
  });

  it("swaps in a drawing only when one was drawn", () => {
    const item = designs[0]!;
    expect(withPicture(item, null)).toBe(item);
    expect(withPicture(item, { src: "data:x", alt: "A kit" }).picture).toEqual({ type: "drawing", src: "data:x", alt: "A kit" });
  });

  it("matches every word typed, in any case", () => {
    expect(matchesWords(designs[3]!, "ADA kit")).toBe(true);
    expect(matchesWords(designs[3]!, "ada hoops")).toBe(false);
    expect(matchesWords(designs[3]!, "  ")).toBe(true);
  });
});

describe("the template rows", () => {
  it("leads For you with one design per sport", () => {
    expect(forYou(designs).map((item) => item.id)).toEqual(["a", "c", "d", "e", "b"]);
  });

  it("lists the Discover rows that have something in them, each with its tab", () => {
    const rows = discoverRows(all);
    expect(rows.map((row) => row.id)).toEqual(["for-you", "launch-packs", "team-store", "videos", "matchday", "size-charts", "football", "cricket", "training", "tech-packs"]);
    expect(rows.find((row) => row.id === "size-charts")!.items.map((item) => item.title)).toEqual(["Size chart image"]);
    expect(rows.find((row) => row.id === "football")!.more).toBe("football");
    expect(discoverRows(designs.slice(0, 1)).map((row) => row.id)).toEqual(["for-you", "football"]);
  });

  it("holds a row to its limit and keeps the full count", () => {
    const many = Array.from({ length: ROW_LIMIT + 3 }, (_, at) => designItem({ summary: summary(`m${at}`, "football"), sportTags: [] }));
    const first = discoverRows(many)[0]!;
    expect(first.items).toHaveLength(ROW_LIMIT);
    expect(first.total).toBe(ROW_LIMIT + 3);
  });

  it("shows one tab as a grid, and narrows it by the search", () => {
    expect(itemsOfTab(all, "gym").map((item) => item.id)).toEqual(["d"]);
    expect(itemsOfTab(all, "social")).toHaveLength(3);
    expect(itemsOfTab(all, "discover")).toBe(all);
    const view = feedView(all, "football", "");
    expect(view).toMatchObject({ layout: "grid", title: "Football" });
    const found = feedView(all, "discover", "matchday");
    expect(found.layout === "grid" && found.items.map((item) => item.title)).toEqual(["Matchday"]);
    expect(found.layout === "grid" && found.title).toBe('Results for "matchday"');
    expect(feedView(all, "discover", "").layout).toBe("rows");
  });

  it("keeps the older filter address working as one grid of designs", () => {
    const view = filteredView(all, new Set(["a", "c", "pack-x"]), "");
    expect(view.layout === "grid" && view.items.map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("draws only the designs a view shows", () => {
    expect(shownDesignIds(feedView(all, "cricket", ""))).toEqual(["c"]);
    expect(shownDesignIds(feedView(all, "discover", ""))).toEqual(["a", "c", "d", "e", "b"]);
  });
});
