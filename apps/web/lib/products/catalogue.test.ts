import { describe, expect, it } from "vitest";
import { colourCount, isEco, PRO_NOT_SET, productCard, productCards, sizeSpan } from "./cards";
import { categoriesOf, findCategory, inCategory, subCategoriesOf } from "./categories";
import { categoryView, PER_PAGE, UNAVAILABLE_FILTERS } from "./category";
import { colours, context, fabrics, source, summaries } from "./fixtures/data";
import { discoverLinks, faqs, homeRows, longestLeadTime } from "./home";
import { categoryHref, PRODUCTS_TABS, productHref, readSlug } from "./routes";

/** Plan v6 P4 (decision 0142): the catalogue home, its cards and the category page, read from the rows. */

const all = summaries();
const jersey = all.find((one) => one.code === "JSY-SS-01")!;

describe("the addresses", () => {
  it("reads a product code in any case and a category word, and nothing else", () => {
    expect(readSlug("JSY-SS-01")).toEqual({ kind: "product", code: "JSY-SS-01" });
    expect(readSlug("jsy-ss-01")).toEqual({ kind: "product", code: "JSY-SS-01" });
    expect(readSlug("football")).toEqual({ kind: "category", slug: "football" });
    expect(readSlug("Football!")).toBeNull();
    expect(readSlug("%E0%A4%A")).toBeNull();
  });

  it("builds product and category addresses, keeping a category's filters", () => {
    expect(productHref("JSY-SS-01")).toBe("/products/JSY-SS-01");
    expect(categoryHref("football")).toBe("/products/football");
    expect(categoryHref("all", { articleType: "JSY" })).toBe("/products/all?articleType=JSY");
    expect(PRODUCTS_TABS.map((tab) => tab.label)).toEqual(["Catalogue", "My products", "Trending ideas", "Fabrics"]);
  });
});

describe("a product card", () => {
  it("shows the worked article's price from its tier, its class, its sizes and who makes it", () => {
    const card = productCard(jersey, context());
    expect(card.href).toBe("/products/JSY-SS-01");
    expect(card.maker).toBe("By Knitwright · Sialkot");
    expect(card.price.line).toBe("From £22.00 · from 1 pc");
    expect(card.classTag).toBe("Class A");
    expect(card.spread).toBe("XS–3XL · colours not set yet");
    expect(card.badge).toBeNull();
  });

  it("never invents a Studio Pro price or a price for a base with no tier", () => {
    const shorts = productCard(all.find((one) => one.code === "SHO-TR-01")!, context({ factoryCity: null }));
    expect(shorts.proPrice).toBe(PRO_NOT_SET);
    expect(shorts.price.priced).toBe(false);
    expect(shorts.price.line).toBe("No GBP price is set yet");
    expect(shorts.maker).toBe("By Knitwright");
    expect(shorts.spread).toBe("Sizes not set yet · colours not set yet");
  });

  it("counts stock colours and marks Eco only from the fabric programme's own columns", () => {
    expect(colourCount(["F-STK-TEE"], colours())).toBe(1);
    expect(colourCount(["F-POLY-INT"], colours())).toBeNull();
    expect(isEco(["F-POLY-INT"], fabrics())).toBe(false);
    const eco = fabrics().map((fabric) => ({ ...fabric, pfasFree: true }));
    expect(isEco(["F-POLY-INT"], eco)).toBe(true);
    expect(productCard(jersey, context({ fabrics: eco })).badge).toEqual({ label: "Eco", tone: "ok" });
    const tee = productCard(all.find((one) => one.code === "TEE-TR-01")!, context());
    expect(tee.spread).toBe("Sizes not set yet · 1 colour");
    expect(productCards(all, context())).toHaveLength(all.length);
  });

  it("writes a size span", () => {
    expect(sizeSpan([])).toBeNull();
    expect(sizeSpan(["M"])).toBe("M");
    expect(sizeSpan(["S", "M", "L"])).toBe("S–L");
  });
});

describe("the categories", () => {
  it("are the sports the articles carry, most articles first, plus All products", () => {
    const categories = categoriesOf(all);
    expect(categories[0]).toEqual({ slug: "training", label: "Training", count: 3 });
    expect(categories.map((one) => one.slug)).toContain("cricket");
    expect(findCategory(all, "all")).toEqual({ slug: "all", label: "All products", count: all.length });
    expect(findCategory(all, "cricket")?.count).toBe(1);
    expect(findCategory(all, "curling")).toBeNull();
  });

  it("keeps a category's articles and lists their types as chips", () => {
    expect(inCategory(all, "all")).toHaveLength(all.length);
    expect(inCategory(all, "football").map((one) => one.code)).toEqual(["JSY-SS-01", "SHO-TR-01"]);
    expect(subCategoriesOf(inCategory(all, "football")).map((sub) => sub.type)).toEqual(["JSY", "SHO"]);
  });
});

describe("the category page", () => {
  it("filters by the bar, by type and by search, and keeps the choices for the pager", () => {
    const view = categoryView(all, "all", { productionClass: "B", sort: "code" });
    expect(view.total).toBe(2);
    expect(view.articles.map((one) => one.code)).toEqual(["HOD-ST-01", "TEE-TR-01"]);
    expect(view.keep).toEqual({ productionClass: "B", sort: "code" });
    expect(view.bar.find((group) => group.key === "productionClass")?.chosen).toBe("B");
    expect(view.bar.map((group) => group.key)).not.toContain("articleType");
    expect(categoryView(all, "all", { articleType: "JSY" }).articleType).toBe("JSY");
    expect(categoryView(all, "all", { q: "hoodie" }).keep).toEqual({ q: "hoodie" });
  });

  it("pages at sixteen and holds an out-of-range page to the last one", () => {
    const view = categoryView(all, "all", { page: "9" });
    expect(PER_PAGE).toBe(16);
    expect(view.page).toBe(1);
    expect(view.totalPages).toBe(1);
  });

  it("names the two filters no row can back yet, with the reason", () => {
    expect(UNAVAILABLE_FILTERS.map((filter) => filter.label)).toEqual(["Decoration", "Price"]);
  });
});

describe("the catalogue home", () => {
  it("fills its rows from the rows: teamwear picks, bases from one piece, and eco fabrics", () => {
    const rows = homeRows(all, source, fabrics());
    expect(rows.topPicks).toHaveLength(4);
    expect(rows.onePiece.map((one) => one.code)).toEqual(["JSY-SS-01"]);
    expect(rows.eco).toEqual([]);
    expect(discoverLinks(all)[0]).toEqual({ label: "Compression", href: "/products/all?articleType=CMP" });
  });

  it("answers its questions from the rows, and says what nobody has agreed", () => {
    const answers = faqs({ articles: all, source, leadTimeDays: 8, qcDays: null, freightDays: 4 });
    expect(answers[0]!.answer).toMatch(/^From 1 piece, on 1 of 8 bases\./);
    expect(answers[1]!.answer).toBe("Making takes up to 8 working days from the weekly cut-off. No delivery date is promised yet. Not set: the days for QC.");
    expect(answers[2]!.answer).toContain("Not yet. Every price shown carries the label of the row it comes from");
    const none = faqs({ articles: all, source: () => ({ ladder: [], moq: null }), leadTimeDays: null, qcDays: null, freightDays: null });
    expect(none[0]!.answer).toBe("Not set yet: no factory has agreed a minimum order for any base.");
    expect(none[1]!.answer).toContain("Not set: the factory's lead time, the days for QC and the freight days.");
    expect(none[2]!.answer).toContain("No base has a price yet.");
    const set = faqs({ articles: all, source, leadTimeDays: 8, qcDays: 2, freightDays: 4 });
    expect(set[1]!.answer).toContain("QC takes 2 working days and UK freight 4 days.");
  });

  it("finds the longest lead time on file", () => {
    expect(longestLeadTime(all, (code) => (code === "JSY-SS-01" ? 8 : code === "SHO-TR-01" ? 10 : null))).toBe(10);
    expect(longestLeadTime(all, () => null)).toBeNull();
  });
});
