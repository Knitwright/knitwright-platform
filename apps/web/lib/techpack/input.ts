import type { FlatModel, View } from "@/lib/flat/model";
import type { GarmentSpec } from "@/lib/garment";
import type { ChartSet } from "@/lib/sizing";

/** The most revisions the cover lists. Older ones are named in a line, not listed. */
export const REVISIONS_SHOWN = 8;

/** One saved version of the design, as the history gives it. The date is printed as it is. */
export interface RevisionInput {
  readonly version: number;
  readonly date: string;
  readonly note: string;
  /** Who made the change, or null when it was not recorded. */
  readonly by: string | null;
}

/**
 * Everything the tech pack is built from. Nothing here is read from a clock, a database
 * or the network: the caller passes the dates, the history and the drawings in.
 */
export interface TechPackInput {
  readonly project: {
    readonly name: string;
    readonly styleNumber: string;
    readonly season: string;
    readonly brandName: string;
  };
  /** The version of the design this document is made from, and the date it was saved. */
  readonly version: number;
  readonly versionDate: string;
  /** The date to print on the document. */
  readonly printedOn: string;
  /** The saved versions, in any order. The cover sorts them newest first. */
  readonly history: readonly RevisionInput[];
  readonly spec: GarmentSpec;
  readonly charts?: ChartSet;
  /** The drawings to show, front and back. Build them with `flatsForTechPack` to match the table. */
  readonly flats: Readonly<Record<View, FlatModel | null>>;
}
