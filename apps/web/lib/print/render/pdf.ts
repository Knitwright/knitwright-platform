import { Document, G, Image, Page, Path, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";
import { PDF_FONT_FAMILY, registerPdfFont } from "@/lib/flat/pdf-font";
import type { Shape } from "../geometry/boolean";
import type { Pt } from "../geometry/vec";
import type { PieceScene, RasterLayer, SceneLayer, VectorLayer } from "../layout/scene";
import { CUT_COLOUR, BLEED_COLOUR, GUIDE_WIDTH_MM } from "./svg";
import { num, pageMap, pathData } from "./svg-util";

/** Points to a millimetre: a PDF page is measured in 1/72 inch. */
export const PT_PER_MM = 72 / 25.4;

/** Fixed, so two builds of one file are the same bytes. The file's own date is the release's, not the clock's. */
const FIXED_DATE = new Date(0);

const pt = (mm: number): number => mm * PT_PER_MM;

function vectorLayer(layer: VectorLayer, scene: PieceScene, key: string): ReactElement {
  const to = pageMap(scene.box);
  const [w, hgt] = [scene.box.maxX - scene.box.minX, scene.box.maxY - scene.box.minY];
  const paths = layer.shapes.map((s, i) => h(Path, { key: `${key}-${i}`, d: pathData(s.shape, to), fill: s.fill, fillRule: "evenodd" }));
  return h(Svg, { key, width: pt(w), height: pt(hgt), viewBox: `0 0 ${num(w)} ${num(hgt)}`, style: { position: "absolute", left: 0, top: 0 } }, h(G, { opacity: layer.opacity }, ...paths));
}

function rasterLayer(layer: RasterLayer, scene: PieceScene, key: string): ReactElement[] {
  const to = pageMap(scene.box);
  return layer.strips.map((s, i) => {
    const [x, y] = to([s.box.minX, s.box.maxY]);
    return h(Image, {
      key: `${key}-${i}`,
      src: { data: Buffer.from(s.png), format: "png" },
      style: { position: "absolute", left: pt(x), top: pt(y), width: pt(s.box.maxX - s.box.minX), height: pt(s.box.maxY - s.box.minY), opacity: layer.opacity },
    });
  });
}

function guides(scene: PieceScene): ReactElement {
  const to = pageMap(scene.box);
  const [w, hgt] = [scene.box.maxX - scene.box.minX, scene.box.maxY - scene.box.minY];
  const line = (ring: readonly Pt[], stroke: string, dash: string | undefined, key: string): ReactElement =>
    h(Path, { key, d: `M${ring.map((p) => to(p)).map(([x, y]) => `${num(x)} ${num(y)}`).join("L")}Z`, fill: "none", stroke, strokeWidth: GUIDE_WIDTH_MM, ...(dash === undefined ? {} : { strokeDasharray: dash }) });
  return h(Svg, { key: "guides", width: pt(w), height: pt(hgt), viewBox: `0 0 ${num(w)} ${num(hgt)}`, style: { position: "absolute", left: 0, top: 0 } }, line(scene.bleedOutline, BLEED_COLOUR, "2 1", "bleed"), line(scene.cutOutline, CUT_COLOUR, undefined, "cut"));
}

function slugLayer(scene: PieceScene, shapes: readonly Shape[]): ReactElement {
  const to = pageMap(scene.box);
  const [w, hgt] = [scene.box.maxX - scene.box.minX, scene.box.maxY - scene.box.minY];
  return h(Svg, { key: "notes", width: pt(w), height: pt(hgt), viewBox: `0 0 ${num(w)} ${num(hgt)}`, style: { position: "absolute", left: 0, top: 0 } }, ...shapes.map((s, i) => h(Path, { key: `n${i}`, d: pathData(s, to), fill: "#000000", fillRule: "evenodd" })));
}

export interface PdfOptions {
  readonly guides: boolean;
  readonly slug: readonly Shape[];
}

/**
 * The scene as a PDF. Page one is the print page at 1:1: the piece's bounds plus the bleed on every side. Page two lists
 * every note in full, because a narrow piece has no room in its margin for them all. Vector layers stay vector paths;
 * pictures are placed as the pixels they were built to.
 */
export async function buildPdf(scene: PieceScene, options: PdfOptions): Promise<Uint8Array> {
  registerPdfFont();
  const [w, hgt] = [scene.box.maxX - scene.box.minX, scene.box.maxY - scene.box.minY];
  const layers = scene.layers.flatMap((l: SceneLayer, i) => (l.kind === "vector" ? [vectorLayer(l, scene, `v${i}`)] : rasterLayer(l, scene, `r${i}`)));
  const title = `${scene.pieceName}, size ${scene.size}${scene.player === null ? "" : `, ${scene.player.name} ${scene.player.number}`}`;
  // One container a hair smaller than the page, so the layers (all drawn at full page size, laid on one another) never push
  // the page to a second one.
  const stack = h(View, { key: "stack", style: { position: "relative", width: pt(w) - 0.1, height: pt(hgt) - 0.1 } }, ...layers, ...(options.guides ? [guides(scene)] : []), slugLayer(scene, options.slug));
  const printPage = h(Page, { key: "print", size: [pt(w), pt(hgt)], style: { padding: 0 } }, stack);
  const notesPage = h(
    Page,
    { key: "notes", size: "A4", style: { padding: 36, fontFamily: PDF_FONT_FAMILY, fontSize: 9 } },
    h(Text, { style: { fontSize: 12, marginBottom: 8 } }, "Notes for this file"),
    ...scene.notes.map((note, i) => h(View, { key: `n${i}`, style: { marginBottom: 4 } }, h(Text, null, note))),
  );
  const doc = h(Document, { title, creator: "Knitwright", producer: "Knitwright", creationDate: FIXED_DATE, language: "en" }, printPage, notesPage);
  return new Uint8Array(await renderToBuffer(doc));
}
