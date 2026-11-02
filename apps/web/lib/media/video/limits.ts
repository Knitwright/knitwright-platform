/** Sizes and lengths for the turntable and the clip (decision 0058). The labels are Knitwright defaults, not measured. */

export const MAX_TURNTABLE_BYTES = 8 * 1024 * 1024;
export const MAX_POSTER_BYTES = 2 * 1024 * 1024;
export const MAX_CLIP_BYTES = 30 * 1024 * 1024;
/**
 * How long ONE FULL TURN takes, everywhere a turntable is made: the browser recording of the 3D
 * canvas and the launch video's own turntable sequence (`sequences.ts`) both read it from here.
 *
 * Six seconds, because that is the figure in the spec — F-L3's Video studio and `07`'s video
 * templates. Decision 0058 wrote 8 s for the media-set recording and the two numbers then sat in
 * the code at once, so the same turn was two lengths depending on which screen made it (code review
 * of plan v5, item D-21). The spec wins; decision 0120 records it and asks the owner to confirm.
 *
 * The configurator's own spin is NOT this: `lib/teamwear/stage.ts` turns a kit over twelve seconds
 * for a person to look at, under a constant of the same name, and decision 0086 calls that framing.
 */
export const TURNTABLE_SECONDS = 6;
export const CLIP_SECONDS = 5;
/** A poster is a frame of the video, so it is never larger than a screen. */
export const MAX_POSTER_SIDE = 4096;

export const AI_GENERATED_LABEL = "AI generated";

/** What starting a media set may add: the studio renders (front, back, flat lay), each a re-encoded picture of a few MB at most. */
export const MEDIA_SET_RESERVE_BYTES = 3 * 4 * 1024 * 1024;
