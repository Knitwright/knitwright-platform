import type { ImageMap } from "@/lib/flat/images";
import { panelsFor } from "@/lib/garment";
import type { GarmentSpec } from "@/lib/garment";
import { formatDate } from "@/lib/projects/dates";
import { flatPreview, type FlatPreviewData } from "@/lib/projects/flat-preview";
import type { ChartSet } from "@/lib/sizing";
import { ONE_VERSION_NOTE, slotLabel, type CommitteeSlot } from "./fields";
import type { PointBounds } from "./points";

/**
 * What a committee page shows, and nothing more (spec F-T3, plan v5 Z7, decision 0087).
 *
 * Each option is one saved version, drawn by the same renderer the editor uses, which gives both
 * the pictures and the outline the read-only 3D view is built from. A visitor sees the design's
 * name, the club's name, the drawings and the panels they can pin a comment to. No measurements,
 * no construction, no labels, no components, no notes, no files, no other versions, no style number
 * and no season: the same list a share page withholds (decision 0026).
 */

export interface CommitteePanel {
  readonly id: string;
  readonly label: string;
}

export interface CommitteeOption {
  readonly slot: CommitteeSlot;
  readonly label: string;
  readonly version: number;
  readonly savedOn: string;
  readonly isCurrent: boolean;
  /** The drawings and the outline the 3D view is made from, or null for a type with no drawing. */
  readonly preview: FlatPreviewData | null;
  /** The size of the front drawing in millimetres, which a pin's distances are measured against. */
  readonly bounds: PointBounds;
  /** The panels a pin may be put on. */
  readonly panels: readonly CommitteePanel[];
  /** True when the club has locked this version: the committee is looking at a settled choice. */
  readonly locked: boolean;
}

export interface CommitteePageInput {
  readonly projectName: string;
  readonly brandName: string;
  readonly expiresAt: string;
  readonly lockedVersion: number | null;
  readonly options: readonly Readonly<{
    slot: CommitteeSlot;
    version: number;
    savedAt: string;
    isCurrent: boolean;
    spec: GarmentSpec;
    images: ImageMap;
    picturesNote: string | null;
  }>[];
  readonly charts?: ChartSet;
}

export interface CommitteePageData {
  readonly designName: string;
  readonly brandName: string;
  readonly expiresOn: string;
  readonly options: readonly CommitteeOption[];
  /** One line when there is nothing to choose between, otherwise null. */
  readonly oneOptionNote: string | null;
  /** One line when a version is already locked, otherwise null. */
  readonly lockedNote: string | null;
}

/** The size of a drawing in millimetres. A drawing that could not be made has no size. */
const boundsOf = (preview: FlatPreviewData | null): PointBounds => {
  const front = preview?.shape.front.bounds;
  if (!front) return { widthMm: 0, heightMm: 0 };
  return { widthMm: Math.max(0, front.maxX - front.minX), heightMm: Math.max(0, front.maxY - front.minY) };
};

const optionOf = (option: CommitteePageInput["options"][number], charts: ChartSet | undefined, lockedVersion: number | null): CommitteeOption => {
  const preview = flatPreview(option.spec, option.images, charts, option.picturesNote);
  return {
    slot: option.slot,
    label: slotLabel(option.slot),
    version: option.version,
    savedOn: formatDate(option.savedAt),
    isCurrent: option.isCurrent,
    preview,
    bounds: boundsOf(preview),
    panels: panelsFor({ typeId: option.spec.typeId, options: option.spec.options }).map((panel) => ({ id: panel.id, label: panel.label })),
    locked: lockedVersion !== null && lockedVersion === option.version,
  };
};

/** What a version that is already locked tells a committee, in plain words. */
export const lockedNote = (version: number): string =>
  `The club has already locked version ${version}. You can still read the comments, but the choice is made.`;

export function buildCommitteePage(input: CommitteePageInput): CommitteePageData {
  const options = input.options.map((option) => optionOf(option, input.charts, input.lockedVersion));
  return {
    designName: input.projectName,
    brandName: input.brandName,
    expiresOn: formatDate(input.expiresAt),
    options,
    oneOptionNote: options.length === 1 ? ONE_VERSION_NOTE : null,
    lockedNote: input.lockedVersion === null ? null : lockedNote(input.lockedVersion),
  };
}
