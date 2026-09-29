/** Test support shared by the PDF tests. Nothing here is used by the app. */
import { PROVENANCE_LABELS, applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { fullDesign } from "../../fixtures/designs";
import { PROPOSAL_WORDS } from "../../text";
import type { ImageMap } from "@/lib/flat/images";
import type { TechPack } from "../../types";
import { buildPdf, type PdfOptions } from "../pdf/document";
import { readPages, type ReadPage } from "./pdf-pages";

export const noSpace = (text: string): string => text.replace(/\s+/g, "");

/** What a set cell prints in the PDF. */
export const printed = (cell: Record<string, unknown>): string => {
  if (typeof cell.tenthsMm === "number") return `${cell.value} cm`;
  if (typeof cell.iso === "string") return `${cell.value}, ISO ${cell.iso}`;
  return cell.value as string;
};

/** The words for where a set cell came from. */
export const sourceOf = (cell: Record<string, unknown>): string =>
  cell.proposal === true ? PROPOSAL_WORDS : PROVENANCE_LABELS[cell.provenance as keyof typeof PROVENANCE_LABELS];

interface Built {
  readonly bytes: Uint8Array;
  /** What the PDF library warned about while it made the file. A warning means something was cut off or lost. */
  readonly warnings: readonly string[];
}

/** Making a PDF is the slow part of these tests, so a file made from the same input is made once for each test file. */
const made = new Map<string, Promise<Built>>();

const keyOf = (pack: TechPack, images: ImageMap, options: PdfOptions): string =>
  JSON.stringify([pack, [...images.keys()], options.pictureLeftOut === true]);

async function build(pack: TechPack, images: ImageMap, options: PdfOptions): Promise<Built> {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
  };
  try {
    return { bytes: await buildPdf(pack, images, options), warnings };
  } finally {
    console.warn = original;
  }
}

export const readPdfOf = async (
  pack: TechPack,
  images: ImageMap = new Map(),
  options: PdfOptions & { readonly operations?: boolean } = {},
): Promise<{ bytes: Uint8Array; pages: readonly ReadPage[]; warnings: readonly string[] }> => {
  const key = keyOf(pack, images, options);
  const cached = made.get(key) ?? build(pack, images, options);
  made.set(key, cached);
  const { bytes, warnings } = await cached;
  return { bytes, warnings, pages: await readPages(bytes, { operations: options.operations === true }) };
};

/**
 * A full design with these texts spread over the fields a person types into. A change the design
 * rules refuse, such as text with a line break in a one-line field, is left out.
 */
export function designWithTexts(texts: readonly string[]): GarmentSpec {
  const at = (index: number): string => texts[index % texts.length] ?? "";
  const steps: SpecAction[] = [
    ...(["care", "composition", "origin", "fold", "bag"] as const).map(
      (field, index): SpecAction => ({ type: "set-labelling", field, text: at(index), provenance: "user-edited" }),
    ),
    {
      type: "add-artwork",
      artwork: { id: "h", name: at(5), source: { kind: "text", text: at(6) }, panelId: "body-front", anchor: "left-chest", offsetX: 0, offsetY: 0, width: 500, height: 500, rotationDegrees: 0, technique: "embroidery", provenance: "user-edited" },
    },
    {
      type: "update-fabric",
      fabric: { id: "main", name: at(7), composition: at(8), construction: at(9), weightGsm: 150, finish: at(10), consumption: at(11), stretch: "none", provenance: "user-edited", sources: {} },
    },
    { type: "update-colourway", colourway: { id: "main", name: at(12), colours: [{ panelId: "body-front", colour: at(13), swatch: "#112233", provenance: "user-edited" }] } },
  ];
  return steps.reduce((spec, step) => {
    const result = applyAction(spec, step);
    return result.ok ? result.spec : spec;
  }, fullDesign("crew-tee"));
}
