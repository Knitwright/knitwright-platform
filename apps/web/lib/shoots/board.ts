import { isCrop, sceneBySlug, type Crop } from "@/lib/mockups";
import { imageCount } from "./cost";
import { consentFrom } from "./models";
import {
  MAX_EXTRA_PRODUCTS,
  SHOOT_ASPECTS,
  SHOOT_STYLES,
  type ModelConsent,
  type ModelSource,
  type ShootAspect,
  type ShootConcept,
  type ShootStyle,
} from "./types";

/**
 * AN AI IMAGE BOARD'S OWN SETTINGS (panel id `board-ai-image`; spec F-L1's custom shoot panel).
 *
 * The launch shell saves a board's settings as a plain record and hands them back exactly as they
 * were (`setBoardSettings`, decision 0091), so **everything here reads a record nobody has
 * checked**: a value of the wrong shape becomes the default, and a value that cannot have a default
 * -- which scene, which pose, which model -- becomes null and the panel asks for it. That is L5's
 * rule for the video board (`lib/media/video/ai-board.ts`) and it is the right one: a board a person
 * saved is still a board, even when a later release stops recognising one of its words.
 *
 * Two fields are missing on purpose, and their absence is the lock:
 *
 *   * **no placement.** F-L1: "Placement inside a photo scene is fixed by the scene's garment slot
 *     ... Users cannot drag the print area." A setting a panel cannot offer is one nobody can get
 *     wrong.
 *   * **nothing about the garment.** The garment comes from the Design board behind this one, and
 *     the model is told to leave it alone. There is no colour, no crest and no number here to change.
 *
 * No zod in this file: the panel is a client component, and a client component that imports a
 * module holding a zod schema ships all of zod to the browser
 * (`tests/architecture/client-weight.test.ts`).
 */

/** Where the background of a shoot comes from (F-L1: "Background: preset, upload or text"). */
export const BACKGROUND_SOURCES = ["scene", "preset", "upload", "text"] as const;
export type BackgroundSource = (typeof BACKGROUND_SOURCES)[number];

export interface ShootBoardSettings {
  /** The shoot idea this board came from, or null for a custom shoot. */
  readonly conceptSlug: string | null;
  /** The AI scene being shot. Null until one is chosen: there is nothing to shoot without it. */
  readonly sceneSlug: string | null;
  readonly style: ShootStyle;
  readonly aspect: ShootAspect;
  readonly count: number;
  readonly poseKey: string | null;
  readonly cameraKey: string | null;
  readonly modelSource: ModelSource;
  readonly modelPresetKey: string | null;
  /** The brand's own uploaded model, with the consent it recorded. Both or neither. */
  readonly modelFileId: string | null;
  readonly consent: ModelConsent | null;
  readonly backgroundSource: BackgroundSource;
  readonly backgroundKey: string | null;
  readonly backgroundFileId: string | null;
  readonly backgroundText: string;
  /** Up to two more Knitwright products for an outfit (F-L1). Design version ids. */
  readonly extraProductIds: readonly string[];
  /** The person's own words about the scene. Never about the garment. */
  readonly prompt: string;
}

/** The most words a person may add. Long enough for a scene, short enough to read on the card. */
export const MAX_PROMPT = 400;

/** What a board shows before anybody has chosen anything. Editorial and a square are our defaults. */
export const DEFAULT_SETTINGS: ShootBoardSettings = {
  conceptSlug: null,
  sceneSlug: null,
  style: "editorial",
  aspect: "match",
  count: 1,
  poseKey: null,
  cameraKey: null,
  modelSource: "none",
  modelPresetKey: null,
  modelFileId: null,
  consent: null,
  backgroundSource: "scene",
  backgroundKey: null,
  backgroundFileId: null,
  backgroundText: "",
  extraProductIds: [],
  prompt: "",
};

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed.slice(0, max);
};

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

const ids = (value: unknown): readonly string[] => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((one) => (typeof one === "string" && one.trim() !== "" ? [one.trim().slice(0, 64)] : [])))].slice(0, MAX_EXTRA_PRODUCTS);
};

/** A board's saved settings, read leniently, because the shell gives back whatever was stored. */
export function readBoardSettings(raw: Readonly<Record<string, unknown>> = {}): ShootBoardSettings {
  const consent = consentFrom(raw["consent"]);
  const modelFileId = text(raw["modelFileId"], 64);
  return {
    conceptSlug: text(raw["conceptSlug"], 64),
    sceneSlug: text(raw["sceneSlug"], 64),
    style: oneOf(raw["style"], SHOOT_STYLES, DEFAULT_SETTINGS.style),
    aspect: oneOf(raw["aspect"], SHOOT_ASPECTS, DEFAULT_SETTINGS.aspect),
    count: imageCount(raw["count"]),
    poseKey: text(raw["poseKey"], 64),
    cameraKey: text(raw["cameraKey"], 64),
    modelSource: oneOf(raw["modelSource"], ["none", "preset", "upload"] as const, DEFAULT_SETTINGS.modelSource),
    modelPresetKey: text(raw["modelPresetKey"], 64),
    modelFileId,
    consent,
    backgroundSource: oneOf(raw["backgroundSource"], BACKGROUND_SOURCES, DEFAULT_SETTINGS.backgroundSource),
    backgroundKey: text(raw["backgroundKey"], 64),
    backgroundFileId: text(raw["backgroundFileId"], 64),
    backgroundText: text(raw["backgroundText"], MAX_PROMPT) ?? "",
    extraProductIds: ids(raw["extraProductIds"]),
    prompt: text(raw["prompt"], MAX_PROMPT) ?? "",
  };
}

/** The settings as a record to hand back to `setBoardSettings`, so Regenerate reruns it unchanged. */
export const writeBoardSettings = (settings: ShootBoardSettings): Readonly<Record<string, unknown>> => ({
  ...settings,
  extraProductIds: [...settings.extraProductIds],
});

/**
 * The settings a shoot idea starts a board at: its scene, its style and its own output set.
 *
 * **Whether a model is asked for follows the scene, not the idea.** A shoot idea can hold two scenes
 * of which one has a person in it and one does not -- the shop rail and the studio backdrop are one
 * idea in `07`'s retail group -- and asking for a model on the scene that has nobody in it would put
 * the words "AI-generated model" under a picture with no model in it.
 */
export function settingsOfConcept(concept: ShootConcept, sceneSlug: string | null = null): ShootBoardSettings {
  const slug = sceneSlug ?? concept.sceneSlugs[0] ?? null;
  const scene = slug === null ? null : sceneBySlug(slug);
  return {
    ...DEFAULT_SETTINGS,
    conceptSlug: concept.slug,
    sceneSlug: slug,
    style: concept.style,
    aspect: concept.outputs.aspects[0] ?? "match",
    count: concept.outputs.count,
    poseKey: concept.poseKeys[0] ?? null,
    cameraKey: concept.cameraKeys[0] ?? null,
    modelSource: scene !== null && scene.people !== "none" ? "preset" : "none",
  };
}

/**
 * The crop a board's aspect really means. `match` is the scene's own first crop, so a scene keeps
 * the shape `07` gave it; every other aspect is one of the four crops by name.
 */
export function cropOf(aspect: ShootAspect, sceneCrops: readonly Crop[]): Crop {
  if (aspect === "match") return sceneCrops[0] ?? "1:1";
  return isCrop(aspect) ? aspect : "1:1";
}

/** The scene slug a board names, or null for a board nobody has given a scene yet. */
export const sceneSlugOf = (stored: Readonly<Record<string, unknown>>): string | null => text(stored["sceneSlug"], 64);

/**
 * The key a run's credit line goes under is **not** here: it is a digest, which needs `node:crypto`,
 * and a client component imports this file through `lib/shoots/index.ts`. See `./board-key.ts`.
 */
