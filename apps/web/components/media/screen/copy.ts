/**
 * Every sentence the media screen shows (plain words, decision 0059). None of the words that read as settled
 * (lib/techpack/wording.test.ts) is used: a picture "matches your design", it is never called approved or passed.
 */

export const MAKE_LABEL = "Make media";
export const MAKING_LABEL = "Making media…";
export const REMAKE_LABEL = "Make again";
export const USE_CREDITS_LABEL = "Use credits";
export const USING_CREDITS_LABEL = "Using credits…";
export const UNLOCKED_LABEL = "Credits used. The clean pictures are ready to download.";
export const CLIP_LABEL = "Make 5-second clip";
export const MAKING_CLIP_LABEL = "Making the clip…";
export const RERUN_LABEL = "Try again";

export const LOADING_MESSAGE = "Looking for this design's media…";
export const EMPTY_MESSAGE = "No media has been made for this version of the design yet.";
export const WORKING_MESSAGE = "Making the pictures. This takes under a minute.";
export const UNREACHABLE_MESSAGE = "We could not reach the server. Check your connection and try again.";
export const TIMEOUT_MESSAGE = "The media is taking longer than usual. Nothing was charged. Try again in a minute.";
export const NO_LIFESTYLE_NOTE = "Lifestyle pictures (on the pitch, in the changing room, on the street, on a model) are made only when Knitwright has switched a picture service on. This set has none.";
export const PREVIEW_NOTE = "Preview mark on every picture until you use credits. The clean files are not sent to your browser before that.";
export const NOT_FINISHED_MESSAGE = "Wait until the pictures are ready before using credits.";

export const DROPPED_EXPLANATION = "This picture did not match your design closely enough (colours, seams, crest, sponsors, names or numbers had moved), so it was dropped and is not shown. No credits are used for a dropped picture.";
export const REJECTED_EXPLANATION = "This picture did not match your design closely enough, so it is not shown. Try again to ask for a new one.";
export const SAME_VERSION_MESSAGE = "This version of the design already has its media. Save a new version of the design to make new pictures.";
export const CLIP_LOCKED_EXPLANATION = "The clip plays and downloads once you have used credits.";

export const NEEDS_MATCHING_STILL = "A clip is made from a lifestyle picture that matches your design. Make lifestyle pictures first.";
export const CLIP_EXISTS = "The clip is in this set.";
export const CLIP_WAIT = "Wait until the pictures are ready.";
export const CLIP_NOTE = "AI generated from a lifestyle picture, 5 seconds. It is paid, and it is charged with the set, once for each saved version.";

export const AI_BADGE = "AI generated";
export const PREVIEW_BADGE = "Preview";
export const CLEAN_BADGE = "Clean file";

export const SHARE_LABEL = "Share";
export const DOWNLOAD_LABEL = "Download";
export const SHARE_FAILED_MESSAGE = "The picture could not be shared. Download it instead.";

export const TURNTABLE_NOTE = "Records the 3D view turning once. Free.";
export const TURNTABLE_NEEDS_3D = "Open the 3D view first, then record the turntable.";
export const RECORD_LABEL = "Record turntable";

export const VERDICT_PENDING = "Being compared with your design";
export const VERDICT_MATCHES = "Matches your design";
export const VERDICT_REJECTED = "Did not match your design";
export const VERDICT_NOT_COMPARED = "Not compared with your design";
export const VERDICT_DRAWN = "Drawn from your design";
export const VERDICT_RECORDED = "Recorded in your browser";

export const priceText = (price: number, enforced: boolean, balance: number | null, placeholder: boolean): string => {
  const credits = `${price} ${price === 1 ? "credit" : "credits"}`;
  const note = enforced ? `You have ${balance ?? 0}.` : "Not charged yet.";
  return `${credits}, once for each saved version. ${note}${placeholder ? " The price is a placeholder the owner has not set." : ""}`;
};
