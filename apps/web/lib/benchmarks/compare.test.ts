import { describe, expect, it } from "vitest";
import { compareView, GRAPHICS_NOTE, TOO_FEW, TOO_MANY } from "./compare";
import { card, fromPhoto, runningShort, stored } from "./fixtures/cards";

/** The compare view (spec F-S2 step 5): 2 to 5 cards, a feature matrix, and complaint themes ranked by frequency. */

const two = () => [stored("a", runningShort()), stored("b", fromPhoto(), { sourceKind: "photo", sourceUrl: null, sourceHost: null })];

describe("compareView", () => {
  it("refuses one card: a comparison needs two", () => {
    const view = compareView([stored("a", runningShort())]);

    expect(view.refused).toBe(TOO_FEW);
    expect(view.rows).toEqual([]);
    expect(view.themes).toEqual([]);
  });

  it("refuses six cards and shows the first five, so the screen is never wider than the spec allows", () => {
    const view = compareView(["a", "b", "c", "d", "e", "f"].map((id) => stored(id, runningShort())));

    expect(view.refused).toBe(TOO_MANY);
    expect(view.columns).toHaveLength(5);
  });

  it("puts one column per card, headed by the product and saying where it came from", () => {
    const view = compareView(two());

    expect(view.refused).toBeNull();
    expect(view.columns.map((column) => column.heading)).toEqual(["Acme Speedshort 5in", "Zephyr long-sleeve"]);
    expect(view.columns.map((column) => column.source)).toEqual(["From example.test", "From your own photo"]);
  });

  it("heads a card with no product name honestly rather than inventing one", () => {
    const view = compareView([stored("a", card()), stored("b", runningShort())]);

    expect(view.columns[0]?.heading).toBe("Not named");
  });

  it("says when a card has been confirmed by a person", () => {
    const view = compareView([stored("a", runningShort(), { confirmedAt: "2026-10-30T00:00:00.000Z" }), stored("b", fromPhoto())]);

    expect(view.columns.map((column) => column.confirmed)).toEqual([true, false]);
  });

  it("marks every cell of the matrix with how that card knows the feature, or a dash", () => {
    const view = compareView(two());
    const hem = view.rows.find((row) => row.key === "bonded_hem");
    const neck = view.rows.find((row) => row.key === "mock_neck");

    expect(hem?.cells.map((cell) => cell.mark)).toEqual(["inf", "–"]);
    expect(neck?.cells.map((cell) => cell.mark)).toEqual(["–", "inf"]);
    expect(hem?.cells[1]).toEqual({ mark: "–", provenance: null });
  });

  it("leaves a competitor's logo, name and print out of the matrix, because nothing about them is carried over", () => {
    const view = compareView(two());

    expect(view.rows.map((row) => row.key)).not.toContain("all_over_print");
    expect(GRAPHICS_NOTE).toContain("never carried onto a design");
  });

  it("puts the functional features first, so what a factory can make is read first", () => {
    const withDecoration = card({
      features: [
        { key: "stripes", provenance: "observed" },
        { key: "side_split", provenance: "observed" },
      ],
    });
    const view = compareView([stored("a", withDecoration), stored("b", withDecoration)]);

    expect(view.rows.map((row) => row.key)).toEqual(["side_split", "stripes"]);
  });

  it("adds up the same theme across cards and ranks the themes by how often they came up", () => {
    const other = card({ complaintThemes: [{ theme: "The liner rides up", count: 9 }, { theme: "The waistband rolls", count: 14 }] });
    const view = compareView([stored("a", runningShort()), stored("b", other)]);

    expect(view.themes).toEqual([
      { theme: "The liner rides up", count: 40, cards: 2 },
      { theme: "The pocket bounces when running", count: 19, cards: 1 },
      { theme: "The waistband rolls", count: 14, cards: 1 },
    ]);
  });
});
