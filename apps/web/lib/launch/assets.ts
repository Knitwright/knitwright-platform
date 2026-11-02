import { isGeneratedKind, LAUNCH_GAP_RULE, type BoardKind, type OutputRole } from "./boards";

/**
 * THE GARMENT LOCK, AS A TYPE (spec decision 13, principle 4; plan v5 wave 4 preamble).
 *
 * Every picture of the garment starts from the deterministic render or from the golden-sample
 * photo. A model may change the scene, the light, the pose and the camera; it may never draw the
 * garment, and what it produces may never become a layer on a panel or part of a print file.
 *
 * The shell makes that structural in three places, and this file is the first:
 *
 *   * a generated asset has no `role` other than `"scene"`, so **no generated asset can be typed
 *     as a panel layer or a print file**. A workstream that tries writes code that does not
 *     compile, rather than code that fails a review;
 *   * `acceptAsset` refuses at runtime as well, because a panel may hand the shell a value that
 *     came from the database or from a service and so was never checked by the compiler;
 *   * the migration's `boards_generated_output_is_never_artwork` constraint refuses the same row.
 *
 * Nothing here decides whether a picture is accurate: `lib/media-check` does that, and L3 and L5
 * call it on every result. This file decides only what a picture is *allowed to be used as*.
 */

/**
 * Where a picture came from. A picture with no provenance is not an asset and cannot be made one.
 *
 * Three of these four are the file's own, read from `public.files.provenance`
 * (`lib/storage/provenance.ts`) and never from a request body: the v5 security review's H1 found
 * that `provenance` was a `z.enum` the client sent, and that `public.files` held nothing that could
 * answer instead. `golden_sample` is the one that is not a property of the file: a photograph
 * becomes a golden sample's when it is attached to one, which `golden_sample_photos` records and
 * `add_golden_sample_photo` now refuses to do for anything a model made.
 */
export const PROVENANCES = ["deterministic", "uploaded", "golden_sample", "generated"] as const;
export type AssetProvenance = (typeof PROVENANCES)[number];

/** A file in our own storage. No bytes cross this seam, as with the files-service contract. */
export interface AssetFile {
  readonly fileId: string;
  readonly contentType: string;
}

/**
 * Scenery: a picture or clip a model produced. Its only role is `"scene"`, and it carries the
 * label the spec requires on everything a model made ("AI-generated", F-L1 and F-L3 rules).
 */
export interface SceneAsset {
  readonly role: "scene";
  readonly provenance: "generated";
  readonly file: AssetFile;
  readonly label: typeof GENERATED_LABEL;
  /** True when a person is in the picture, which the spec labels more strictly again. */
  readonly showsPerson: boolean;
}

/**
 * A picture the platform drew, one the brand supplied, or the photograph of a signed-off golden
 * sample. What these three have in common is the only thing the lock asks: no model made them.
 */
export interface DrawnAsset {
  readonly role: "scene" | "panel_layer" | "print_file";
  readonly provenance: "deterministic" | "uploaded" | "golden_sample";
  readonly file: AssetFile;
}

/**
 * Everything a panel may hand the shell. A generated picture is a `SceneAsset`, and a `SceneAsset`
 * has no role but `"scene"`: the union itself is the lock.
 */
export type LaunchAsset = SceneAsset | DrawnAsset;

/** The words the spec puts on anything a model made (F-L3), and on a person it drew (F-L1). */
export const GENERATED_LABEL = "AI-generated";
export const GENERATED_PERSON_LABEL = "AI-generated model";

/** The label to show beside an asset, or null for a picture the platform drew itself. */
export function assetLabel(asset: LaunchAsset): string | null {
  if (asset.provenance !== "generated") return null;
  return asset.showsPerson ? GENERATED_PERSON_LABEL : GENERATED_LABEL;
}

export type AssetVerdict =
  | Readonly<{ accepted: true; role: OutputRole }>
  | Readonly<{ accepted: false; reason: string; ruleId: string }>;

const ROLE_OF: Readonly<Record<LaunchAsset["role"], OutputRole>> = {
  scene: "asset",
  panel_layer: "panel_layer",
  print_file: "print_file",
};

/**
 * Whether the shell may record this asset as the board's output.
 *
 * Refused when the asset came out of a model and the board is one the platform draws itself (the
 * two must never be mixed up), when a generated picture is offered as artwork, and when a board
 * the platform draws is handed a picture with no provenance the platform can vouch for.
 */
export function acceptAsset(kind: BoardKind, asset: LaunchAsset): AssetVerdict {
  const role = ROLE_OF[asset.role];
  if (asset.provenance === "generated") {
    if (!isGeneratedKind(kind)) {
      return {
        accepted: false,
        reason: `A ${kind.replaceAll("_", " ")} board shows what the platform drew, so it cannot hold a generated picture.`,
        ruleId: LAUNCH_GAP_RULE,
      };
    }
    // Unreachable through the type system; kept because a panel may pass a value read from the
    // database, which the compiler never saw. The test proves both doors are shut.
    if (role !== "asset") {
      return { accepted: false, reason: "A generated picture never becomes a layer on the garment or part of a print file.", ruleId: LAUNCH_GAP_RULE };
    }
    return { accepted: true, role };
  }
  if (isGeneratedKind(kind)) {
    return { accepted: false, reason: "An AI board holds what the model produced, not a drawn picture.", ruleId: LAUNCH_GAP_RULE };
  }
  // Every kind left is one the platform draws itself, so `canBeArtwork` holds and the asset may
  // take any of the three roles.
  return { accepted: true, role };
}

/**
 * WHAT A PANEL OFFERS, AND WHERE ITS PROVENANCE COMES FROM (security review v5 H1, decision 0116).
 *
 * A panel says which file it produced and what it wants that file used as. It does **not** say what
 * made the file: the server reads that from the file's own row, because a body is a thing a person
 * can write. `lib/launch/schemas.ts` therefore has no `provenance` field at all, and
 * `garment-lock-provenance.test.ts` fails if one ever comes back.
 */
export interface AssetOffer {
  readonly role: LaunchAsset["role"];
  readonly file: AssetFile;
  /** True when a person is in the picture. Only meaningful for a picture a model made. */
  readonly showsPerson: boolean;
}

/**
 * The asset an offer becomes, once the file's own provenance is known.
 *
 * There is no cast here, and that is the point. The old `assetFrom` in `lib/launch/actions.ts`
 * asserted `as LaunchAsset` on purpose, on the premise that `acceptAsset` would refuse an asset the
 * type system could not describe -- and `acceptAsset` only entered its refusal branch when the body
 * *admitted* `"generated"`. A generated file is now given the role `"scene"` outright, so the
 * `SceneAsset` that comes out is one the compiler can check, and `acceptAsset` is still asked
 * afterwards about the board it is going on.
 */
export function assetOffered(offer: AssetOffer, provenance: AssetProvenance): LaunchAsset {
  if (provenance === "generated") {
    return { role: "scene", provenance, file: offer.file, label: GENERATED_LABEL, showsPerson: offer.showsPerson };
  }
  return { role: offer.role, provenance, file: offer.file };
}

/**
 * Whether this board may record this offer, given what really made the file.
 *
 * Two questions, in this order, so a person is told the useful one first: did they ask a board the
 * platform draws to hold a picture a model made, and did they ask for a role that picture may never
 * have? `acceptAsset` answers both, and the role it hands back is the one to write down.
 */
export function acceptOffer(kind: BoardKind, offer: AssetOffer, provenance: AssetProvenance): AssetVerdict {
  if (provenance === "generated" && offer.role !== "scene" && !isGeneratedKind(kind)) {
    return {
      accepted: false,
      reason: `A ${kind.replaceAll("_", " ")} board shows what the platform drew, so it cannot hold a generated picture.`,
      ruleId: LAUNCH_GAP_RULE,
    };
  }
  if (provenance === "generated" && offer.role !== "scene") {
    return { accepted: false, reason: "A generated picture never becomes a layer on the garment or part of a print file.", ruleId: LAUNCH_GAP_RULE };
  }
  return acceptAsset(kind, assetOffered(offer, provenance));
}
