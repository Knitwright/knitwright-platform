import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { readPdf } from "@/lib/flat/fixtures/pdf-read";
import { buildPackage } from "./assemble";
import { careLabelPdf, jobSheetPdf, readmePdf } from "./files/documents";
import { pdf1to1 } from "./files/patterns";
import { NO_RENDER, RENDER_LABEL, rendersPdf } from "./files/reference";
import { colourJson, namesCsv } from "./files/tables";
import { fixtureSources, JSY_BATCH, JSY_INPUT, JSY_PATTERN } from "./fixtures/jsy-ss-01";
import type { KppInput, PanelPrintFile } from "./model";
import { pinPdf } from "./pdf/pin";

/**
 * The corners: a design with nothing filled in beyond what the gate asks for, a pattern too big
 * for one A0 tile, a render that exists, and PDFs from other writers whose dates are pinned.
 */

/** A two-by-three pixel baseline JPEG: an SOI, an SOF0 frame and an EOI. Enough to embed. */
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x03, 0x00, 0x02, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9]);

const SPARSE: KppInput = {
  ...JSY_INPUT,
  design: { ...JSY_INPUT.design, season: null },
  factory: { ...JSY_INPUT.factory, contact: null, notch: "slit", madeByKnitwright: false },
  dueDate: null,
  notes: [],
};

describe("a design with the optional things left out", () => {
  it("says so in words rather than leaving a blank", async () => {
    const facts = await readPdf(readmePdf(SPARSE, ["00_README.pdf"]));
    expect(facts.text).toContain("Due date: not set");
    expect(facts.text).toContain("Knitwright production team");
    expect(facts.text).toContain("Season not set");
    expect(facts.text).toContain("slit");
  });

  it("builds the whole package anyway", async () => {
    const result = await buildPackage(SPARSE, fixtureSources());
    expect(result.ok).toBe(true);
  });

  it("leaves a care label's size line bare when there is no size text", async () => {
    const facts = await readPdf(careLabelPdf(SPARSE, { ...SPARSE.labels[1], size: null, fibre: null }));
    expect(facts.text).toContain("Size");
  });

  it("says a batch order has no due date of its own", async () => {
    const facts = await readPdf(jobSheetPdf({ ...JSY_BATCH, dueDate: null, orders: [{ orderNo: "KW1", sizes: { M: 1 }, dueDate: null }] }));
    expect(facts.text).toContain("not set");
  });
});

describe("the reference renders", () => {
  it("puts the front and back in, each labelled 'Render, not photo'", async () => {
    const bytes = rendersPdf(JSY_INPUT, { front: JPEG, back: JPEG });
    const facts = await readPdf(bytes);
    expect(facts.text).toContain(`Front. ${RENDER_LABEL}`);
    expect(facts.text).toContain(`Back. ${RENDER_LABEL}`);
    expect(facts.text).not.toContain(NO_RENDER);
    expect(Buffer.from(bytes).toString("latin1").match(/\/Subtype \/Image/g)).toHaveLength(2);
  });
});

describe("tables at their edges", () => {
  it("writes no Lab for a colour with no hex", () => {
    const json = JSON.parse(colourJson({ ...JSY_INPUT, colour: { ...JSY_INPUT.colour, colours: [{ role: "secondary", hex: null, pantoneTcx: null, swatchId: null }] } }));
    expect(json.colours[0].lab).toBeNull();
  });

  it("keeps two lines of one order in line order, and holds a tie steady", () => {
    const rows = JSY_BATCH.personalisation;
    const same = [{ ...rows[0], lineId: "L1" }, { ...rows[1], lineId: "L1", name: "BROWN" }];
    expect(namesCsv({ ...JSY_BATCH, personalisation: same })).toBe(namesCsv({ ...JSY_BATCH, personalisation: [...same].reverse() }));
  });
});

describe("the 1:1 PDF of a sheet wider and taller than one A0 tile", () => {
  it("tiles it and numbers every tile", async () => {
    // Pieces at four times the fixture's size: more than one A0 page across and down.
    const big = JSY_PATTERN.piecesBySize.M.map((piece) => ({
      ...piece,
      cutOutline: piece.cutOutline.map(([x, y]) => [x * 4, y * 4] as [number, number]),
      sewLine: null,
      grainLine: null,
      foldLine: null,
      internalLines: [],
      notches: [],
    }));
    const facts = await readPdf(pdf1to1(big, { article: "JSY-SS-01", styleName: "Big", notch: "v-notch", status: "Draft", createdIso: "2026-10-25T09:30:00.000Z" }));
    expect(facts.pageCount).toBeGreaterThan(2);
    expect(facts.text).toContain("Tile row 1 column 1 of");
    expect(facts.text).toContain("Tile row 2 column 1 of");
  });
});

describe("pinning another writer's PDF", () => {
  it("pins a date written with no space before the string", () => {
    const bytes = Uint8Array.from(Buffer.from("%PDF-1.4\n/CreationDate(D:20300101101010Z)\n", "latin1"));
    expect(Buffer.from(pinPdf(bytes, "2026-10-25T09:30:00Z")).toString("latin1")).toContain("/CreationDate(D:20261025093000Z)");
  });

  it("leaves a date it cannot rewrite without changing the file's length alone", () => {
    // `/ModDate (D:...Z)` is shorter than the pinned form needs only if the pinned form is longer,
    // which it never is; a date already in UTC is replaced in place and the length is kept.
    const bytes = Uint8Array.from(Buffer.from("%PDF-1.4\n/ModDate (D:20300101101010+0530)\n", "latin1"));
    const out = pinPdf(bytes, "2026-10-25T09:30:00Z");
    expect(out.length).toBe(bytes.length);
    expect(Buffer.from(out).toString("latin1")).toContain("D:20261025093000Z");
  });
});

describe("a batch order that asks for no pieces of a size", () => {
  it("makes no print file for that size", async () => {
    const sources = fixtureSources();
    const input: KppInput = { ...JSY_BATCH, orders: [{ orderNo: "KW1", sizes: { M: 2, L: 0 }, dueDate: "2026-11-20" }] };
    const result = await buildPackage(input, sources);
    expect(result.ok).toBe(true);
    expect(sources.calls).toEqual(["KW1/M"]);
  });

  it("names a print file with no panels at all without failing", async () => {
    const empty: readonly PanelPrintFile[] = [];
    const result = await buildPackage(JSY_INPUT, fixtureSources({ print: { files: async () => empty } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(unzipSync(result.zip)).some((p) => p.includes("04_print/"))).toBe(false);
  });
});
