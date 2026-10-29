import type { KppInput } from "../model";
import { jpegInfo, type PdfImage } from "../pdf/writer";
import { flow } from "./documents";

export const RENDER_LABEL = "Render, not photo.";
export const NO_RENDER = "No deterministic render is available for this design yet. The technical flats in the tech pack show the garment.";

const image = (name: string, jpeg: Uint8Array): PdfImage => ({ name, jpeg, ...jpegInfo(jpeg) });

/** The front and back renders, each labelled "Render, not photo". Without renders the page says so plainly. */
export function rendersPdf(input: KppInput, renders: Readonly<{ front: Uint8Array; back: Uint8Array }> | null): Uint8Array {
  const doc = flow(input, "Renders").heading("Front and back renders");
  if (renders === null) return doc.paragraph(NO_RENDER).paragraph(RENDER_LABEL, { muted: true }).build();
  return doc
    .picture(image("Front", renders.front), 110, `Front. ${RENDER_LABEL}`)
    .picture(image("Back", renders.back), 110, `Back. ${RENDER_LABEL}`)
    .build();
}
