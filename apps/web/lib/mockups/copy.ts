/**
 * Every word the mockup studio's screens show (plan v5 L2, spec F-L1).
 *
 * They live in one file so a reader can check the whole surface at once, and so nothing on a screen
 * is a sentence somebody typed into a component and nobody read again. Three rules hold:
 *
 *   * **nothing reads as settled.** No "approved", "verified", "final" or "production-ready"
 *     anywhere (`lib/techpack/wording.test.ts`'s rule, which this file keeps to even though the
 *     scan does not reach here);
 *   * **every empty state names the one action that fills it**, and every error says what to do;
 *   * **a scene that cannot show something says so** rather than looking ready.
 */

/** The rail panel titles the shell draws above each panel. */
export const MOCKUPS_PANEL_TITLE = "Mockups";
export const PHOTOS_PANEL_TITLE = "Photos";
export const BOARD_PANEL_TITLE = "Mockup board";

export const MOCKUPS_PANEL_LEAD = "Put this design in a scene. The product shots are free and drawn from the design itself; a scene with a crown is lit by a model and costs credits.";
export const PHOTOS_PANEL_LEAD = "Your own photographs, and the photographs of a golden sample of this design.";
export const BOARD_PANEL_LEAD = "The scene this board draws, the kit it draws, and the name and number on the shirt.";

/** The search field of the library panel (F-L1: "Search, with collections showing Show all"). */
export const SEARCH_LABEL = "Search the scenes";
export const SEARCH_PLACEHOLDER = "flat lay, line-up, white background";
export const SHOW_ALL = "Show all";
export const SHOW_FEWER = "Show fewer";
export const FREE_ONLY_LABEL = "Free scenes only";
export const PREMIUM_BADGE = "Credits";
export const PREMIUM_TITLE = "A model lights and places this scene, so it costs credits.";
export const FREE_BADGE = "Free";

/** Empty states. Each one names the single action that fills it. */
export const NO_SCENES_TITLE = "No scene in the library yet";
export const NO_SCENES_BODY = "The scenes are platform data. Ask a platform admin to seed the mockup scenes, and they appear here.";
export const NO_MATCH_TITLE = "No scene matches that";
export const NO_MATCH_BODY = "Clear the filters to see every scene again.";
export const CLEAR_FILTERS = "Clear the filters";
export const NO_PHOTOS_TITLE = "No photograph yet";
export const NO_PHOTOS_BODY = "Upload a photograph in the Uploads panel, or make a golden sample of this design to get its photographs.";
export const NO_BOARD_SCENE_TITLE = "No scene on this board yet";
export const NO_BOARD_SCENE_BODY = "Choose one in the Mockups panel and this board draws it.";
export const OPEN_MOCKUPS = "Open the Mockups panel";

/** Loading. A render takes seconds, so the panel says what is happening and how far it has got. */
export const RENDERING = "Drawing this mockup…";
export const RENDERING_HINT = "A product shot takes a few seconds. Nothing is spent: these are drawn from your design.";
export const LOADING_SCENES = "Loading the scenes…";

/** Errors. Each one says what to do next. */
export const RENDER_FAILED_TITLE = "That mockup could not be drawn";
export const RENDER_FAILED_BODY = "Try the scene again. If it keeps happening, choose another scene and tell us which one failed.";
export const SCENES_FAILED_TITLE = "The scenes could not be loaded";
export const SCENES_FAILED_BODY = "Reload the page. The library is platform data, so nothing of yours is lost.";

/** The board's own controls. */
export const SCENE_LABEL = "Scene";
export const CROP_LABEL = "Crop";
export const KIT_LABEL = "Kit";
export const COLOURWAY_LABEL = "Colourway";
export const ROSTER_ON_LABEL = "Show a name and number";
export const ROSTER_NAME_LABEL = "Name";
export const ROSTER_NUMBER_LABEL = "Number";
export const RENDER_LABEL = "Draw this mockup";
export const USE_SCENE_LABEL = "Use this scene";

/** The placement rule, said on the screen because the spec says it on the page. */
export const PLACEMENT_FIXED = "The scene decides where the garment sits, so the print area cannot be dragged. The garment is the design the platform drew, warped into the scene's own slot.";

/** The garment lock, said where somebody might expect to be able to break it. */
export const GARMENT_LOCKED = "Every scene starts from the design the platform drew. A model may change the light, the place and the pose, never the garment.";

/** What the board says while it waits for a design. */
export const NEEDS_DESIGN = "Connect a Design board to this one and the mockup follows it: change the design and this changes with it.";

/** The words beside a turned view, so nobody reads it as a photograph of the garment's side. */
export const TURNED_VIEW_LEAD = "About this view";

/** The heading of the gap list on a card or a board. */
export const GAPS_HEADING = "What this cannot show yet";
