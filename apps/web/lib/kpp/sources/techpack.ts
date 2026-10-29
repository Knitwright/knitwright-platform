import type { ImageMap } from "@/lib/flat/images";
import { buildPdf } from "@/lib/techpack/exports/pdf/document";
import type { TechPack } from "@/lib/techpack/types";
import type { TechPackPdfSource } from "../model";

/**
 * `01_techpack/techpack.pdf` from the tech pack generator the platform already has
 * (decision 0011, `lib/techpack/exports`), so the PDF in the package and the one a member
 * downloads cannot disagree. The assembler pins its dates afterwards (`pdf/pin.ts`), because
 * @react-pdf/renderer writes the clock into every file it makes.
 *
 * This module is imported only by the code that builds a package, never from a `lib/kpp` index
 * and never from a component: importing it pulls @react-pdf/renderer in, which decision 0011
 * keeps out of any page bundle.
 */
export const techPackPdfSource = (pack: TechPack, images: ImageMap): TechPackPdfSource => ({
  pdf: () => buildPdf(pack, images),
});
