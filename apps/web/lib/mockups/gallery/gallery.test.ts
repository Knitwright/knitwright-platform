import { describe, expect, it } from "vitest";
import { ALL_MOCKUP_SCENES } from "../scenes";
import { categoryFromQuery, inCategory, MOCKUP_CATEGORIES, MOCKUP_CATEGORY_LABELS } from "./categories";
import {
  AI_DOWNLOAD,
  AI_LINE,
  CHART_DOWNLOAD,
  cardOf,
  cardsFor,
  colourwayFromQuery,
  designFromQuery,
  DOWNLOAD_LIMIT,
  downloadable,
  downloadHref,
  FREE_LINE,
  mockupsHref,
  NO_DRAWING_LINE,
} from "./cards";
import { NO_DRAWING_LINE as RENDERER_LINE } from "../garment";

const scene = (slug: string) => ALL_MOCKUP_SCENES.find((one) => one.slug === slug)!;
const slugsOf = (category: (typeof MOCKUP_CATEGORIES)[number]) => cardsFor(ALL_MOCKUP_SCENES, category).map((card) => card.slug);

describe("the mockup categories", () => {
  it("files the free product shots by how the garment is held", () => {
    expect(slugsOf("renders")).toEqual(["product-front", "product-back", "product-three-quarter", "product-side", "turntable-360"]);
    expect(slugsOf("flat-lay")).toEqual(["flat-lay-white", "flat-lay-grass", "folded-stack"]);
    expect(slugsOf("hanger")).toContain("hanger-on-wall");
    expect(slugsOf("ghost")).toEqual(["ghost-mannequin", "ecommerce-white-square", "ecommerce-white-four-five"]);
  });

  it("files the scenes of a sport under its own group, and every scene under All", () => {
    expect(slugsOf("teamwear")).toContain("floodlit-pitch");
    expect(slugsOf("combat")).toEqual(["cage-corner", "dojo-mat"]);
    expect(slugsOf("e-commerce")).toContain("size-chart-card");
    expect(slugsOf("all")).toHaveLength(ALL_MOCKUP_SCENES.length);
    for (const category of MOCKUP_CATEGORIES) expect(MOCKUP_CATEGORY_LABELS[category]).toBeTruthy();
  });

  it("puts every scene somewhere other than All", () => {
    for (const one of ALL_MOCKUP_SCENES) expect(MOCKUP_CATEGORIES.some((category) => category !== "all" && inCategory(one, category))).toBe(true);
  });

  it("reads a category from the address", () => {
    expect(categoryFromQuery("ghost")).toBe("ghost");
    expect(categoryFromQuery(["hanger"])).toBe("hanger");
    expect(categoryFromQuery("x")).toBe("all");
  });
});

describe("the mockup cards", () => {
  it("says the renderer's own sentence when a garment cannot be drawn", () => {
    expect(NO_DRAWING_LINE).toBe(RENDERER_LINE);
  });

  it("marks a free scene free and lets it be downloaded", () => {
    const card = cardOf(scene("product-back"));
    expect(card).toMatchObject({ line: FREE_LINE, premium: false, view: "back", cannotDownload: null, chart: null });
    expect(card.backdrop.from).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("crowns an AI scene and sends it to a canvas instead of a download", () => {
    expect(cardOf(scene("floodlit-pitch"))).toMatchObject({ line: AI_LINE, premium: true, cannotDownload: AI_DOWNLOAD });
    expect(downloadable(scene("floodlit-pitch"))).toBe(false);
  });

  it("sends a chart card to a canvas, where the measurements are", () => {
    expect(cardOf(scene("size-chart-card"))).toMatchObject({ chart: "size-chart", cannotDownload: CHART_DOWNLOAD });
    expect(downloadable(scene("size-chart-card"))).toBe(false);
    expect(downloadable(scene("hanger-on-wall"))).toBe(true);
  });

  it("writes the download address, held to its limit", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(downloadHref(id, null, ["product-front"])).toBe(`/api/mockups/download?design=${id}&scene=product-front`);
    expect(downloadHref(id, "home", ["a", "b"])).toBe(`/api/mockups/download?design=${id}&colourway=home&scene=a&scene=b`);
    const many = Array.from({ length: DOWNLOAD_LIMIT + 4 }, (_, at) => `s${at}`);
    expect(new URL(downloadHref(id, null, many), "http://x").searchParams.getAll("scene")).toHaveLength(DOWNLOAD_LIMIT);
  });

  it("reads only a well-formed design and colourway from the address", () => {
    expect(designFromQuery("00000000-0000-4000-8000-000000000001")).toBe("00000000-0000-4000-8000-000000000001");
    expect(designFromQuery("../x")).toBeNull();
    expect(designFromQuery(undefined)).toBeNull();
    expect(colourwayFromQuery(["away"])).toBe("away");
    expect(colourwayFromQuery("<b>")).toBeNull();
  });

  it("keeps the other settings in the page's address", () => {
    expect(mockupsHref({ design: null, colourway: null, category: "all" })).toBe("/mockups");
    expect(mockupsHref({ design: "d", colourway: "c", category: "ghost" })).toBe("/mockups?design=d&colourway=c&cat=ghost");
  });
});
