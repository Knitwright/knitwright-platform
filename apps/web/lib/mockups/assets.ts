import { acceptAsset, type AssetFile, type DrawnAsset, type LaunchAsset } from "@/lib/launch/assets";

/**
 * What this workstream may hand the launch shell (spec decision 13; decision 0091 point 1).
 *
 * **Nothing here calls a model, so nothing here can produce a generated picture.** The two
 * provenances the mockup studio can honestly claim are `deterministic` (the platform drew it from
 * the design) and `golden_sample` (a photograph of a sample somebody signed off), and both of them
 * are `DrawnAsset`s. `SceneAsset`, the only shape a generated picture has, is not constructed
 * anywhere in `lib/mockups` or `components/mockups`, and `assets.test.ts` is the test the rule asks
 * for: it casts past the compiler, hands this file a generated picture anyway, and watches it
 * refused.
 *
 * "Convert to image" (F-L1's Flatten) is the one place a mockup becomes an asset, and it goes
 * through `drawnAsset` so the role can only be one a drawn picture is allowed to take.
 */

export const MOCKUP_PROVENANCES = ["deterministic", "golden_sample"] as const;
export type MockupProvenance = (typeof MOCKUP_PROVENANCES)[number];

/** The words shown when something tried to make a model's picture into a mockup. */
export const GENERATED_REFUSED = "A mockup shows the garment the platform drew. A generated picture cannot become one.";

export type MockupAssetResult = Readonly<{ ok: true; asset: DrawnAsset }> | Readonly<{ ok: false; reason: string }>;

/**
 * A finished mockup as an asset for the shell. The role is `scene` for a picture that goes on the
 * canvas, `panel_layer` for one placed on an artboard and `print_file` for one that goes to print;
 * all three are open to a drawn picture and none of them is open to a generated one.
 */
export function drawnAsset(file: AssetFile, provenance: MockupProvenance, role: DrawnAsset["role"] = "scene"): MockupAssetResult {
  const asset: DrawnAsset = { role, provenance, file };
  const verdict = acceptAsset("mockup", asset);
  return verdict.accepted ? { ok: true, asset } : { ok: false, reason: verdict.reason };
}

/**
 * The second door, for a value that never met the compiler: a picture read from the database or
 * handed over by another workstream. A generated picture is refused here whatever its role says,
 * before the shell's own `acceptAsset` ever sees it.
 */
export function offerable(asset: LaunchAsset): MockupAssetResult {
  if (asset.provenance === "generated") return { ok: false, reason: GENERATED_REFUSED };
  const verdict = acceptAsset("mockup", asset);
  return verdict.accepted ? { ok: true, asset } : { ok: false, reason: verdict.reason };
}

/** What "Convert to image" (Flatten) offers the board: the mockup as a scene asset. */
export const convertToImage = (file: AssetFile, provenance: MockupProvenance = "deterministic"): MockupAssetResult => drawnAsset(file, provenance, "scene");

export const CONVERT_LABEL = "Convert to image";
export const CONVERT_HELP = "Bakes this board into a plain picture, so the boards after it stop following the design.";
