import { describe, expect, it } from "vitest";
import { catalogue } from "@/lib/catalogue/fixtures/source";
import { allRows } from "@/lib/factory/fixtures/rows";
import { toCapability, toColour, toFabric } from "@/lib/factory/rows";
import { careNote, fabricCard, fitNotes, leadTime, NOT_SET, RENDER_NOTICE, sizeChart } from "./article-view";

/**
 * Decision 0074: the article page of spec F-S8. Every value comes from X1's article rows or X6's
 * fabric programme and capability; a value no row holds reads "Not set yet" and carries a rule id.
 * The pictures always say "Render, not photo": no sample has been photographed.
 */

const jersey = catalogue()[0]!;
const hoodie = catalogue().find((article) => article.code === "HOD-ST-01")!;
const programme = allRows.programme_fabrics.map(toFabric);
const colours = allRows.programme_fabric_colours.map(toColour);
const capabilities = allRows.factory_capabilities.map(toCapability);

describe("the pictures", () => {
  it("say they are a render and why there is no photograph", () => {
    expect(RENDER_NOTICE.label).toBe("Render, not photo");
    expect(RENDER_NOTICE.note).toMatch(/photographed/);
  });
});

describe("a fabric spec card", () => {
  it("joins the article's own row to the fabric programme's row", () => {
    const body = fabricCard(jersey.fabrics[0]!, programme, colours);
    expect(body.code).toBe("F-POLY-INT");
    expect(body.name).toBe("Polyester interlock");
    expect(body.role).toBe("Body");
    expect(body.blend).toBe("100% polyester");
    expect(body.gsm).toBe("140–160 g/m²");
    expect(body.width).toBe("180 cm");
    expect(body.sublimation).toBe("Takes a sublimation print");
    expect(body.note).toBeNull();
    expect(body.ruleId).toMatch(/^R-[A-Z]+-\d{3}$/);
  });

  it("says so where the fabric is not one of the programme's rows, and keeps the article's words", () => {
    const rib = fabricCard(jersey.fabrics[1]!, programme, colours);
    expect(rib.code).toBe("F-POLY-RIB");
    expect(rib.note).toMatch(/not one of the fabric programme's rows/);
    expect(rib.blend).toBe(NOT_SET);
    expect(rib.description).toMatch(/1x1 rib/);
    expect(rib.ruleId).toBe("R-GAP-000");
  });

  it("lists the stock colours of a Class B fabric and none for a sublimated one", () => {
    const stock = fabricCard(hoodie.fabrics[0]!, programme, colours);
    expect(stock.code).toBe("F-STK-FLC");
    expect(stock.colours).toEqual([]);
    expect(fabricCard({ ...hoodie.fabrics[0]!, code: "F-STK-TEE" }, programme, colours).colours).toEqual([
      { name: "Navy", hex: "#1F2A44" },
    ]);
  });

  it("never shows a width or a GSM it does not have", () => {
    const card = fabricCard(hoodie.fabrics[0]!, programme, colours);
    expect(card.width).toBe(NOT_SET);
    expect(card.gsm).toBe(NOT_SET);
    expect(card.sublimation).toBe(NOT_SET);
  });
});

describe("the size chart", () => {
  it("has one column per size and one row per point of measure, with tolerances and rules", () => {
    const chart = sizeChart(jersey);
    expect(chart.sizes).toEqual(["XS", "S", "M", "L", "XL", "2XL", "3XL"]);
    expect(chart.sampleSize).toBe("M");
    expect(chart.rows).toHaveLength(12);
    expect(chart.rows[0]).toMatchObject({
      letter: "A",
      code: "CH",
      gradeType: "Linear",
      grade: "30 mm",
      tolerance: "−10 / +10 mm",
      values: [460, 490, 520, 550, 580, 610, 640],
      ruleId: "R-FIT-001",
    });
    expect(chart.empty).toBeNull();
  });

  it("says why it is empty for an article the build pack gives no measurements for", () => {
    const chart = sizeChart(hoodie);
    expect(chart.rows).toEqual([]);
    expect(chart.empty).toMatch(/no measurements on file/);
  });
});

describe("the fit notes and the care wording", () => {
  it("names the cut and every length that moves, with its range and rule", () => {
    const notes = fitNotes(jersey);
    expect(notes[0]).toEqual({ label: "Cut", value: "regular", ruleId: "R-GAP-000" });
    expect(notes).toContainEqual({ label: "Body length offset", value: "-30 to 40 mm · Not yet sampled", ruleId: "R-PAT-003" });
    expect(notes).toHaveLength(4);
  });

  it("says the cut is not set where no row holds it", () => {
    expect(fitNotes(hoodie)).toEqual([{ label: "Cut", value: NOT_SET, ruleId: "R-GAP-000" }]);
  });

  it("never writes a care instruction nobody wrote", () => {
    expect(careNote().value).toMatch(/No care wording is on file/);
    expect(careNote().ruleId).toBe("R-GAP-000");
  });
});

describe("the lead time", () => {
  it("reads the factory's own days and keeps its label", () => {
    const time = leadTime(capabilities.find((capability) => capability.articleCode === "JSY-SS-01"));
    expect(time.value).toBe("8 working days from the weekly cut-off, before QC and freight.");
    expect(time.label).toMatch(/not a factory quote|not agreed with a factory/);
  });

  it("says there is none where the factory does not make the article", () => {
    expect(leadTime(undefined).value).toMatch(/No lead time is on file/);
    expect(leadTime(undefined).ruleId).toBe("R-GAP-000");
  });
});
