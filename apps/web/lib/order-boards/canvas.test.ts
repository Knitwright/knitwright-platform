import { describe, expect, it } from "vitest";
import type { GarmentPreview } from "@/lib/canvas/types";
import { board, link } from "@/lib/launch/fixtures/canvas";
import { quoteQuerySchema } from "@/lib/quotes/download";
import {
  artboardsOf,
  checklistLabel,
  designFor,
  designOfBoard,
  designsOf,
  garmentOutputs,
  linkedDesignOf,
  orderGate,
  QUOTE_SPORTS,
  quoteLink,
  sharedFigure,
} from "./canvas";

const D1 = "00000000-0000-4000-8000-0000000000d1";
const D2 = "00000000-0000-4000-8000-0000000000d2";

const preview = (id: string, name: string, passed: boolean | null): GarmentPreview => ({
  designProjectId: id,
  name,
  version: 4,
  src: null,
  alt: name,
  checks: passed === null ? null : { passed, count: passed ? 0 : 2 },
});

const graph = {
  boards: [
    board("g1", "garment", { settings: { designProjectId: D1 } }),
    board("g2", "garment", { settings: { designProjectId: D2 } }),
    board("g3", "garment", { settings: { designProjectId: D1 } }),
    board("t1", "tech_pack"),
    board("o1", "order"),
    board("o2", "order"),
    board("m1", "mockup", { name: "Flat lay", size: { width: 1080, height: 1350 } }),
    board("a1", "artboard", { name: "Story", size: { width: 1080, height: 1920 } }),
    board("x1", "design", { settings: { designProjectId: 7 } }),
  ],
  edges: [link("e1", "g2", "t1"), link("e2", "m1", "o1"), link("e3", "g1", "o1"), link("e4", "x1", "o2")],
};
const garments = { [D1]: preview(D1, "Home kit", true), [D2]: preview(D2, "Away kit", null) };

describe("which design a board stands for", () => {
  it("reads a garment board's design and nothing else", () => {
    expect(designOfBoard(graph.boards[0])).toBe(D1);
    expect(designOfBoard(graph.boards[6])).toBeNull();
    expect(designOfBoard(graph.boards[8])).toBeNull();
    expect(designOfBoard(undefined)).toBeNull();
  });

  it("follows a tech pack or an order to the garment connected into it", () => {
    expect(linkedDesignOf(graph, graph.boards[3]!)).toBe(D2);
    expect(linkedDesignOf(graph, graph.boards[4]!)).toBe(D1);
    expect(linkedDesignOf(graph, graph.boards[5]!)).toBeNull();
  });

  it("lists each readable design once, in board order", () => {
    expect(designsOf(graph, garments)).toEqual([
      { id: D1, name: "Home kit", version: 4, passed: true },
      { id: D2, name: "Away kit", version: 4, passed: null },
    ]);
    expect(designsOf(graph, { [D1]: null })).toEqual([]);
  });

  it("acts on the selected garment, the garment behind a selected linked board, else the first design", () => {
    const designs = designsOf(graph, garments);
    expect(designFor(graph, "g2", designs)?.id).toBe(D2);
    expect(designFor(graph, "t1", designs)?.id).toBe(D2);
    expect(designFor(graph, "m1", designs)?.id).toBe(D1);
    expect(designFor(graph, null, designs)?.id).toBe(D1);
    expect(designFor(graph, null, [])).toBeNull();
  });
});

describe("the Order button's early word", () => {
  it("opens only for a design whose last checks passed, and says why otherwise", () => {
    expect(orderGate({ id: D1, name: "Home kit", version: 1, passed: true })).toEqual({ open: true });
    expect(orderGate({ id: D1, name: "Home kit", version: 1, passed: false })).toEqual({ open: false, reason: "Home kit has checks to fix before it can be ordered." });
    expect(orderGate({ id: D1, name: "Home kit", version: 1, passed: null })).toEqual({ open: false, reason: "Run the checks on Home kit in the editor first." });
    expect(orderGate(null)).toMatchObject({ open: false, reason: expect.stringMatching(/garment board/) });
  });
});

describe("the Export popover", () => {
  it("lists every board but garments and their linked boards", () => {
    expect(artboardsOf(graph.boards).map((one) => one.id)).toEqual(["m1", "a1"]);
  });

  it("labels the checklist and the shared size", () => {
    expect(checklistLabel(5, 5)).toBe("All artboards (5)");
    expect(checklistLabel(2, 5)).toBe("Selected artboards (2)");
    expect(checklistLabel(0, 0)).toBe("Selected artboards (0)");
    expect(sharedFigure([1080, 1080])).toBe("1080");
    expect(sharedFigure([1080, 1920])).toBe("Mix");
    expect(sharedFigure([])).toBe("");
  });

  it("offers the tech pack and the production package of the design at its version", () => {
    const outputs = garmentOutputs({ id: D1, name: "Home kit", version: 4, passed: true });
    expect(outputs.map((one) => one.href)).toEqual([
      `/api/projects/${D1}/exports/pdf?version=4`,
      `/api/projects/${D1}/exports/xlsx?version=4`,
      `/api/projects/${D1}/production-package`,
    ]);
  });
});

describe("the quote link", () => {
  it("is an address the quote route reads back to the same basket", () => {
    const href = quoteLink({ sportId: "football", currency: "GBP", articleCode: "JSY-SS-01", pieces: 20, names: true });
    expect(href).not.toBeNull();
    const query = Object.fromEntries(new URL(href!, "https://x.test").searchParams);
    const parsed = quoteQuerySchema.parse(query);
    expect(parsed).toMatchObject({ sport: "football", market: "GBP", names: true, lines: [{ articleCode: "JSY-SS-01", qty: 20 }] });
    expect(quoteLink({ sportId: "rugby", currency: "AUD", articleCode: "JSY-SS-01", pieces: 1, names: false })).not.toContain("names");
  });

  it("is none without a catalogue article or with a count the quote does not take", () => {
    const base = { sportId: "football", currency: "GBP", names: false };
    expect(quoteLink({ ...base, articleCode: null, pieces: 5 })).toBeNull();
    expect(quoteLink({ ...base, articleCode: "crew-tee", pieces: 5 })).toBeNull();
    expect(quoteLink({ ...base, articleCode: "JSY-SS-01", pieces: 0 })).toBeNull();
    expect(quoteLink({ ...base, articleCode: "JSY-SS-01", pieces: 1.5 })).toBeNull();
    expect(quoteLink({ ...base, articleCode: "JSY-SS-01", pieces: 100_000 })).toBeNull();
  });

  it("offers the sports the quote knows", () => {
    expect(QUOTE_SPORTS.length).toBeGreaterThan(0);
    for (const sport of QUOTE_SPORTS) expect(quoteQuerySchema.safeParse({ sport: sport.id, market: "GBP" }).success).toBe(true);
  });
});
