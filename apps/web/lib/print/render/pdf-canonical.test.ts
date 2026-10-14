import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { Document, Image, Page, renderToBuffer } from "@react-pdf/renderer";
import { createElement as h } from "react";
import sharp from "sharp";
import { canonicalPdf } from "./pdf-canonical";

async function pdfOf(order: number): Promise<Uint8Array> {
  const pngs = await Promise.all([40, 400].map((n, i) => sharp({ create: { width: n, height: n, channels: 4, background: { r: 10 * i, g: 90, b: 200, alpha: 0.8 } } }).png().toBuffer()));
  const images = (order === 0 ? pngs : [...pngs].reverse()).map((data, i) => h(Image, { key: i, src: { data, format: "png" }, style: { width: 50, height: 50 } }));
  return new Uint8Array(await renderToBuffer(h(Document, { creationDate: new Date(0) }, h(Page, { size: [200, 200] }, ...images))));
}

describe("canonicalPdf", () => {
  it("keeps a PDF readable, with the same pages", async () => {
    const bytes = canonicalPdf(await pdfOf(0));
    const doc = await pdfjs.getDocument({ data: bytes }).promise;
    expect(doc.numPages).toBe(1);
    expect((await doc.getPage(1)).view).toEqual([0, 0, 200, 200]);
  });
  it("is the same bytes however the library finished its streams", async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 8; i += 1) seen.add(Buffer.from(canonicalPdf(await pdfOf(0))).toString("base64"));
    expect(seen.size).toBe(1);
  });
  it("puts objects in number order and gives a table that points at them", async () => {
    const bytes = canonicalPdf(await pdfOf(0));
    const text = Buffer.from(bytes).toString("latin1");
    const numbers = [...text.matchAll(/(\d+) 0 obj/g)].map((m) => Number(m[1]));
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    const start = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(start, start + 4)).toBe("xref");
  });
  it("returns anything it does not understand unchanged", () => {
    const junk = new TextEncoder().encode("not a pdf");
    expect(canonicalPdf(junk)).toBe(junk);
    const odd = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<< /Length 5 0 R >>\nstream\nabc\nendstream\nendobj\n");
    expect(canonicalPdf(odd)).toBe(odd);
  });
});
