import { describe, expect, it } from "vitest";
import { readPdf } from "@/lib/flat/fixtures/pdf-read";
import { imageItem, imageScene, rasterScene, tinyPng, vectorScene } from "../fixtures";
import { renderPdf } from ".";

const MM_PER_POINT = 25.4 / 72;
const names = (facts: Awaited<ReturnType<typeof readPdf>>): string[] => facts.operations.map((op) => op.name);
const text = (bytes: Uint8Array): string => Buffer.from(bytes).toString("latin1");

describe("renderPdf", () => {
  it("is a PDF whose page is the piece plus the bleed within 0.1 mm", async () => {
    const facts = await readPdf(await renderPdf(vectorScene()));
    expect(facts.startsAsPdf).toBe(true);
    expect(facts.pageCount).toBe(1);
    expect(Math.abs(facts.widthPoints * MM_PER_POINT - 306)).toBeLessThan(0.1);
    expect(Math.abs(facts.heightPoints * MM_PER_POINT - 206)).toBeLessThan(0.1);
  });

  it("draws vector paths and no picture for a vector scene", async () => {
    const operations = names(await readPdf(await renderPdf(vectorScene())));
    expect(operations).toContain("constructPath");
    expect(operations).toContain("eoClip");
    expect(operations).toContain("setFillRGBColor");
    expect(operations).toContain("setLineWidth");
    expect(operations.filter((name) => /Image/.test(name))).toEqual([]);
  });

  it("writes a picture used twice as one image object with a soft mask", async () => {
    const bytes = await renderPdf(await imageScene());
    const operations = names(await readPdf(bytes));
    expect(operations.filter((name) => name === "paintImageXObject")).toHaveLength(2);
    expect(text(bytes).match(/\/Subtype \/Image \/Width 8 \/Height 4 \/ColorSpace \/DeviceRGB/g)).toHaveLength(1);
    expect(text(bytes)).toContain("/SMask");
  });

  it("puts the guides in a visible layer called Guides and keeps dates and ids out", async () => {
    const out = text(await renderPdf(vectorScene()));
    expect(out).toContain("/Type /OCG /Name (Guides)");
    expect(out).toContain("/ON [6 0 R]");
    expect(out).not.toMatch(/CreationDate|ModDate|\/ID/);
    expect(out).toContain("/Producer (Knitwright)");
    expect(out).toContain("/Title (Front \\(A&B\\) \\(M\\))");
    expect(out).toContain("/Subject (Printed at 100 percent; Caf? <test> & more)");
  });

  it("writes opacity and blend graphics states", async () => {
    const base = vectorScene();
    const shade = { ...(base.items[0] as (typeof base.items)[0] & { kind: "fill" }), layerId: "s", blend: "multiply" as const, opacity: 0.5 };
    const out = text(await renderPdf({ ...base, items: [...base.items, shade] }));
    expect(out).toContain("/ca 0.500 /CA 0.500 /BM /Normal");
    expect(out).toContain("/BM /Multiply");
    for (const blend of ["screen", "overlay"] as const) {
      expect(text(await renderPdf({ ...base, items: [{ ...shade, blend }] }))).toContain(blend === "screen" ? "/BM /Screen" : "/BM /Overlay");
    }
  });

  it("writes an opaque picture without a soft mask, and without a clip when it has none", async () => {
    const base = vectorScene();
    const item = { ...(await imageItem("solid", 20)), png: await tinyPng({ r: 1, g: 2, b: 3, alpha: 1 }), clip: [], opacity: 1 };
    const bytes = await renderPdf({ ...base, items: [item] });
    expect(text(bytes)).not.toContain("/SMask");
    expect(names(await readPdf(bytes))).toContain("paintImageXObject");
  });

  it("has an exact cross reference table", async () => {
    const bytes = await renderPdf(await imageScene());
    const out = text(bytes);
    const start = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(out)?.[1]);
    expect(out.slice(start, start + 4)).toBe("xref");
    const rows = out.slice(start).split("\n").slice(2);
    const count = Number(/Size (\d+)/.exec(out)?.[1]);
    for (let id = 1; id < count; id += 1) {
      const offset = Number(rows[id]?.slice(0, 10));
      expect(out.slice(offset, offset + `${id} 0 obj`.length)).toBe(`${id} 0 obj`);
    }
  });

  it("is byte-identical across runs", async () => {
    const scene = await imageScene();
    expect(Buffer.compare(Buffer.from(await renderPdf(scene)), Buffer.from(await renderPdf(scene)))).toBe(0);
  });

  it("writes a raster scene as one image, with vector guides", async () => {
    const facts = await readPdf(await renderPdf(rasterScene()));
    const operations = names(facts);
    expect(operations.filter((name) => name === "paintImageXObject")).toHaveLength(1);
    expect(operations).toContain("constructPath");
    expect(Math.abs(facts.widthPoints * MM_PER_POINT - 306)).toBeLessThan(0.1);
  });

  it("rejects a colour that is not #rrggbb", async () => {
    const base = vectorScene();
    const bad = { ...base, items: [{ ...(base.items[0] as (typeof base.items)[0] & { kind: "fill" }), colour: "blue" }] };
    await expect(renderPdf(bad)).rejects.toThrow(RangeError);
  });
});
