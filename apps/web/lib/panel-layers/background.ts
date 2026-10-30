/**
 * "Remove background" on the Edit Graphic panel (spec F-S4), as a provider interface with a
 * stand-in (plan v5 Y3, decision 0076; plan rule "No live paid call from tests or your own run").
 *
 * Cutting a background out of a picture is a paid model call, so it is an interface here and
 * nothing more. The stand-in refuses, costs nothing, and is the only implementation in the tree. A
 * real adapter would live behind an env key, be metered, and still never be called from CI.
 *
 * What comes back is never drawn on a panel. A provider returns a **new asset** for the brand's
 * uploads, which the graphic layer then points at; the model's output never becomes pixels on the
 * garment by itself (spec decision 13, "AI never draws the garment"). This file deliberately has no
 * way to hand back an image: the only success it can express is the id of a stored asset.
 */

export interface RemoveBackgroundRequest {
  /** The uploaded asset to cut out. */
  readonly assetId: string;
  /** The design the request is for, so the call can be metered against the right brand. */
  readonly projectId: string;
}

export type RemoveBackgroundResult =
  | { readonly ok: true; readonly assetId: string; readonly note: string }
  | { readonly ok: false; readonly reason: string };

export interface BackgroundRemovalProvider {
  readonly id: string;
  /** The cost in credits, so the gate can be shown before anything is spent. Null while no price is set. */
  readonly credits: number | null;
  remove(request: RemoveBackgroundRequest): Promise<RemoveBackgroundResult>;
}

export const NOT_AVAILABLE =
  "Removing a background needs a picture service Knitwright has not wired up yet, so nothing was changed. Upload the artwork with a transparent background instead.";

/** The only implementation in the tree: it refuses, and makes no call of any kind. */
export const standInBackgroundRemoval: BackgroundRemovalProvider = {
  id: "stand-in",
  credits: null,
  remove: async () => ({ ok: false, reason: NOT_AVAILABLE }),
};

export const CONVERT_NOT_AVAILABLE =
  "Turning a graphic into a pattern fill is the repeat maker's job (built by workstream Y8). Until it lands, publish a tile there and pick it from Your library.";
