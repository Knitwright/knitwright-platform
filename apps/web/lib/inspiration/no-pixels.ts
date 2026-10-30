import type { GarmentSpec } from "@/lib/garment";
import type { DesignDiff } from "@/lib/design-diff/diff";
import { SUGGESTION_DIFF_KINDS, type SuggestionDiff } from "./suggest/to-diffs";

/**
 * The rule this workstream exists to keep (plan v5: "AI never draws the garment", spec decision 13, F-S1 acceptance:
 * "No third-party image is ever written to a panel layer or a print file").
 *
 * The rule is kept by construction, in three places, and `no-pixels.test.ts` proves each one:
 *  1. a suggestion may only ever be one of three design diffs, and none of the three can name a file, an asset or an
 *     address — so applying any number of suggestions cannot change which pictures a design uses;
 *  2. a moodboard item holds an address, a preview and an attribution, and no field a picture could hide in;
 *  3. an AI mood image is never stored at all, so it has no address a layer could point at.
 *
 * `pictureRefsOf` is the measure: every way a picture can reach a panel in the stored design object. A suggestion is
 * only ever offered when this list is the same before and after.
 */

/** Every picture a design uses, as the ids the design object holds, sorted so two designs compare by value. */
export function pictureRefsOf(spec: GarmentSpec): readonly string[] {
  const refs: string[] = [];
  for (const art of spec.artwork) if (art.source.kind === "file") refs.push(`artwork:${art.source.fileId}`);
  for (const layer of spec.artworkStack?.layers ?? []) {
    if (layer.kind === "image-fill") refs.push(`image-fill:${layer.assetId}`);
    if (layer.kind === "graphic") refs.push(layer.source.kind === "asset" ? `graphic:${layer.source.assetId}` : `graphic:${layer.source.fileId}`);
  }
  return refs.sort();
}

/** True when a diff is one of the three kinds a suggestion may use. */
export const isSuggestionDiff = (diff: DesignDiff): diff is SuggestionDiff =>
  (SUGGESTION_DIFF_KINDS as readonly string[]).includes(diff.kind);

/** What went wrong, or null when a change kept the rule. */
export type PixelBreach = Readonly<{ reason: string }>;

/**
 * Checks one applied change: the patch is one of the three kinds, and the design uses exactly the pictures it used
 * before. The apply path calls this with the design before and after, and refuses the save on a breach.
 */
export function pixelBreach(before: GarmentSpec, after: GarmentSpec, diff: DesignDiff): PixelBreach | null {
  if (!isSuggestionDiff(diff)) return { reason: `A suggestion from an inspiration card can never be a "${diff.kind}" change.` };
  const was = pictureRefsOf(before);
  const now = pictureRefsOf(after);
  if (was.length !== now.length || was.some((ref, at) => ref !== now[at])) {
    return { reason: "A suggestion from an inspiration card can never change which pictures a design uses." };
  }
  if ((before.artworkStack?.layers.length ?? 0) !== (after.artworkStack?.layers.length ?? 0)) {
    return { reason: "A suggestion from an inspiration card can never add or remove a layer." };
  }
  return null;
}
