import { renderSvg, svgDataUri } from "@/lib/flat/render-svg";
import { completenessReport } from "@/lib/techpack/completeness";
import { colourwayDrawing } from "@/lib/techpack/flats";
import type { OpenProject } from "@/lib/projects/service";
import { buildPackFor } from "@/lib/projects/tech-pack-data";
import type { ChartSet } from "@/lib/sizing";

/**
 * What a design's card on the studio home shows of its content: a small drawing of the front,
 * and how many fields of its factory file are empty. The count is made by the same function the
 * factory file page uses, so the two never disagree. Pictures in the artwork are not read for
 * the card, so the drawing marks where they go.
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
  const pack = buildPackFor({ project, history: { versions: [], hasMore: false }, brandName, images: new Map(), now, charts });
  const first = project.spec.colourways[0];
  const front = first ? colourwayDrawing(project.spec, first.id, charts) : null;
  return {
    toConfirm: completenessReport(pack).total,
    thumbnail: front?.model ? { src: svgDataUri(renderSvg(front.model)) } : null,
  };
}
