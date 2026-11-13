import { IMAGE_COUNTS, SHOOT_ASPECTS, SHOOT_ASPECT_LABELS, SHOOT_STYLES, SHOOT_STYLE_LABELS, type ShootAspect, type ShootStyle } from "@/lib/shoots/types";
import { VIDEO_ASPECTS, type VideoAspect } from "@/lib/media/video/formats";

/**
 * THE PROMPT BAR'S MODES AND CHOICES (plan v6 E5, decision 0149; `08` v3.2–v3.4 "Prompt bar").
 *
 * Every choice the bar offers is one the run engine already takes. The image aspects, counts and
 * styles are the AI image board's own (`lib/shoots`), the video aspects and lengths are the AI video
 * board's (`lib/media/video`). Kittl's longer aspect list (21:9, 5:4, 4:3, 3:2, 2:3, 3:4) is not
 * offered, because no board of ours can make a picture at those shapes, and a menu item that is
 * quietly ignored would be a fake.
 */

export const PROMPT_MODES = ["agentic", "image", "video", "ask"] as const;
export type PromptMode = (typeof PROMPT_MODES)[number];

export interface ModeInfo {
  readonly id: PromptMode;
  readonly label: string;
  /** The short word on the footer's mode button. */
  readonly short: string;
  /** The one line under the label in the mode menu. */
  readonly lead: string;
  readonly placeholder: string;
  readonly beta: boolean;
  /** Whether this mode can ever spend credits. Ask never does. */
  readonly paid: boolean;
}

export const MODES: Readonly<Record<PromptMode, ModeInfo>> = {
  agentic: {
    id: "agentic",
    label: "Agentic AI",
    short: "Agent",
    lead: "Questions are answered from the rulebook; anything else opens the Creative Agent with your words.",
    placeholder: "Describe the kit, drop or campaign you want to make",
    beta: true,
    paid: false,
  },
  image: {
    id: "image",
    label: "Generate Image",
    short: "Image",
    lead: "A scene around your garment. The garment stays the picture the platform drew.",
    placeholder: "Describe image you want to create",
    beta: false,
    paid: true,
  },
  video: {
    id: "video",
    label: "Generate Video",
    short: "Video",
    lead: "A clip from a mockup or an AI image of your garment.",
    placeholder: "Describe your video. Optionally add reference images.",
    beta: false,
    paid: true,
  },
  ask: {
    id: "ask",
    label: "Ask Knitwright",
    short: "Ask",
    lead: "Answers “why?” from the rulebook. Nothing is generated and no credits are used.",
    placeholder: "Ask why a rule applies, or what a kit needs",
    beta: false,
    paid: false,
  },
};

export const isPromptMode = (value: unknown): value is PromptMode => (PROMPT_MODES as readonly unknown[]).includes(value);

/** The aspects the image mode offers: the AI image board's own, `match` last as in Kittl's menu. */
export const IMAGE_ASPECTS: readonly ShootAspect[] = [...SHOOT_ASPECTS.filter((one) => one !== "match"), "match"];

/** The short word on the footer button for an aspect. */
export const aspectShort = (aspect: ShootAspect | VideoAspect): string => (aspect === "match" ? "Match" : aspect);

/** The menu line for an image aspect, from the shoots' own labels. */
export const imageAspectLabel = (aspect: ShootAspect): string => SHOOT_ASPECT_LABELS[aspect];

/** Whether a W:H shape is tall, wide or square, for the orientation icon on each menu row. */
export function orientationOf(aspect: string): "portrait" | "landscape" | "square" | "match" {
  const [w, h] = aspect.split(":").map(Number);
  if (w === undefined || h === undefined || !Number.isFinite(w) || !Number.isFinite(h)) return "match";
  return w === h ? "square" : w > h ? "landscape" : "portrait";
}

export const IMAGE_COUNT_CHOICES: readonly number[] = IMAGE_COUNTS;
export const countLabel = (count: number): string => (count === 1 ? "1 Image" : `${count} Images`);

export { VIDEO_ASPECTS };
export type { ShootAspect, ShootStyle, VideoAspect };

/** The clip lengths the video mode offers: inside the board's own 3–15 s bounds. */
export const VIDEO_SECONDS: readonly number[] = [3, 5, 8, 10, 15];

/** Kittl's Reference Mode menu, mapped to what our video board takes. */
export const VIDEO_REFERENCE_MODES = ["reference", "frames"] as const;
export type VideoReferenceMode = (typeof VIDEO_REFERENCE_MODES)[number];

export const VIDEO_REFERENCE_LABELS: Readonly<Record<VideoReferenceMode, Readonly<{ label: string; lead: string }>>> = {
  reference: { label: "Reference Mode", lead: "Bring elements into your scene" },
  frames: { label: "Frames to Video", lead: "Motion between two key frames" },
};

/** The styles, from the shoots' own list, for Browse Styles. */
export const STYLE_CHOICES: readonly Readonly<{ value: ShootStyle; label: string }>[] = SHOOT_STYLES.map((value) => ({ value, label: SHOOT_STYLE_LABELS[value] }));

/** Everything the bar holds between presses. */
export interface PromptChoices {
  readonly mode: PromptMode;
  readonly prompt: string;
  readonly style: ShootStyle;
  readonly imageAspect: ShootAspect;
  readonly count: number;
  readonly videoModelKey: string | null;
  readonly videoAspect: VideoAspect;
  readonly seconds: number;
  readonly referenceMode: VideoReferenceMode;
}

export const DEFAULT_CHOICES: PromptChoices = {
  mode: "image",
  prompt: "",
  style: "editorial",
  imageAspect: "match",
  count: 1,
  videoModelKey: null,
  videoAspect: "9:16",
  seconds: 5,
  referenceMode: "reference",
};

/** The most words the bar takes: the boards' own limit (both are 400). */
export const MAX_PROMPT_WORDS = 400;
