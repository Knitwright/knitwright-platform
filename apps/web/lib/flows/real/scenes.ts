import { isCrop } from "@/lib/mockups/crops";
import { sceneBySlug } from "@/lib/mockups/scenes";
import type { Crop, MockupScene } from "@/lib/mockups/types";

/**
 * THE FLOW TEMPLATES' SCENE NAMES, READ AS THE MOCKUP LIBRARY'S OWN (decision 0133).
 *
 * The six packs of `templates/` were written before L2's scene library had its slugs, so a pack's
 * board says `scene: "render-front"` where the library calls the same scene `product-front`, and
 * the mockup renderer reads `sceneSlug`, which no pack writes. Run as they were, every free render
 * of every pack would have been refused with "This board has no scene yet".
 *
 * So the names are mapped here, once, and `scenes.test.ts` holds every pack's scene to a scene the
 * library really has. A board a person has set up in the Mockups panel carries `sceneSlug` and is
 * read as it is: the mapping only ever fills in what a pack left out.
 */

/** A pack's scene name -> the library's slug. An aspect-specific scene is chosen by the board's aspect. */
const PACK_SCENES: Readonly<Record<string, string | Readonly<Partial<Record<Crop, string>>>>> = {
  "render-front": "product-front",
  "render-back": "product-back",
  "render-three-quarter": "product-three-quarter",
  "render-side": "product-side",
  "flat-lay": "flat-lay-white",
  hanger: "hanger-on-wall",
  "ghost-mannequin": "ghost-mannequin",
  "ecommerce-white": { "1:1": "ecommerce-white-square", "4:5": "ecommerce-white-four-five" },
  "turntable-360": "turntable-360",
  "changing-room-kit-layout": "changing-room-kit-layout",
  "team-line-up-11": "team-line-up-eleven",
  "tunnel-walk-out": "tunnel-walk-out",
};

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

/** The crop a board's own `aspect` names, or null. */
export const cropOfSettings = (settings: Readonly<Record<string, unknown>>): Crop | null => {
  const aspect = text(settings["aspect"]);
  return aspect !== null && isCrop(aspect) ? aspect : null;
};

/** The library slug a board's settings mean: its own `sceneSlug`, else its pack's `scene`, mapped. */
export function sceneSlugOfBoard(settings: Readonly<Record<string, unknown>>): string | null {
  const own = text(settings["sceneSlug"]);
  if (own !== null) return own;
  const pack = text(settings["scene"]);
  if (pack === null) return null;
  const mapped = PACK_SCENES[pack];
  if (mapped === undefined) return sceneBySlug(pack) === null ? null : pack;
  if (typeof mapped === "string") return mapped;
  const crop = cropOfSettings(settings) ?? "1:1";
  return mapped[crop] ?? Object.values(mapped)[0] ?? null;
}

/** The library scene a board means, or null. */
export const sceneOfBoard = (settings: Readonly<Record<string, unknown>>): MockupScene | null => {
  const slug = sceneSlugOfBoard(settings);
  return slug === null ? null : sceneBySlug(slug);
};

/**
 * The settings the mockup renderer reads, from a pack's settings: the slug and, when the board's
 * aspect is one the scene has, that crop. Everything the board already says is kept.
 */
export function mockupSettingsOf(settings: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const scene = sceneOfBoard(settings);
  if (scene === null) return settings;
  const crop = cropOfSettings(settings);
  return {
    ...settings,
    sceneSlug: scene.slug,
    ...(text(settings["crop"]) === null && crop !== null && scene.crops.includes(crop) ? { crop } : {}),
  };
}
