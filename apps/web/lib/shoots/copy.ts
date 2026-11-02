import { CONSENT_STATEMENT, MAX_EXTRA_PRODUCTS, MAX_IMAGE_COUNT, MIN_IMAGE_COUNT } from "./types";

/**
 * EVERY WORD THE SHOOT PANELS SHOW, in one file (the pattern `lib/mockups/copy.ts` and
 * `components/video/copy.ts` set).
 *
 * Two reasons it is here rather than in the components. A sentence in one place is a sentence that
 * can be read on its own and held to the product's wording rules by a test. And the panels are
 * client components, so what they import has to stay light (`tests/architecture/client-weight.test.ts`).
 *
 * Nothing here reads as settled, nothing claims a licence, a price or a consent, and every empty
 * state names the one action that fills it.
 */

export const IDEAS_PANEL_TITLE = "AI image";
export const IDEAS_PANEL_LEAD =
  "Shoot ideas put your garment in a place a model lights. The garment itself stays the picture the platform drew.";
export const GARMENT_LOCKED =
  "Every shoot starts from your design's own render or its golden-sample photo. The model changes the place, the light, the pose and the camera, never the garment.";

export const IDEAS_HEADING = "Shoot ideas";
export const CUSTOM_HEADING = "Your own shoot";
export const CUSTOM_LEAD = "Build a shoot of your own: a scene, a model, a background, a pose, a camera, a style and a shape.";

export const SEARCH_LABEL = "Search the shoot ideas";
export const SEARCH_PLACEHOLDER = "Floodlights, gym, trail, line-up…";
export const CLEAR_FILTERS = "Clear the filters";

export const USE_IDEA = "Use this shoot idea";
export const useIdeaSuffix = (title: string): string => `: ${title}`;

export const NO_IDEAS_TITLE = "No shoot ideas are in the library";
export const NO_IDEAS_BODY =
  "The ideas come from the scenes in the mockup library. Open the Mockups panel and pick a photographic scene to shoot.";
export const NO_MATCH_TITLE = "No shoot idea matches that";
export const NO_MATCH_BODY = "Clear the filters to see all twelve again.";

export const NO_DESIGN_TITLE = "This board has no design behind it";
export const NO_DESIGN_BODY =
  "A shoot keeps the garment the platform drew, so it needs a design first. Join a Design board to this one and the shoot follows it.";
export const NO_DESIGN_ACTION = "Add a Mockup board from your design";

export const NO_SCENE_TITLE = "No scene chosen yet";
export const NO_SCENE_BODY = "Pick a shoot idea above, or choose a scene in the Mockups panel. The scene is the place the garment is photographed in.";

export const BOARD_PANEL_TITLE = "AI image board";
export const BOARD_PANEL_LEAD = "The scene, the model, the shape and the cost, with the garment held to your design.";

export const SCENE_LABEL = "Scene";
export const STYLE_LABEL = "Style";
export const ASPECT_LABEL = "Shape";
export const COUNT_LABEL = "How many pictures";
export const COUNT_HINT = `F-L1 allows ${MIN_IMAGE_COUNT} to ${MAX_IMAGE_COUNT} pictures in one run.`;
export const POSE_LABEL = "Pose";
export const CAMERA_LABEL = "Camera";
export const BACKGROUND_LABEL = "Background";
export const PROMPT_LABEL = "Anything else about the scene";
export const PROMPT_HINT = "Words about the place, the light and the mood. The garment comes from your design, so it is not changed from here.";
export const EXTRA_PRODUCTS_LABEL = "More of your products in the picture";
export const EXTRA_PRODUCTS_HINT = `Up to ${MAX_EXTRA_PRODUCTS} more Knitwright products, for an outfit. Each one is a picture the platform drew.`;

export const MODEL_HEADING = "Model";
export const MODEL_NONE = "Nobody in the picture";
export const MODEL_PRESET = "A licensed preset";
export const MODEL_UPLOAD = "My own model, with their consent";
export const MODEL_LEAD = "A person in a picture is a person: a preset needs a licence on file, and your own model needs their consent recorded.";
export const CONSENT_LABEL = "What you hold as their agreement";
export const CONSENT_PLACEHOLDER = "Release form 2026-04 / agreement reference";
export const CONSENT_TICK = CONSENT_STATEMENT;
export const CONSENT_RECORDED = (givenAt: string): string => `Consent recorded on ${givenAt.slice(0, 10)}.`;

export const GENERATE_HEADING = "Generate";
export const REGENERATE = "Regenerate";
export const REGENERATE_HINT = "Runs this board again with the same settings, and costs the same again.";

export const RESULT_HEADING = "The picture";
export const EDITS_HEADING = "Edit this picture";
export const EDIT_PROMPT_LABEL = "Change the scene with a prompt";

export const CHECKER_LEAD =
  "Every picture is measured against your design's own render: the crest, the sponsor, the number, where the panels sit and the colours.";
export const CHECKER_KEPT = "The garment came through unchanged, so the picture was kept.";

export const COSTS_NOTHING_YET = "Credits are not being charged on this platform yet, so this run spends nothing.";

/** The error state: what happened, what it cost, and what to do next. All three, never one. */
export const failureLine = (message: string, refunded: number): string =>
  refunded > 0 ? `${message} ${refunded} ${refunded === 1 ? "credit was" : "credits were"} given back.` : message;

export const TRY_ANOTHER_POSE = "Try another pose, another camera or another scene: a different angle is usually what fixes it.";

export const MODERATION_FLAGGED =
  "This picture is waiting for our review before it can be used in a listing. You can still see it here.";

export const AI_LABEL_NOTE = "Every picture a model made carries its label, and a picture with a person in it says that the person was generated.";
