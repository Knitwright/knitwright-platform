/** Test support shared by the PDF tests. Nothing here is used by the app. */
import { applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { sourceLabel, type SetCell } from "../../cell";
import { fullDesign } from "../../fixtures/designs";
import type { ImageMap } from "@/lib/flat/images";
import type { TechPack } from "../../types";
import { buildPdf, type PdfOptions } from "../pdf/document";
import { SOURCES_AND_NOTES } from "../pdf/appendix";
import { readPages, type ReadPage } from "./pdf-pages";
import { drawable } from "../pdf-text";

export const noSpace = (text: string): string => text.replace(/\s+/g, "");

/** What a set cell prints in the PDF. */
export const printed = (cell: Record<string, unknown>): string => {
  if (typeof cell.tenthsMm === "number") return `${cell.value} cm`;
  if (typeof cell.iso === "string") return `${cell.value}, ISO ${cell.iso}`;
  return cell.value as string;
};

/** The words for where a set cell came from. */
export const sourceOf = (cell: Record<string, unknown>): string =>
  sourceLabel(cell as unknown as SetCell);

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The mark the PDF gives a source, read from its "Sources and notes" key, where each mark is
 * printed before the words of its source. The text is read with the spaces taken out.
 */
export function markOf(squashed: string, words: string): string | undefined {
  const key = squashed.slice(squashed.lastIndexOf(noSpace(SOURCES_AND_NOTES)));
  return new RegExp(`\\[(\\d+)\\]${escapeRegExp(noSpace(words))}`).exec(key)?.[1];
}

/**
 * What a set cell prints in the PDF, with the spaces taken out: its value made drawable, then the
 * mark of its source. The words of the mark are in the key at the end, read from the same text.
 */
export function withMark(squashed: string, cell: Record<string, unknown>): string {
  const mark = markOf(squashed, sourceOf(cell));
  if (mark === undefined) throw new Error(`The key has no mark for "${sourceOf(cell)}".`);
  return noSpace(`${drawable(printed(cell))}[${mark}]`);
}

interface Built {
  readonly bytes: Uint8Array;
  /** What the PDF library warned about while it made the file. A warning means something was cut off or lost. */
  readonly warnings: readonly string[];
}

/** Making a PDF is the slow part of these tests, so a file made from the same input is made once for each test file. */
const made = new Map<string, Promise<Built>>();

const keyOf = (pack: TechPack, images: ImageMap, options: PdfOptions): string =>
  JSON.stringify([pack, [...images.keys()], options.pictureLeftOut === true, options.illustrations ?? null]);

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
