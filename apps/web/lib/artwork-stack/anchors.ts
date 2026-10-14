import { z } from "zod";
import { LANDMARK_IDS, type LandmarkId } from "@/lib/production/contract";

/** The views of a garment, each a flat-lay plane in design space. Bottoms add leg views later. */
export const VIEW_IDS = ["front", "back", "sleeve-left", "sleeve-right", "collar"] as const;
export const viewIdSchema = z.enum(VIEW_IDS);
export type ViewId = z.output<typeof viewIdSchema>;

/** The named places on a pattern piece (the W0 landmark names). A view's anchors are some of these. */
export const ANCHOR_IDS: readonly LandmarkId[] = LANDMARK_IDS;

export const VIEW_ANCHORS: Readonly<Record<ViewId, readonly LandmarkId[]>> = {
  front: ["hps", "shoulder-point", "underarm", "cf-neck", "cf-hem", "side-hem"],
  back: ["hps", "shoulder-point", "underarm", "cb-neck", "cb-hem", "side-hem"],
  "sleeve-left": ["cap-top", "underarm-a", "underarm-b", "hem-a", "hem-b"],
  "sleeve-right": ["cap-top", "underarm-a", "underarm-b", "hem-a", "hem-b"],
  collar: ["cf-neck", "cb-neck"],
};

/** True when this name is a landmark of the view. Other anchor names, such as a panel's "centre-chest", are still accepted in a stack. */
export const isLandmarkOf = (view: ViewId, anchorId: string): boolean => (VIEW_ANCHORS[view] as readonly string[]).includes(anchorId);

/** The view a garment panel is drawn in. A panel the model does not know is drawn on the front. */
export function viewOfPanel(panelId: string): ViewId {
  if (panelId === "sleeve-left" || panelId === "sleeve-right" || panelId === "collar") return panelId;
  return panelId.endsWith("-back") ? "back" : "front";
}
