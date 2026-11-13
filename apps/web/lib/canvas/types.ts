/** What a garment board draws of its design (decision 0145), read on the server by `server.ts`. */
export interface GarmentPreview {
  readonly designProjectId: string;
  readonly name: string;
  /** The design's current spec version: a garment board is live-linked. */
  readonly version: number;
  /** The front flat as a picture address, or null when the design has no drawing yet. */
  readonly src: string | null;
  readonly alt: string;
  /** The last validation of this version, as the editor ran it, with how many checks failed; null when none is stored. */
  readonly checks: Readonly<{ passed: boolean; count: number }> | null;
}
