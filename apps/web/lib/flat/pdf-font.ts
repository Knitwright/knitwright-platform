import { join } from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * The font the PDF draws text in. The file ships with the app under assets/fonts, and the
 * host must copy it with the function (see outputFileTracingIncludes in next.config.ts).
 * Geist is licensed under the SIL Open Font License 1.1, which allows embedding it in PDFs.
 */
export const PDF_FONT_FAMILY = "Geist";
export const PDF_FONT_FILE = join(process.cwd(), "assets", "fonts", "Geist-Regular.ttf");

let registered = false;

/** Registers the font once. It is safe to call before every render. */
export function registerPdfFont(): void {
  if (registered) return;
  Font.register({ family: PDF_FONT_FAMILY, src: PDF_FONT_FILE });
  registered = true;
}
