import { backdropFor, type Crop, type MockupScene } from "@/lib/mockups";
import type { ShootBoardSettings } from "./board";
import { cameraByKey, poseByKey } from "./poses";
import { SHOOT_STYLE_PROMPTS, type ShootPose } from "./types";

/**
 * WHAT A SHOOT ASKS A MODEL FOR (spec F-L1's AI half; plan v5 rule "no live paid call from tests or
 * your own run").
 *
 * The provider is an interface and nothing else. A real one is a `lib/media/lifestyle` adapter
 * behind its own key, reached through `adapter.ts`; tests and a local run get the deterministic stub
 * (`stub.ts`), which calls nothing and costs nothing.
 *
 * **The request has no field for drawing the garment.** `garment` is a picture the platform already
 * drew -- the deterministic render or the golden-sample photo -- and the prompt's last sentence tells
 * the model to leave it exactly as it is. There is nothing here a caller could use to ask for a
 * garment to be invented, which is spec decision 13 written into a shape rather than a review.
 */

export interface ShootRequest {
  /** The locked garment: the deterministic render or the golden-sample photo, as a PNG. */
  readonly garment: Uint8Array;
  /** Up to two more Knitwright products for an outfit (F-L1). Pictures the platform drew as well. */
  readonly extraGarments: readonly Uint8Array[];
  /** The brand's own model, when they uploaded one and recorded the consent. */
  readonly modelPhoto: Uint8Array | null;
  /** A background the brand uploaded, when they chose to. */
  readonly background: Uint8Array | null;
  readonly prompt: string;
  readonly crop: Crop;
  readonly sceneSlug: string;
  /** Different on each attempt, the same for the same shoot, so a rerun is a rerun and not a lottery. */
  readonly seed: number;
}

export type ShootProviderResult =
  | Readonly<{ ok: true; png: Uint8Array }>
  | Readonly<{ ok: false; message: string }>;

export interface ShootProvider {
  readonly name: string;
  /** What one picture is expected to cost the platform, in millionths of a dollar. Zero for the stub. */
  readonly costPerImageMicrodollars: number;
  generate(request: ShootRequest, signal: AbortSignal): Promise<ShootProviderResult>;
}

/**
 * The last sentence of every prompt. The same instruction `lib/media/lifestyle/scenes.ts` gives its
 * own four scenes, written here because that one is private to that module; `provider.test.ts`
 * holds the two to the same meaning by asking that both name the crest, the sponsor, the names and
 * the numbers.
 */
export const GARMENT_LOCK =
  "Keep the garment exactly as it is in the reference picture: the same shape, colours, panels, seams, stripes, crest, sponsor logos, names and numbers, in the same place and at the same size. Do not add, remove, redraw or restyle any logo, text or number. Change only what is around the garment.";

/** What a background that was uploaded tells the model, since the picture itself carries the rest. */
export const BACKGROUND_GIVEN = "Use the background picture provided.";

/** What an uploaded model tells it, for the same reason. */
export const MODEL_GIVEN = "The person in the picture provided wears the garment.";

const sentence = (text: string): string => (text.trim().endsWith(".") ? text.trim() : `${text.trim()}.`);

/** The scene's own words: where it is, what the light is doing, what is behind the garment. */
const sceneWords = (scene: MockupScene): string =>
  `${scene.title}. ${sentence(scene.lighting)} ${sentence(`Behind the garment: ${scene.backdrop.label.toLowerCase()}`)}`;

const backgroundWords = (settings: ShootBoardSettings): string | null => {
  if (settings.backgroundSource === "scene") return null;
  if (settings.backgroundSource === "upload") return BACKGROUND_GIVEN;
  if (settings.backgroundSource === "text") return sentence(settings.backgroundText);
  const key = settings.backgroundKey;
  return key === null ? null : sentence(`Behind the garment: ${backdropFor(key).label.toLowerCase()}`);
};

const presetWords = (preset: ShootPose | null): string | null => (preset === null ? null : sentence(preset.prompt));

/**
 * The whole prompt, in a fixed order: the scene, the pose, the camera, the style, the background,
 * then the person's own words, and **the garment lock last** so it is the final instruction the
 * model reads. Nothing a person types can come after it.
 */
export function promptFor(settings: ShootBoardSettings, scene: MockupScene): string {
  const parts = [
    sceneWords(scene),
    presetWords(poseByKey(settings.poseKey ?? "")),
    presetWords(cameraByKey(settings.cameraKey ?? "")),
    SHOOT_STYLE_PROMPTS[settings.style],
    backgroundWords(settings),
    hasModelPhoto(settings) ? MODEL_GIVEN : null,
    settings.prompt.trim() === "" ? null : sentence(settings.prompt),
    GARMENT_LOCK,
  ];
  return parts.filter((part): part is string => part !== null && part !== "").join(" ");
}

/** True when this shoot hands the model a photograph of a person the brand uploaded. */
export const hasModelPhoto = (settings: ShootBoardSettings): boolean =>
  settings.modelSource === "upload" && settings.modelFileId !== null && settings.consent !== null;

/** A seed that is the same for the same shoot and attempt, so a rerun of the same thing repeats. */
export const seedOf = (boardId: string, attempt: number): number => {
  let hash = 2166136261;
  for (const code of `${boardId}:${attempt}`) hash = (Math.imul(hash ^ code.charCodeAt(0), 16777619) >>> 0);
  return hash % 1_000_000;
};
