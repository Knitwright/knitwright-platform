/** Sizes and lengths for the turntable and the clip (decision 0058). The labels are Knitwright defaults, not measured. */

export const MAX_TURNTABLE_BYTES = 8 * 1024 * 1024;
export const MAX_POSTER_BYTES = 2 * 1024 * 1024;
export const MAX_CLIP_BYTES = 30 * 1024 * 1024;
/** The longest a person can record, in seconds. The recorder stops by itself at this length. */
export const MAX_TURNTABLE_SECONDS = 12;
/** One full turn at the viewer's speed takes a little under this; the recorder stops at this length. */
export const TURNTABLE_SECONDS = 8;
export const CLIP_SECONDS = 5;
/** A poster is a frame of the video, so it is never larger than a screen. */
export const MAX_POSTER_SIDE = 4096;

export const AI_GENERATED_LABEL = "AI generated";
