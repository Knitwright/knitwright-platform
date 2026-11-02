/**
 * The formats, lengths and frame rate of the video studio (spec F-L3, plan v5 L5).
 *
 * Nothing here is a number this file invented: the three aspects and 1080p come from F-L3 ("they
 * export as MP4 at 9:16, 1:1 and 16:9, 1080p") and the 3 to 15 second range from the same feature.
 * Every row says where it came from, and a length outside the range is **refused with the bound in
 * the message** rather than quietly clamped, exactly as the launch shell refuses an artboard size
 * it cannot draw (decision 0091, item 7).
 */

/** No rulebook entry covers the video studio yet, so every row and finding carries this and the PR lists it. */
export const VIDEO_GAP_RULE = "R-GAP-000";

/** Where the numbers in this file come from. Shown beside a format so nobody reads it as a measured figure. */
export const FORMAT_SOURCE = "From the spec's Video studio (F-L3); the frame rate is a Knitwright default";

export const VIDEO_ASPECTS = ["9:16", "1:1", "16:9"] as const;
export type VideoAspect = (typeof VIDEO_ASPECTS)[number];

export interface VideoFormat {
  readonly aspect: VideoAspect;
  /** The words on the aspect control, with what the aspect is usually for. */
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly ruleId: string;
  readonly note: string;
}

/**
 * 1080p on the short side, which is what the spec asks for: a 9:16 clip is 1080 wide, a 16:9 clip is
 * 1080 tall, and a square one is 1080 both ways.
 */
export const VIDEO_FORMATS: Readonly<Record<VideoAspect, VideoFormat>> = {
  "9:16": { aspect: "9:16", label: "9:16 story and reel", width: 1080, height: 1920, ruleId: VIDEO_GAP_RULE, note: FORMAT_SOURCE },
  "1:1": { aspect: "1:1", label: "1:1 square post", width: 1080, height: 1080, ruleId: VIDEO_GAP_RULE, note: FORMAT_SOURCE },
  "16:9": { aspect: "16:9", label: "16:9 wide", width: 1920, height: 1080, ruleId: VIDEO_GAP_RULE, note: FORMAT_SOURCE },
};

export const isVideoAspect = (value: unknown): value is VideoAspect => (VIDEO_ASPECTS as readonly unknown[]).includes(value);

/** The format of an aspect, or 1:1 for anything else, so a stored value nobody recognises still draws. */
export const videoFormat = (aspect: unknown): VideoFormat => (isVideoAspect(aspect) ? VIDEO_FORMATS[aspect] : VIDEO_FORMATS["1:1"]);

/** Frames a second. A Knitwright default: nothing in the spec says one, and the recorder already used 30. */
export const VIDEO_FPS = 30;

/**
 * The length an AI clip may be (spec F-L3: "Duration: 3-15 s"). Deterministic videos have their own
 * fixed lengths, one per sequence, and do not use this.
 */
export interface DurationBounds {
  readonly minSeconds: number;
  readonly maxSeconds: number;
  readonly ruleId: string;
  readonly note: string;
}

export const DURATION_BOUNDS: DurationBounds = {
  minSeconds: 3,
  maxSeconds: 15,
  ruleId: VIDEO_GAP_RULE,
  note: "From the spec's Video studio (F-L3): 3 to 15 seconds",
};

export type DurationVerdict =
  | Readonly<{ ok: true; seconds: number }>
  | Readonly<{ ok: false; reason: string; ruleId: string }>;

/** Whether a length may be asked for. A refusal names both bounds, so the person can read what to type. */
export function durationVerdict(seconds: number, bounds: DurationBounds = DURATION_BOUNDS): DurationVerdict {
  if (!Number.isFinite(seconds) || !Number.isInteger(seconds)) {
    return { ok: false, reason: "Give the length in whole seconds.", ruleId: bounds.ruleId };
  }
  if (seconds < bounds.minSeconds || seconds > bounds.maxSeconds) {
    return {
      ok: false,
      reason: `A clip is ${bounds.minSeconds} to ${bounds.maxSeconds} seconds long. ${seconds} is outside that.`,
      ruleId: bounds.ruleId,
    };
  }
  return { ok: true, seconds };
}

/** How many frames a length holds at the studio's frame rate. */
export const frameCount = (seconds: number, fps: number = VIDEO_FPS): number => Math.max(1, Math.round(seconds * fps));

/** `mm:ss`, for "Generating 00:07" and for a player's own clock (spec F-L3). */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}
