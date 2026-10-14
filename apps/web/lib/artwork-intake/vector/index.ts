import { ARTWORK_LIMITS } from "../limits";
import { Budget } from "./budget";
import { reencodeImages } from "./images";
import { type VectorDoc, vectorDocSchema } from "./model";
import { refuse, REFUSALS } from "./refuse";
import { renderVectorPreview } from "./render";
import { pdfToVector } from "./pdf";
import { svgToVector } from "./svg";

export { vectorDocSchema, type VectorDoc } from "./model";
export { vectorToSvg } from "./render";

export type VectorIntake = Readonly<{
  doc: VectorDoc;
  /** The model as JSON: this is what is stored. The original file is not. */
  json: Buffer;
  /** A PNG of the drawing, for browsers. */
  preview: Buffer;
  /** The drawing's size in CSS pixels, kept inside what the records allow. */
  widthPx: number;
  heightPx: number;
  warnings: readonly string[];
}>;

const CSS_PX_PER_POINT = 96 / 72;

const clampEdge = (value: number): number => Math.max(1, Math.min(ARTWORK_LIMITS.maxEdge, Math.round(value)));

/**
 * Reduces an uploaded SVG (or the first page of a PDF) to the restricted vector model and a preview picture. The upload itself is
 * never kept: only the JSON and the preview are.
 */
export async function intakeVector(bytes: Uint8Array, format: "svg" | "pdf"): Promise<VectorIntake> {
  const budget = new Budget();
  const read = format === "svg" ? svgToVector(bytes, budget) : await pdfToVector(bytes, budget);
  const doc = vectorDocSchema.parse(await reencodeImages(read));
  const json = Buffer.from(JSON.stringify(doc), "utf8");
  if (json.length > ARTWORK_LIMITS.vector.maxJsonBytes) refuse(REFUSALS.tooBig(ARTWORK_LIMITS.vector.maxJsonBytes / 1024));
  const preview = await renderVectorPreview(doc);
  const scale = format === "svg" ? 1 : CSS_PX_PER_POINT;
  return {
    doc,
    json,
    preview,
    widthPx: clampEdge(doc.viewBox.width * scale),
    heightPx: clampEdge(doc.viewBox.height * scale),
    warnings: doc.warnings,
  };
}
