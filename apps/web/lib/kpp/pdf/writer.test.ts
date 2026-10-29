import { describe, expect, it } from "vitest";
import { readPdf } from "@/lib/flat/fixtures/pdf-read";
import { Canvas, textWidthMm, wrapText } from "./canvas";
import { FlowDoc } from "./flow";
import { pinPdf } from "./pin";
import { jpegInfo, num, pdfDate, pdfString, winAnsi, writePdf } from "./writer";

/** The smallest baseline JPEG header: SOI, then an SOF0 frame of 2 x 3 pixels, 3 components. */
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x03, 0x00, 0x02, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9]);

const latin1 = (bytes: Uint8Array): string => Buffer.from(bytes).toString("latin1");

describe("winAnsi and pdfString", () => {
  it("keeps Latin-1, writes common symbols as plain text and replaces the rest", () => {
    expect(winAnsi("Café ±5 mm × 2")).toBe("Café ±5 mm × 2");
    expect(winAnsi("ΔE ≤ 1.5 – ok…")).toBe("dE <= 1.5 - ok...");
    expect(winAnsi("名前\nline")).toBe("?? line");
  });

  it("escapes brackets and backslashes", () => {
    expect(pdfString("a(b)c\\")).toBe("(a\\(b\\)c\\\\)");
  });

  it("formats numbers with two decimals and no negative zero", () => {
    expect(num(-0.001)).toBe("0.00");
    expect(num(1.006)).toBe("1.01");
    expect(num(1.004)).toBe("1.00");
    // A half that a binary float holds as a shade under a half rounds down. The rounding only has
    // to be the same every time, which it is: a hundredth of a point is far below a printer's dot.
    expect(num(1.005)).toBe("1.00");
  });

  it("writes dates in UTC and refuses a non-date", () => {
    expect(pdfDate("2026-10-25T09:30:05.000Z")).toBe("D:20261025093005Z");
    expect(() => pdfDate("soon")).toThrow("Not a date");
  });
});

describe("jpegInfo", () => {
  it("reads the frame header", () => {
    expect(jpegInfo(JPEG)).toEqual({ width: 2, height: 3, components: 3 });
  });

  it("refuses what is not a JPEG or has no frame", () => {
    expect(() => jpegInfo(Uint8Array.from([1, 2, 3]))).toThrow("Not a JPEG");
    expect(() => jpegInfo(Uint8Array.from([0xff, 0xd8, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]))).toThrow("Broken JPEG");
    expect(() => jpegInfo(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]))).toThrow("no frame");
    const grey2 = Uint8Array.from(JPEG);
    grey2[17] = 2;
    expect(() => jpegInfo(grey2)).toThrow("Unsupported");
  });
});

describe("writePdf", () => {
  it("writes a PDF a viewer opens, with the text, page size and pinned dates", async () => {
    const c = new Canvas(210, 297);
    c.text(20, 20, "Hello (factory)", { bold: true });
    c.text(190, 30, "Right", { align: "right" });
    c.text(105, 40, "Centre", { align: "center" });
    c.rect(10, 10, 50, 20, { fill: 0.9 });
    c.rect(10, 10, 50, 20, { dash: [2, 1] });
    c.path([[0, 0]], false);
    c.image({ name: "Im1", jpeg: JPEG, width: 2, height: 3, components: 3 }, 10, 50, 20, 30);
    c.image({ name: "Im1", jpeg: JPEG, width: 2, height: 3, components: 3 }, 40, 50, 20, 30);
    const bytes = writePdf({ title: "Test", createdIso: "2026-10-25T09:30:00Z", pages: [c.page()] });
    const facts = await readPdf(bytes);
    expect(facts.startsAsPdf).toBe(true);
    expect(facts.text).toContain("Hello (factory)");
    expect(Math.round(facts.widthPoints)).toBe(595);
    expect(latin1(bytes)).toContain("/CreationDate (D:20261025093000Z)");
    expect(latin1(bytes).match(/\/Subtype \/Image/g)).toHaveLength(1);
  });

  it("gives the same bytes for the same document, and refuses a document with no page", () => {
    const doc = { title: "x", createdIso: "2026-01-01T00:00:00Z", pages: [new Canvas(10, 10).page()] };
    expect(writePdf(doc)).toEqual(writePdf(doc));
    expect(() => writePdf({ ...doc, pages: [] })).toThrow("at least one page");
  });
});

describe("wrapText", () => {
  it("wraps at the width and cuts a word longer than a line", () => {
    const lines = wrapText("one two three four five six seven", 20, 9);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((l) => textWidthMm(l, 9) <= 20 + 0.01)).toBe(true);
    expect(wrapText("x".repeat(40), 10, 9).length).toBeGreaterThan(2);
    expect(wrapText("", 10, 9)).toEqual([""]);
  });
});

describe("FlowDoc", () => {
  it("repeats the table header on a new page and numbers every page", async () => {
    const rows = Array.from({ length: 120 }, (_, i) => [`Row ${i}`, "value"]);
    const bytes = new FlowDoc({ title: "T", createdIso: "2026-01-01T00:00:00Z", header: "HEAD", footer: "FOOT", landscape: true })
      .heading("Title")
      .paragraph("Body text", { muted: true })
      .space(2)
      .table([{ title: "Name", share: 0.5 }, { title: "Value", share: 0.5 }], rows)
      .build();
    const facts = await readPdf(bytes);
    expect(facts.pageCount).toBeGreaterThan(2);
    expect(facts.text).toContain(`Page ${facts.pageCount} of ${facts.pageCount}`);
    expect(facts.text.split("Name").length - 1).toBe(facts.pageCount);
    expect(Math.round(facts.widthPoints)).toBe(842);
  });
});

describe("pinPdf", () => {
  it("rewrites the dates and the file id, keeping the length", () => {
    const original = "%PDF-1.3\n<< /CreationDate (D:20300101101010Z) /ModDate (D:20300101101010+01'00') >>\ntrailer << /ID [<0123456789abcdef0123456789abcdef> <fedcba9876543210fedcba9876543210>] >>\n";
    const bytes = Uint8Array.from(Buffer.from(original, "latin1"));
    const pinned = pinPdf(bytes, "2026-10-25T09:30:00Z");
    const out = latin1(pinned);
    expect(pinned.length).toBe(bytes.length);
    expect(out).toContain("/CreationDate (D:20261025093000Z)");
    expect(out).toContain("/ModDate (D:20261025093000Z)");
    expect(out).not.toContain("0123456789abcdef0123456789abcdef");
    const again = pinPdf(Uint8Array.from(Buffer.from(original.replace("101010Z", "235959Z"), "latin1")), "2026-10-25T09:30:00Z");
    expect(latin1(again)).toBe(out);
  });

  it("leaves a PDF with neither unchanged", () => {
    const bytes = Uint8Array.from(Buffer.from("%PDF-1.4\n%%EOF\n", "latin1"));
    expect(pinPdf(bytes, "2026-10-25T09:30:00Z")).toEqual(bytes);
  });
});
