import { safeColour } from "./colour";
import { drawableImage, missingImagePath, type ImageMap } from "./images";
import { num, pathData, pointText } from "./path-data";
import type { FlatElement, FlatImage, FlatLayer, FlatModel, FlatPath, FlatText, Point } from "./model";

/**
 * Draws a geometry model as an SVG string. It has one group per layer, named so that
 * drawing tools open it as layers, a viewBox in the model's units and, only when the
 * drawing is to scale, a size in real millimetres. It holds no script, no event handler and no reference to anything outside
 * the file. Pictures are embedded from bytes the caller already has. Every piece of text
 * that came from a person is escaped, and colours are written only when they are #rrggbb.
 */

const INVALID_XML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g;
const FONT_STACK = "Geist, Arial, Helvetica, sans-serif";
const UNITS_PER_MM = 10;
const FALLBACK_STROKE = "#000000";

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const REPLACEMENT = "�";

/** Text with half of a surrogate pair made whole again with the replacement mark, so it can be encoded. */
export const wellFormed = (text: string): string => text.replace(LONE_SURROGATE, REPLACEMENT);

export function escapeXml(text: string): string {
  return wellFormed(text)
    .replace(INVALID_XML, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

const n = num;
const at = pointText;

function pathElement(path: FlatPath): string {
  const stroke = path.stroke;
  const attributes = [
    `d="${pathData(path.commands)}"`,
    `fill="${(path.fill && safeColour(path.fill)) || "none"}"`,
    ...(stroke
      ? [
          `stroke="${safeColour(stroke.colour) ?? FALLBACK_STROKE}"`,
          `stroke-width="${n(stroke.width)}"`,
          ...(stroke.dash.length > 0 ? [`stroke-dasharray="${stroke.dash.map(n).join(" ")}"`] : []),
          'stroke-linejoin="round"',
          'stroke-linecap="round"',
        ]
      : []),
    `data-name="${escapeXml(path.name)}"`,
  ];
  return `<path ${attributes.join(" ")}/>`;
}

const rotation = (degrees: number, centre: Point): string =>
  degrees === 0 ? "" : ` transform="rotate(${n(degrees)} ${at(centre)})"`;

function textElement(text: FlatText): string {
  const attributes = `x="${n(text.at.x)}" y="${n(text.at.y)}" font-size="${n(text.size)}" text-anchor="${text.anchor}" fill="${
    safeColour(text.colour) ?? FALLBACK_STROKE
  }" font-family="${FONT_STACK}"${rotation(text.rotation, text.at)}`;
  return `<text ${attributes}>${escapeXml(text.text)}</text>`;
}

function imageElement(image: FlatImage, images: ImageMap): string {
  const found = drawableImage(images, image.fileId);
  const box = `x="${n(image.at.x - image.width / 2)}" y="${n(image.at.y - image.height / 2)}" width="${n(image.width)}" height="${n(image.height)}"`;
  const turn = rotation(image.rotation, image.at);
  if (!found) return pathElement(missingImagePath(image));
  const data = Buffer.from(found.bytes).toString("base64");
  return `<image ${box} preserveAspectRatio="none" href="data:${found.contentType};base64,${data}"${turn}/>`;
}

function elementText(element: FlatElement, images: ImageMap): string {
  if (element.kind === "path") return pathElement(element);
  if (element.kind === "text") return textElement(element);
  return imageElement(element, images);
}

function layerElement(layer: FlatLayer, images: ImageMap): string {
  const open = `<g id="layer-${escapeXml(layer.id)}" inkscape:groupmode="layer" inkscape:label="${escapeXml(layer.label)}">`;
  return `${open}${layer.elements.map((element) => elementText(element, images)).join("")}</g>`;
}

/** The drawing as an SVG document. Call it again to draw again: it changes nothing. */
export function renderSvg(model: FlatModel, images: ImageMap = new Map()): string {
  const { minX, minY, maxX, maxY } = model.bounds;
  const width = maxX - minX;
  const height = maxY - minY;
  // A drawing that is not to scale must not claim a real size, so it gets a viewBox only.
  const size = model.toScale ? [`width="${n(width / UNITS_PER_MM)}mm"`, `height="${n(height / UNITS_PER_MM)}mm"`] : [];
  const head = [
    'xmlns="http://www.w3.org/2000/svg"',
    'xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"',
    ...size,
    `viewBox="${n(minX)} ${n(minY)} ${n(width)} ${n(height)}"`,
    'role="img"',
  ];
  const desc = model.toScale || !model.notice ? "" : `<desc>${escapeXml(model.notice)}</desc>`;
  const layers = model.layers.map((layer) => layerElement(layer, images)).join("");
  return `<svg ${head.join(" ")}><title>${escapeXml(model.description)}</title>${desc}${layers}</svg>`;
}

const SVG_DATA_PREFIX = "data:image/svg+xml;charset=utf-8,";

/**
 * An address that an image tag can show. A drawing shown this way is treated as a picture
 * and not as a page, so nothing inside it can run, even if it were hostile.
 */
export const svgDataUri = (svg: string): string => `${SVG_DATA_PREFIX}${encodeURIComponent(wellFormed(svg))}`;
