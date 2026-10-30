import { beforeAll, describe, expect, it } from "vitest";
import { listBaseArticles, getBaseArticle } from "@/lib/catalogue";
import { supabaseFactoryStore } from "@/lib/factory/store";
import { careNote, fabricCard, fitNotes, leadTime, NOT_SET, sizeChart } from "@/lib/home/article-view";
import { emptyGroupsNote, filterGroups, filtersFromQuery } from "@/lib/home/catalogue-filters";
import { articleCard } from "@/lib/home/catalogue-view";
import { fromPrice, ladderRows } from "@/lib/home/price";
import { priceBookOf, type PriceBook } from "@/lib/home/book";
import { adminClient, brandOf, person, type Person } from "./support";

/**
 * Plan v5 Y1 (decision 0074): the catalogue and the article page read against the real rows of
 * migrations 20261101010000 (base articles) and 20261101050000 (the factory model). The member
 * reads the articles with their own client, exactly as the page does; the prices come through the
 * server's own client, because no browser role reaches the factory tables at all.
 *
 * Written without local Supabase (the one database on the machine is shared with other agents, and
 * resetting it would destroy their work), so this file first runs in CI. Every helper, label and
 * column it names was read from the migrations and from base-articles.test.ts and factories.test.ts.
 */

let member: Person;
let book: PriceBook;

const store = () => supabaseFactoryStore(adminClient());

beforeAll(async () => {
  member = await person("y1-member");
  await brandOf(member, "Catalogue Home Club");
  book = await priceBookOf(store());
});

describe("the catalogue grid, from the rows a member can read", () => {
  it("lists the eight launch articles with their fabric codes, which the filter panel is built from", async () => {
    const summaries = await listBaseArticles(member.client);
    expect(summaries).toHaveLength(8);
    const groups = filterGroups(summaries);
    expect(groups.map((group) => group.key)).toEqual(["sport", "articleType", "fit", "productionClass", "fabric"]);
    expect(groups.find((group) => group.key === "productionClass")?.options).toEqual([
      { value: "A", label: "Class A", count: 6 },
      { value: "B", label: "Class B", count: 2 },
    ]);
    expect(emptyGroupsNote(summaries)).toMatch(/^Gender is not set on any base article yet/);
  });

  it("keeps a filter the rows really hold and drops one they do not", async () => {
    const summaries = await listBaseArticles(member.client);
    expect(filtersFromQuery({ sport: "cricket" }, summaries)).toEqual({ sport: "cricket" });
    expect(filtersFromQuery({ gender: "men", sport: "curling" }, summaries)).toEqual({});
  });

  it("shows the worked article's card as a draft with the build pack's cheapest price", async () => {
    const article = await getBaseArticle(member.client, "JSY-SS-01");
    const card = articleCard(article!, book.source("JSY-SS-01"), "GBP");
    expect(card.tags).toEqual([
      { label: "Class A", tone: "class" },
      { label: "Draft, not reviewed by a factory", tone: "status" },
    ]);
    expect(card.price.line).toBe("From £22.00 · from 1 pc");
    expect(card.price.label).toMatch(/not a factory quote/);
    expect(card.price.note).toBe("Priced from 10 pcs; no price is set for 1 pc yet.");
    expect(card.editableForm).toBe(true);
    expect(card.dataLabel).toBe("Knitwright draft v0.1, not reviewed by a factory");
  });

  it("shows no price for an article the factory has no capability for", async () => {
    const article = await getBaseArticle(member.client, "HOD-ST-01");
    const card = articleCard(article!, book.source("HOD-ST-01"), "GBP");
    expect(card.price.priced).toBe(false);
    expect(card.price.line).toBe("No GBP price is set yet");
    expect(card.editableForm).toBe(false);
  });
});

describe("the prices the server reads", () => {
  it("show a member nothing, so the card's price can only come from the server", async () => {
    for (const table of ["factories", "factory_capabilities", "price_tiers"]) {
      const { data } = await member.client.from(table).select("*");
      expect(data ?? [], table).toEqual([]);
    }
  });

  it("reads the one placeholder factory and the build pack's club ladder", () => {
    expect(book.factoryName).toBe("Sialkot partner (placeholder)");
    expect(book.source("JSY-SS-01").moq).toBe(1);
    expect(ladderRows(book.source("JSY-SS-01").ladder, "GBP")).toEqual([
      { quantity: "10-19", unit: "£29.00", priced: true, label: "Placeholder club price from the build pack, not a factory quote", ruleId: "R-COST-003" },
      { quantity: "20-49", unit: "£25.00", priced: true, label: "Placeholder club price from the build pack, not a factory quote", ruleId: "R-COST-003" },
      { quantity: "50+", unit: "£22.00", priced: true, label: "Placeholder club price from the build pack, not a factory quote", ruleId: "R-COST-003" },
    ]);
  });

  it("has no Australian price at all, and says so rather than converting one", () => {
    expect(fromPrice(book.source("JSY-SS-01"), "AUD").line).toBe("No AUD price is set yet · from 1 pc");
    for (const row of ladderRows(book.source("JSY-SS-01").ladder, "AUD")) expect(row.priced).toBe(false);
  });

  it("has a lead time for the two articles the factory makes and none for the rest", () => {
    expect(leadTime(book.capability("JSY-SS-01")).value).toBe("8 working days from the weekly cut-off, before QC and freight.");
    expect(leadTime(book.capability("SHO-TR-01")).value).toMatch(/^8 working days/);
    expect(leadTime(book.capability("HOD-ST-01")).value).toMatch(/No lead time is on file/);
    expect(leadTime(book.capability("HOD-ST-01")).ruleId).toBe("R-GAP-000");
  });
});

describe("the article page, from the rows", () => {
  it("joins the body fabric to the fabric programme and says the rib is not in it", async () => {
    const article = await getBaseArticle(member.client, "JSY-SS-01");
    const cards = article!.fabrics.map((fabric) => fabricCard(fabric, book.fabrics, book.colours));
    expect(cards.map((card) => card.code)).toEqual(["F-POLY-INT", "F-POLY-RIB"]);
    expect(cards[0]).toMatchObject({ name: "Polyester interlock", blend: "100% polyester", gsm: "140–160 g/m²", width: "180 cm", role: "Body" });
    expect(cards[0]!.label).toMatch(/Placeholder from the build pack/);
    expect(cards[1]!.note).toMatch(/not one of the fabric programme's rows/);
    expect(cards[1]!.blend).toBe(NOT_SET);
  });

  it("lists the stock colours of a Class B fabric on its card", async () => {
    const article = await getBaseArticle(member.client, "TEE-TR-01");
    const card = fabricCard(article!.fabrics[0]!, book.fabrics, book.colours);
    expect(card.code).toBe("F-STK-TEE");
    expect(card.colours.map((colour) => colour.name).sort()).toEqual(["Black", "Navy", "White"]);
  });

  it("shows the size chart with the sample size, and says when an article has none", async () => {
    const jersey = await getBaseArticle(member.client, "JSY-SS-01");
    const chart = sizeChart(jersey!);
    expect(chart.sizes).toEqual(["XS", "S", "M", "L", "XL", "2XL", "3XL"]);
    expect(chart.sampleSize).toBe("M");
    expect(chart.rows).toHaveLength(12);
    expect(chart.rows[0]).toMatchObject({ letter: "A", tolerance: "−10 / +10 mm", values: [460, 490, 520, 550, 580, 610, 640] });

    const shorts = await getBaseArticle(member.client, "SHO-TR-01");
    expect(sizeChart(shorts!).empty).toMatch(/no measurements on file/);
  });

  it("gives every fit note and the care wording a rule to explain it", async () => {
    const article = await getBaseArticle(member.client, "JSY-SS-01");
    const notes = [...fitNotes(article!), careNote()];
    for (const note of notes) expect(note.ruleId, note.label).toMatch(/^R-[A-Z]+-\d{3}$/);
    expect(notes.map((note) => note.label)).toEqual(["Cut", "Body length offset", "Sleeve length offset", "Back drop tail", "Care"]);
    expect(notes[1]!.value).toBe("-30 to 40 mm · Not yet sampled");
  });
});
