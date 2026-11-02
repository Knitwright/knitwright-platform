import { join } from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * The font the PDF draws text in. The file ships with the app under assets/fonts, and the
 * host must copy it with the function (see outputFileTracingIncludes in next.config.ts).
 * Geist is licensed under the SIL Open Font License 1.1, which allows embedding it in PDFs.
 */
export const PDF_FONT_FAMILY = "Geist";
export const PDF_FONT_FILE = join(process.cwd(), "assets", "fonts", "Geist-Regular.ttf");

/**
 * The font the Urdu pages of a tech pack are set in (plan v5 O3, decision 0104).
 *
 * Noto Naskh Arabic, licensed under the SIL Open Font License 1.1, which allows embedding it in a PDF.
 * It is a Naskh face: it shapes Urdu correctly and is legible, but it is not the Nastaliq style an Urdu
 * reader expects for running text. Noto Nastaliq Urdu, also under the OFL, is the face that style calls
 * for and it cannot be used here: `fontkit@2.0.4`, which the PDF library lays text out with, throws
 * while placing that font's mark anchors ("Cannot read properties of null (reading 'xCoordinate')" in
 * GPOSProcessor), so a document set in it has no pages at all. Shipping Naskh is the honest second
 * choice: it renders, and the decision record carries the owner question about Nastaliq.
 */
export const PDF_URDU_FONT_FAMILY = "Noto Naskh Arabic";
export const PDF_URDU_FONT_FILE = join(process.cwd(), "assets", "fonts", "NotoNaskhArabic-Regular.ttf");

const registered = new Set<string>();

const register = (family: string, src: string): void => {
  if (registered.has(family)) return;
  Font.register({ family, src });
  registered.add(family);
};

/** Registers the font once. It is safe to call before every render. */
export function registerPdfFont(): void {
  register(PDF_FONT_FAMILY, PDF_FONT_FILE);
}

/**
 * Registers the Urdu font once, beside the Latin one. Both are needed for an Urdu document: the pages
 * are set in the Urdu face, and the garment drawing keeps its own labels in the Latin one.
 */
export function registerPdfUrduFont(): void {
  registerPdfFont();
  register(PDF_URDU_FONT_FAMILY, PDF_URDU_FONT_FILE);
}
