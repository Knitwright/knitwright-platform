import { Document, G, Image, Page, Path, Svg, Text, View, type DocumentProps } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";
import { safeColour } from "./colour";
import { drawableImage, missingImagePath, type ImageBytes, type ImageMap } from "./images";
import type { FlatElement, FlatImage, FlatLayer, FlatModel, FlatPath, FlatText } from "./model";
import { num, pathData } from "./path-data";
import { PDF_FONT_FAMILY, registerPdfFont } from "./pdf-font";

/**
 * Draws a geometry model as PDF primitives for `@react-pdf/renderer`: vector paths and
 * text inside an Svg, and pictures placed on top. One scale is used for both axes.
 * Each layer is a group with the id `layer-<name>`, holding its elements in drawing order.
 *
 * The PDF library cannot clip a picture, so pictures are not clipped to their panel here
 * or in the SVG. They are drawn as placed.
 */

export interface Placement {
  readonly pointsPerUnit: number;
  readonly widthPoints: number;
  readonly heightPoints: number;
}

export interface PdfOptions {
  /** How wide to draw the whole drawing, in points (72 to the inch). */
  readonly widthPoints: number;
  readonly images: ImageMap;
}

/** The size of the drawing on the page. The same scale applies to both axes. */
export function pdfPlacement(model: FlatModel, widthPoints: number): Placement {
  const { minX, minY, maxX, maxY } = model.bounds;
  const pointsPerUnit = widthPoints / (maxX - minX);
  return { pointsPerUnit, widthPoints, heightPoints: (maxY - minY) * pointsPerUnit };
}

const FALLBACK = "#000000";

function pathElement(path: FlatPath, key: string): ReactElement {
  const stroke = path.stroke;
  return h(Path, {
    key,
    d: pathData(path.commands),
    fill: (path.fill && safeColour(path.fill)) || "none",
    ...(stroke
      ? {
          stroke: safeColour(stroke.colour) ?? FALLBACK,
          strokeWidth: stroke.width,
          ...(stroke.dash.length > 0 ? { strokeDasharray: stroke.dash.map(num).join(" ") } : {}),
          strokeLinejoin: "round",
          strokeLinecap: "round",
        }
      : {}),
  });
}

function textElement(text: FlatText, key: string): ReactElement {
  const drawn = h(
    Text,
    {
      key,
      x: text.at.x,
      y: text.at.y,
      fill: safeColour(text.colour) ?? FALLBACK,
      style: { fontSize: text.size, fontFamily: PDF_FONT_FAMILY, textAnchor: text.anchor },
    },
    text.text,
  );
  if (text.rotation === 0) return drawn;
  return h(G, { key: `${key}-turn`, transform: `rotate(${num(text.rotation)} ${num(text.at.x)} ${num(text.at.y)})` }, drawn);
}

function imageElement(image: FlatImage, found: ImageBytes, model: FlatModel, widthPoints: number, key: string): ReactElement {
  const { minX, minY } = model.bounds;
  const scale = pdfPlacement(model, widthPoints).pointsPerUnit;
  const box = {
    position: "absolute" as const,
    left: (image.at.x - image.width / 2 - minX) * scale,
    top: (image.at.y - image.height / 2 - minY) * scale,
    width: image.width * scale,
    height: image.height * scale,
    transform: `rotate(${num(image.rotation)}deg)`,
  };
  const format = found.contentType === "image/png" ? "png" : "jpg";
  return h(Image, { key, src: { data: Buffer.from(found.bytes), format }, style: box });
}

type Vector = FlatPath | FlatText;
type Run = { readonly vectors: readonly Vector[] } | { readonly image: FlatImage; readonly found: ImageBytes };

/**
 * Consecutive paths and text share one Svg. A picture between them splits the run, to keep
 * the order. A picture with no bytes becomes the dashed box the SVG draws too.
 */
function runsOf(elements: readonly FlatElement[], images: ImageMap): Run[] {
  const runs: Run[] = [];
  const add = (vector: Vector): void => {
    const last = runs.at(-1);
    if (last && "vectors" in last) runs[runs.length - 1] = { vectors: [...last.vectors, vector] };
    else runs.push({ vectors: [vector] });
  };
  for (const element of elements) {
    if (element.kind !== "image") add(element);
    else {
      const found = drawableImage(images, element.fileId);
      if (found) runs.push({ image: element, found });
      else add(missingImagePath(element));
    }
  }
  return runs;
}

function layerElement(model: FlatModel, layer: FlatLayer, options: PdfOptions): ReactElement {
  const { widthPoints, heightPoints } = pdfPlacement(model, options.widthPoints);
  const { minX, minY, maxX, maxY } = model.bounds;
  const parts = runsOf(layer.elements, options.images).map((run, index) => {
    const key = `${layer.id}-${index}`;
    if ("image" in run) return imageElement(run.image, run.found, model, options.widthPoints, key);
    return h(
      Svg,
      {
        key,
        width: widthPoints,
        height: heightPoints,
        viewBox: `${num(minX)} ${num(minY)} ${num(maxX - minX)} ${num(maxY - minY)}`,
        style: { position: "absolute", top: 0, left: 0 },
      },
      ...run.vectors.map((element, position) =>
        element.kind === "path" ? pathElement(element, `${key}-${position}`) : textElement(element, `${key}-${position}`),
      ),
    );
  });
  return h(View, { key: layer.id, id: `layer-${layer.id}`, style: { position: "absolute", top: 0, left: 0, width: widthPoints, height: heightPoints } }, ...parts);
}

/** The drawing as an element to place on a page. It is as wide as `widthPoints`. */
export function renderPdf(model: FlatModel, options: PdfOptions): ReactElement {
  registerPdfFont();
  const { widthPoints, heightPoints } = pdfPlacement(model, options.widthPoints);
  return h(
    View,
    { style: { position: "relative", width: widthPoints, height: heightPoints } },
    ...model.layers.map((layer) => layerElement(model, layer, options)),
  );
}

export interface DocumentOptions {
  readonly widthPoints?: number;
  readonly margin?: number;
}

const A4_WIDTH_POINTS = 595.28;
const DEFAULT_MARGIN = 40;
const NOTICE_SIZE = 10;

/** A one page A4 document holding one drawing, with the not to scale sentence under it when it applies. */
export function renderPdfDocument(model: FlatModel, images: ImageMap, options: DocumentOptions = {}): ReactElement<DocumentProps> {
  registerPdfFont();
  const margin = options.margin ?? DEFAULT_MARGIN;
  const widthPoints = options.widthPoints ?? A4_WIDTH_POINTS - 2 * margin;
  const notice = model.notice
    ? [h(Text, { key: "notice", style: { fontSize: NOTICE_SIZE, fontFamily: PDF_FONT_FAMILY, marginTop: 8 } }, model.notice)]
    : [];
  return h(
    Document,
    { title: model.description },
    h(Page, { size: "A4", style: { padding: margin, fontFamily: PDF_FONT_FAMILY } }, renderPdf(model, { widthPoints, images }), ...notice),
  );
}
