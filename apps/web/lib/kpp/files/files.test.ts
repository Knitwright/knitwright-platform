import { describe, expect, it } from "vitest";
import { readPdf } from "@/lib/flat/fixtures/pdf-read";
import { JSY_BATCH, JSY_INPUT, JSY_PATTERN } from "../fixtures/jsy-ss-01";
import type { KppInput } from "../model";
import { careLabelPdf, colourSpecPdf, folderCounts, jobSheetPdf, qcPdf, readmePdf, sizeChartPdf } from "./documents";
import { layoutSheet, notchMark, pieceLabel } from "./pattern-layout";
import { dxfForSize, nestDxf, patternSvg, pdf1to1, SCALE_BAR_MM, type PatternFileOptions } from "./patterns";
import { NO_RENDER, RENDER_LABEL, rendersPdf } from "./reference";
import { bomCsv, colourJson, namesCsv, pomCsv, techpackJson } from "./tables";

/** The files docs/spec/04 lists, each checked for the values the spec says it must carry. */

const PIECES = JSY_PATTERN.piecesBySize.M;
const OPTIONS: PatternFileOptions = { article: "JSY-SS-01", styleName: "ACME_Home_Kit", notch: "v-notch", status: "Draft, not reviewed", createdIso: "2026-10-25T09:30:00.000Z" };

describe("pom.csv", () => {
  it("has the spec's header and one row per POM, with every size column", () => {
    const lines = pomCsv(JSY_INPUT).trimEnd().split("\r\n");
    expect(lines[0]).toBe("article,pom_letter,pom_code,description,grade_type,grade_mm,tol_minus_mm,tol_plus_mm,base_size,XS,S,M,L,XL,2XL,3XL");
    expect(lines).toHaveLength(1 + JSY_INPUT.poms.length);
    expect(lines[1]).toBe("JSY-SS-01,A,CH,\"Chest width, 25 mm below armhole, half\",linear,30,10,10,M,460,490,520,550,580,610,640");
  });

  it("leaves a size with no value empty rather than guessing one", () => {
    const [first, ...rest] = JSY_INPUT.poms;
    const csv = pomCsv({ ...JSY_INPUT, poms: [{ ...first, values: { ...first.values, "3XL": null } }, ...rest] });
    expect(csv.split("\r\n")[1].endsWith(",")).toBe(true);
  });
});

describe("bom.csv and names_numbers.csv", () => {
  it("has the spec's BOM header and columns", () => {
    const lines = bomCsv(JSY_INPUT).trimEnd().split("\r\n");
    expect(lines[0]).toBe("item,type,spec,supplier_ref,qty_per_piece,unit,size_dependent");
    expect(lines[1]).toContain("Main fabric,fabric,");
    expect(lines[1].endsWith(",0.80,m,true")).toBe(true);
  });

  it("sorts names and numbers by order then line, so the file is the same every time", () => {
    const reversed: KppInput = { ...JSY_BATCH, personalisation: [...JSY_BATCH.personalisation].reverse() };
    expect(namesCsv(reversed)).toBe(namesCsv(JSY_BATCH));
    expect(namesCsv(JSY_BATCH).split("\r\n")[1]).toBe("KW10422,L1,M,SMITH,7,back_name,back_number,kw-block-01,#FFFFFF");
  });
});

describe("colour_spec.json", () => {
  it("carries the fabric, the tolerance, the Lab of each colour and whether a strike-off is needed", () => {
    const json = JSON.parse(colourJson(JSY_INPUT));
    expect(json.fabric).toBe("F-POLY-INT");
    expect(json.tolerance).toEqual({ metric: "dE_CMC_2_1", max: 1.5 });
    expect(json.strike_off_required).toBe(true);
    expect(json.colours[0]).toEqual({ role: "primary", hex: "#0B1F4B", lab: [13, 10.7, -29.6], pantone_tcx: "19-4024 TCX", swatch_id: "SB-POLY-INT-031" });
  });
});

describe("techpack.json", () => {
  it("carries every section with its provenance and rule id, so a PLM can import it", () => {
    const json = JSON.parse(techpackJson(JSY_INPUT));
    expect(json.schema).toBe("knitwright.kpp.techpack/1");
    expect(json.design).toMatchObject({ code: "ACME_Home_Kit", article: "JSY-SS-01", version: 3, base_size: "M" });
    for (const row of [...json.overview, ...json.measurements, ...json.bom]) {
      expect(row.rule_id, JSON.stringify(row)).toMatch(/^R-[A-Z]+-[0-9]{3}$/);
      expect(["from_base", "from_design", "needs_input", "confirmed"]).toContain(row.provenance);
    }
    expect(json.print).toEqual({ dpi: 150, bleed_mm: 10, mirrored: false, rule_id: "R-SUB-002" });
    expect(json.measurements[0].values_mm).toHaveLength(7);
  });
});

describe("the PDF documents", () => {
  it("00_README.pdf says what is inside, who to contact, the due date and that nothing is mirrored", async () => {
    const facts = await readPdf(readmePdf(JSY_INPUT, ["00_README.pdf", "01_techpack/techpack.pdf", "01_techpack/techpack.json"]));
    expect(facts.text).toContain("Due date: 2026-11-20");
    expect(facts.text).toContain("NOT mirrored");
    expect(facts.text).toContain("Knitwright production team");
    expect(facts.text).toContain("01_techpack/: 2 files");
  });

  it("counts files per folder and names a file at the root by itself", () => {
    expect(folderCounts(["manifest.json", "06_bom/bom.csv", "07_labels/a.pdf", "07_labels/b.pdf"])).toEqual(["06_bom/: 1 file", "07_labels/: 2 files", "manifest.json"]);
  });

  it("size_chart_customer.pdf says the measurements are of the garment and marks the base size", async () => {
    const facts = await readPdf(sizeChartPdf(JSY_INPUT));
    expect(facts.text).toContain("not of the body");
    expect(facts.text).toContain("M (base)");
  });

  it("colour_spec.pdf carries the tolerance and tells the factory to match the strike-off", async () => {
    const facts = await readPdf(colourSpecPdf(JSY_INPUT));
    expect(facts.text).toContain("delta E CMC 2:1 <= 1.5");
    expect(facts.text).toContain("strike-off is the colour to match");
    expect(facts.text).toContain("19-4024 TCX");
  });

  it("care_label_<market>.pdf is one 60 x 100 mm label with fibre, care, origin and size", async () => {
    const facts = await readPdf(careLabelPdf(JSY_INPUT, JSY_INPUT.labels[0]));
    expect(Math.round(facts.widthPoints)).toBe(170);
    expect(facts.pageCount).toBe(1);
    expect(facts.text).toContain("100% Polyester");
    expect(facts.text).toContain("Made in Pakistan");
    expect(facts.text).toContain("Acme FC, 1 Example Street, London");
  });

  it("leaves the importer line off a market that needs none", async () => {
    const facts = await readPdf(careLabelPdf(JSY_INPUT, JSY_INPUT.labels[1]));
    expect(facts.text).not.toContain("Example Street");
    expect(facts.text).toContain("AU");
  });

  it("qc_checklist.pdf carries the AQL plan, the POMs to measure and the photo list", async () => {
    const facts = await readPdf(qcPdf({ ...JSY_INPUT, factory: { ...JSY_INPUT.factory, madeByKnitwright: false } }));
    expect(facts.text).toContain("AQL 0 critical / 2.5 major / 4.0 minor");
    expect(facts.text).toContain("Side seam close-up");
    expect(facts.text).toContain("-10 / +10");
    // Only the POMs the QC plan names, not every POM.
    expect(facts.text).not.toContain("Back neck drop");
  });

  it("asks for every piece to be inspected on a sample Knitwright makes", async () => {
    const facts = await readPdf(qcPdf(JSY_INPUT));
    expect(facts.text).toContain("inspect every piece");
  });

  it("job_sheet.pdf lists each order, the size breakdown, the totals and the packing instructions", async () => {
    const facts = await readPdf(jobSheetPdf(JSY_BATCH));
    expect(facts.text).toContain("KW10422");
    expect(facts.text).toContain("All orders");
    expect(facts.text).toContain("Fold flat and bag each order separately.");
  });

  it("says so plainly when packing instructions are not set", async () => {
    const facts = await readPdf(jobSheetPdf({ ...JSY_BATCH, packing: [] }));
    expect(facts.text).toContain("Packing instructions not set.");
  });

  it("renders_front_back.pdf labels a render, and says so when there is none", async () => {
    const without = await readPdf(rendersPdf(JSY_INPUT, null));
    expect(without.text).toContain(NO_RENDER);
    expect(without.text).toContain(RENDER_LABEL);
  });
});

describe("the pattern files", () => {
  it("writes a DXF in millimetres carrying the style and status, per size and as a nest", () => {
    const one = dxfForSize(PIECES, OPTIONS);
    expect(one).toContain("$INSUNITS");
    expect(one).toContain("STYLE NAME: ACME_Home_Kit");
    expect(one).toContain("STATUS: Draft, not reviewed");
    const nest = nestDxf(JSY_PATTERN, OPTIONS);
    expect(nest).toContain("SIZES: XS S M L XL 2XL 3XL");
    expect(nest.length).toBeGreaterThan(one.length);
    expect(dxfForSize(PIECES, OPTIONS)).toBe(one);
  });

  it("writes a 1:1 PDF on A0 tiles with alignment marks and a 100 mm scale bar on every tile", async () => {
    const facts = await readPdf(pdf1to1(PIECES, OPTIONS));
    expect(Math.round(facts.widthPoints)).toBe(2384);
    expect(facts.text).toContain(`${SCALE_BAR_MM} mm: measure this bar to check the print is 1:1`);
    expect(facts.text).toContain("Print at 100%, no scaling.");
    expect(facts.text).toContain("Join at the crosses.");
    expect(facts.text).toContain("V notches");
  });

  it("says slit notches when the factory profile asks for them", async () => {
    const facts = await readPdf(pdf1to1(PIECES, { ...OPTIONS, notch: "slit" }));
    expect(facts.text).toContain("slit notches");
  });

  it("writes an SVG canvas in millimetres with the cut, sew, grain and notch lines in their own classes", () => {
    const svg = patternSvg(PIECES, OPTIONS);
    expect(svg).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(svg).toMatch(/width="[0-9.]+mm" height="[0-9.]+mm"/);
    for (const cls of ["cut", "sew", "grain", "notch"]) expect(svg).toContain(`class="${cls}"`);
    expect(svg).toContain("<title>ACME_Home_Kit JSY-SS-01 size M, 1:1, mm</title>");
    expect(patternSvg(PIECES, OPTIONS)).toBe(svg);
  });

  it("escapes a style name with XML characters in it", () => {
    expect(patternSvg(PIECES, { ...OPTIONS, styleName: '<a & "b">' })).toContain("&lt;a &amp; &quot;b&quot;&gt;");
  });
});

describe("the sheet layout", () => {
  it("places every piece inside the sheet, below the header, with y running down", () => {
    const sheet = layoutSheet(PIECES);
    expect(sheet.pieces).toHaveLength(PIECES.length);
    for (const piece of sheet.pieces) {
      for (const [x, y] of piece.cut) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(sheet.widthMm);
        expect(y).toBeLessThanOrEqual(sheet.heightMm);
      }
    }
  });

  it("keeps each piece the size it was: flipping the axis is not a scale", () => {
    const sheet = layoutSheet(PIECES);
    const span = (points: readonly (readonly [number, number])[], at: 0 | 1): number => Math.max(...points.map((p) => p[at])) - Math.min(...points.map((p) => p[at]));
    PIECES.forEach((piece, i) => {
      expect(span(sheet.pieces[i].cut, 0)).toBeCloseTo(span(piece.cutOutline, 0), 1);
      expect(span(sheet.pieces[i].cut, 1)).toBeCloseTo(span(piece.cutOutline, 1), 1);
    });
  });

  it("wraps onto a new row once the row is wider than a plotter roll", () => {
    const wide = Array.from({ length: 6 }, (_, i) => ({ ...PIECES[0], id: `p${i}`, name: `Piece ${i}` }));
    const sheet = layoutSheet(wide);
    expect(sheet.heightMm).toBeGreaterThan(layoutSheet([PIECES[0]]).heightMm);
  });

  it("marks a notch 5 mm inward from the edge", () => {
    expect(notchMark([10, 0], [10, 100])).toEqual([10, 5]);
    expect(notchMark([0, 0], [0, 0])).toEqual([0, 0]);
  });

  it("labels a piece with its name, size and how many to cut", () => {
    const [piece] = layoutSheet(PIECES).pieces;
    expect(pieceLabel(piece)[0]).toBe(piece.name);
    expect(pieceLabel(piece)[1]).toBe("Size M");
    expect(pieceLabel(piece)[2]).toMatch(/^Cut \d/);
    expect(pieceLabel({ ...piece, quantity: 2, mirroredPair: true, onFold: false })[2]).toBe("Cut 2 (1 pair, mirrored)");
    expect(pieceLabel({ ...piece, quantity: 4, mirroredPair: true, onFold: true })[2]).toBe("Cut 4 (2 pairs, mirrored), on fold");
  });
});
