import type { ImageMap } from "@/lib/flat/images";
import { renderSvg } from "@/lib/flat/render-svg";
import type { View } from "@/lib/flat/model";
import type { TechPack } from "../types";
import { NoDrawing } from "./errors";
import { assertEverySetCellHasSource } from "./guard";
import { PICTURE_LEFT_OUT } from "./limits";

const DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

interface SvgOptions {
  /** True when a picture was left out for size, so the file says so in words. */
  readonly pictureLeftOut?: boolean;
}

/**
 * The SVG file of one view: the drawing as it is on the tech pack, with its callouts and its
 * named layers, after an XML declaration. A garment type with no drawing has nothing to export.
 */
export function buildSvg(pack: TechPack, view: View, images: ImageMap, options: SvgOptions = {}): string {
  assertEverySetCellHasSource(pack);
  const model = pack.flats.views.find((entry) => entry.view === view)?.model ?? null;
  if (model === null) throw new NoDrawing();
  const drawing = renderSvg(model, images);
  const body = drawing.startsWith("<?xml") ? drawing.slice(drawing.indexOf("?>") + 2).trimStart() : drawing;
  const note = options.pictureLeftOut ? `<!-- ${PICTURE_LEFT_OUT} -->\n` : "";
  return `${DECLARATION}\n${note}${body}`;
}
