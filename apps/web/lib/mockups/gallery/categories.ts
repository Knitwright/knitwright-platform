import type { MockupScene } from "../types";

/**
 * The categories of the v3.9 Mockups page (09 screen 8, 08 §4.3, decision 0140).
 *
 * They are read off what a scene already is -- its group, and how its garment is held -- so no
 * scene carries a second tag that could disagree with the first. A scene may sit in two: an
 * e-commerce ghost shot is both "Ghost" and "E-commerce".
 */

export const MOCKUP_CATEGORIES = [
  "all",
  "renders",
  "flat-lay",
  "hanger",
  "ghost",
  "teamwear",
  "training",
  "running",
  "combat",
  "esports",
  "e-commerce",
] as const;
export type MockupCategory = (typeof MOCKUP_CATEGORIES)[number];

export const MOCKUP_CATEGORY_LABELS: Readonly<Record<MockupCategory, string>> = {
  all: "All",
  renders: "Product renders",
  "flat-lay": "Flat lay",
  hanger: "Hanger",
  ghost: "Ghost",
  teamwear: "Teamwear",
  training: "Training",
  running: "Running",
  combat: "Combat",
  esports: "Esports",
  "e-commerce": "E-commerce",
};

const presents = (scene: MockupScene, presentation: string): boolean => scene.slots.some((slot) => slot.presentation === presentation);

const RULES: Readonly<Record<Exclude<MockupCategory, "all">, (scene: MockupScene) => boolean>> = {
  // The free product shots: the four sides and the turntable, all from the platform's own drawing.
  renders: (scene) => scene.group === "product" && (presents(scene, "turning") || scene.slug.startsWith("product-")),
  "flat-lay": (scene) => scene.group === "product" && (presents(scene, "folded") || (presents(scene, "flat") && !scene.slug.startsWith("product-"))),
  hanger: (scene) => presents(scene, "hanging"),
  ghost: (scene) => presents(scene, "ghost"),
  teamwear: (scene) => scene.group === "teamwear",
  training: (scene) => scene.group === "training",
  running: (scene) => scene.group === "running",
  combat: (scene) => scene.group === "combat",
  esports: (scene) => scene.group === "esports",
  "e-commerce": (scene) => scene.group === "retail",
};

export const inCategory = (scene: MockupScene, category: MockupCategory): boolean => category === "all" || RULES[category](scene);

type SearchValue = string | string[] | undefined;

/** The category an address names, or All. */
export function categoryFromQuery(value: SearchValue): MockupCategory {
  const raw = Array.isArray(value) ? value[0] : value;
  return MOCKUP_CATEGORIES.find((category) => category === raw) ?? "all";
}
