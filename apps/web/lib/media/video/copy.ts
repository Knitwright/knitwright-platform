/** Every sentence the turntable control shows (plain words, decision 0058). */

export const RECORD_LABEL = "Record turntable";
export const RECORDING_LABEL = "Recording… the garment turns once";
export const PREPARING_LABEL = "Getting the media set ready…";
export const SAVING_LABEL = "Saving the recording…";
export const SAVED_LABEL = "Turntable saved to this design's media set. It is free.";
export const UNSUPPORTED_MESSAGE = "This browser cannot record the 3D view. Try a current Chrome, Edge, Firefox or Safari. Nothing was saved.";
export const NO_VIEW_MESSAGE = "Open the 3D view first, then record the turntable.";
export const NO_PROJECT_MESSAGE = "Open a design first, then record the turntable.";
export const RECORD_FAILED_MESSAGE = "The recording did not work. Nothing was saved. Try again.";
export const TOO_BIG_MESSAGE = "The recording came out too large to keep. Nothing was saved. Try again.";
export const SET_TIMEOUT_MESSAGE = "The media set is taking too long. Nothing was saved. Try again in a minute.";
export const SAVE_FAILED_MESSAGE = "The recording could not be saved. Nothing was saved. Try again.";

/** The event the 3D viewers listen for on their canvas, to turn once in `revolutionSeconds`, or (null) to stop. */
export const TURN_EVENT = "knitwright:turn";
