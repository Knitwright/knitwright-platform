/**
 * Every sentence the video studio shows (plan v5 L5, spec F-L3).
 *
 * In one file so the words can be read as a whole and tested as a whole: nothing here says a thing is
 * checked, approved or final, nothing promises a price, and every wait says what is happening rather
 * than spinning. Secondary text in the launch chrome is `text-ink-2`, never `text-chalk-muted`, which
 * L1 found fails contrast on glass.
 */

export const PANEL_HEADING = "AI video";
export const PANEL_LEAD = "A clip between a first and an end frame. Both frames are pictures the platform drew, so the garment stays the one you designed.";

/** The empty states. Each one names the single action that fills the view. */
export const EMPTY_NO_BOARD = {
  title: "Nothing selected",
  line: "Pick an AI video board on the canvas to set its frames, its prompt and its model.",
  action: "Select a board",
} as const;

export const EMPTY_NO_DESIGN = {
  title: "No design behind this board",
  line: "A clip starts from the garment the platform drew. Join a Design board to this one, and the first frame comes from it.",
  action: "Join a Design board",
} as const;

export const EMPTY_NO_FRAME = {
  title: "No first frame yet",
  line: "Feed this board a mockup or an AI image. That picture is the first frame, and the garment in it is the one the clip keeps.",
  action: "Add a mockup board",
} as const;

export const FIRST_FRAME_LABEL = "First frame";
export const END_FRAME_LABEL = "End frame";
export const END_FRAME_OPTIONAL = "Optional. With no end frame the model only has the first one to work from.";
export const FRAME_EMPTY_LINE = "Nothing feeds this input yet.";

export const PRESETS_HEADING = "Prompt presets";
export const PRESETS_LEAD = "Each one moves the camera and the scene. None of them changes the garment.";
export const PROMPT_LABEL = "Anything else to add";
export const PROMPT_HINT = "The garment, its crest and its sponsors are kept whatever you type here.";

export const MODELS_HEADING = "Model";
export const MODELS_LEAD = "Each model has its own waiting time, its own credits a second and its own licence.";
export const MODEL_NONE_LINE = "No model is offered yet. A platform admin sets the list, its credits a second and which models hold a commercial licence.";
export const MODEL_UNKNOWN_LINE = "Not offered, because nothing here describes it:";

export const ASPECT_HEADING = "Aspect";
export const DURATION_LABEL = "Length in seconds";
export const AUDIO_LABEL = "Sound";
export const AUDIO_UNAVAILABLE = "This model makes no sound of its own, so there is nothing to turn on.";

export const RUN_HEADING = "Generate";
export const COST_UNKNOWN = "Nobody has set what this model costs a second, so it cannot be run yet.";
export const BALANCE_UNKNOWN = "Your credit balance could not be read just now.";
export const BUSY_LINE = "Something else is being saved or run. The controls come back when it is done.";

/** The stages of a run, in the order they happen. Honest progress, not a spinner. */
export const STAGE_LABELS = {
  waiting: "Waiting to start",
  asking: "Asking the model for the clip",
  sampling: "Taking frames out of the clip",
  checking: "Checking the garment in every frame",
  saving: "Saving the clip",
  done: "Done",
} as const;

export const GENERATING_PREFIX = "Generating";

/** What a failed run says: what happened, what it cost, and what to do next. */
export const FAILED_TITLE = "That clip was not made";
export const FAILED_COST_LINE = "A run that fails is not charged: any credits taken for it are given back.";
export const FAILED_WHAT_NEXT = "Try another preset, a shorter clip or a different model.";

export const PLAYER_HEADING = "Clip";
export const PLAYER_HINT = "Space or K plays and pauses, the arrow keys move by a second, M mutes.";
export const PLAYER_NO_CLIP = "This board has no clip yet.";
export const DOWNLOAD_LABEL = "Download";
export const GENERATED_BADGE = "AI-generated";
export const GENERATED_BADGE_LINE = "A model made this clip. The garment in it is the picture the platform drew.";

/** The deterministic studio. */
export const STUDIO_HEADING = "Video studio";
export const STUDIO_LEAD = "Four videos the platform draws from your 3D view. They are free, and the garment in them is exactly the one you designed.";
export const STUDIO_EMPTY = {
  title: "No 3D view open",
  line: "Open the 3D view of a design, and the videos below can be recorded from it.",
  action: "Open the 3D view",
} as const;
export const RECORD_LABEL = "Record";
export const RECORDING_PREFIX = "Recording";
export const SAVING_LINE = "Saving the video…";
export const SAVED_LINE = "Saved. It is free.";
export const UNSUPPORTED_LINE = "This browser cannot record the 3D view. Try a current Chrome, Edge, Firefox or Safari. Nothing was saved.";
export const TOO_BIG_LINE = "That recording came out too large to keep. Nothing was saved. Try a shorter one.";
export const RECORD_FAILED_LINE = "The recording did not work. Nothing was saved. Try again.";

export const TEMPLATES_HEADING = "Social frames";
export const TEMPLATES_LEAD = "The twelve video templates of the library, with your text burned into the picture.";

/** Shown wherever a credit figure appears, because no credit figure here is a price. */
export const PLACEHOLDER_NOTICE = "Credit figures are placeholders, not prices: nobody has set what a credit costs.";
