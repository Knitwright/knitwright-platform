import { renderSvg, svgDataUri } from "@/lib/flat/render-svg";
import { completenessReport } from "@/lib/techpack/completeness";
import type { OpenProject } from "@/lib/projects/service";
import { buildPackFor } from "@/lib/projects/tech-pack-data";
import type { ChartSet } from "@/lib/sizing";

/**
 * What a design's card on the studio home shows of its content: a small drawing of the front,
 * and how many fields of its factory file are empty. The count is made by the same function the
 * factory file page uses, so the two never disagree. Pictures in the artwork are not read for
 * the card, so the drawing marks where they go.
 *
 * The front and back flats of the file are not drawn: nothing counted is read from a drawing.
 * The card's picture is the file's own drawing of the first colourway, so it is drawn once.
 */

export interface Thumbnail {
  /** A data address for an image tag, so nothing in the drawing can run. */
  readonly src: string;
}

export interface CardFacts {
  readonly toConfirm: number;
  /** Null when the garment type has no drawing. */
  readonly thumbnail: Thumbnail | null;
}

export function cardFacts(project: OpenProject, brandName: string, charts: ChartSet, now: Date): CardFacts {
  const pack = buildPackFor(
    { project, history: { versions: [], hasMore: false }, brandName, now, charts },
    { drawFlats: false },
  );
  const front = pack.colourways.colourways[0]?.drawing.model;
  return {
    toConfirm: completenessReport(pack).total,
    thumbnail: front ? { src: svgDataUri(renderSvg(front)) } : null,
  };
}
