import type { Rect } from "@/lib/media-check/types";
import { SHOOT_GAP_RULE, type ShootGap } from "./types";

/**
 * THE IMAGE MODAL, WHOSE EDITS ARE LIMITED TO THE SCENE (spec F-L1: "**Image modal** (Kittl): edit
 * with a prompt (scene only), Remove background, Edit area (scene only), Upscale, Add text, then
 * Download or Open in editor").
 *
 * "Scene only" appears twice in that one sentence, so it is enforced twice here rather than trusted
 * twice:
 *
 *   * **a prompt that asks for the garment is refused**, with a sentence that says where the garment
 *     is changed instead (the design editor). The word list is the garment's own vocabulary -- crest,
 *     sponsor, number, stripe, colourway -- and it is the same list in one place, so a new word is
 *     added once;
 *   * **an area that overlaps the garment is refused.** The garment's rectangle comes from the scene's
 *     own slot, which is where F-L1 fixes it, so the refusal needs nothing from the browser.
 *
 * And one thing the modal cannot offer at all: there is no action here that makes the picture
 * artwork. `Open in editor` opens it as scenery, because a generated picture's only role is
 * `"scene"` (`lib/launch/assets.ts`), and `NO_ARTWORK_NOTE` says so on the screen.
 */

/** Every action F-L1 lists in the modal, in its own order. */
export const MODAL_ACTIONS = ["prompt", "remove-background", "edit-area", "upscale", "add-text", "download", "open"] as const;
export type ModalAction = (typeof MODAL_ACTIONS)[number];

export const MODAL_ACTION_LABELS: Readonly<Record<ModalAction, string>> = {
  prompt: "Change the scene with a prompt",
  "remove-background": "Remove the background",
  "edit-area": "Edit an area of the scene",
  upscale: "Upscale",
  "add-text": "Add text",
  download: "Download",
  open: "Open in the editor",
};

/** Which actions cost credits, so the modal can show the cost before one is pressed. */
export const PAID_ACTIONS: readonly ModalAction[] = ["prompt", "edit-area", "upscale"];

export const isPaidAction = (action: ModalAction): boolean => PAID_ACTIONS.includes(action);

/** What the modal says about what this picture may become. Shown once, not buried. */
export const NO_ARTWORK_NOTE =
  "This is a generated picture, so it stays scenery: it can go in a post, a story or a listing, and it never becomes artwork on the garment or part of a print file.";

/** The words that mean the garment rather than the scene. One list, used by the prompt guard. */
export const GARMENT_WORDS: readonly string[] = [
  "garment",
  "shirt",
  "jersey",
  "kit",
  "crest",
  "badge",
  "sponsor",
  "logo",
  "number",
  "name on the back",
  "stripe",
  "stripes",
  "panel",
  "panels",
  "colourway",
  "collar",
  "sleeve",
  "sleeves",
  "hem",
  "fabric",
];

export const GARMENT_EDIT_REFUSAL =
  "This box changes the scene around your garment. The garment comes from your design, so change it in the editor and this picture follows.";

export const AREA_REFUSAL = "That area is on the garment. Choose an area of the scene around it instead.";

/** Which garment words a prompt used, so the refusal can name them rather than being a flat no. */
export function garmentWordsIn(text: string): readonly string[] {
  const lower = ` ${text.toLowerCase().replace(/[^a-z\s]/g, " ")} `;
  return GARMENT_WORDS.filter((word) => lower.includes(` ${word} `));
}

export type EditVerdict = Readonly<{ allowed: true }> | Readonly<{ allowed: false; reason: string; ruleId: string }>;

/** Whether this prompt only asks for the scene. A prompt that names the garment is refused. */
export function promptEditVerdict(text: string): EditVerdict {
  const words = garmentWordsIn(text);
  if (words.length === 0) return { allowed: true };
  return { allowed: false, reason: `${GARMENT_EDIT_REFUSAL} You asked about: ${words.join(", ")}.`, ruleId: SHOOT_GAP_RULE };
}

const overlaps = (one: Rect, two: Rect): boolean =>
  one.x < two.x + two.width && two.x < one.x + one.width && one.y < two.y + two.height && two.y < one.y + one.height;

/** Whether this area is off the garment. The garment's rectangle is the scene's own slot. */
export function areaEditVerdict(area: Rect, garment: readonly Rect[]): EditVerdict {
  return garment.some((rect) => overlaps(area, rect)) ? { allowed: false, reason: AREA_REFUSAL, ruleId: SHOOT_GAP_RULE } : { allowed: true };
}

/** What the modal cannot do yet, said on the screen rather than left for somebody to discover. */
export function modalGaps(): readonly ShootGap[] {
  return [
    {
      ruleId: SHOOT_GAP_RULE,
      line: "Upscale, Remove background and Add text are the launch shell's own tools (F-L1), so this panel offers them and the shell carries them out. What they cost is the platform's credit price, which the owner has not set.",
    },
  ];
}
