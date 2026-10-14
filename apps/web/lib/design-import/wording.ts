/**
 * The sentences that go with every import, in plain words. The screen always shows the limits. The words
 * "exact", "matches your picture" and "identical" are never used: this is a close reading, not a copy.
 */

export const CLOSE_READING = "Close reading of your picture";

export const READING_INTRO =
  "We read your picture into a design you can edit. It is a close reading, not a copy: look at both pictures side by side, and change anything that is off.";

export const ACCURACY_LIMITS: readonly string[] = [
  "Shading, folds and lighting in a photo are part of the colours that were read.",
  "A worn or angled garment is flattened approximately. Curved fabric is not straightened out.",
  "Small or stylised lettering may be read wrongly.",
  "Logos are redrawn, not lifted from the picture. Replace each one with your own file.",
  "A view that is not in the picture, usually the back and the sleeves, is left empty and named. It is never invented.",
  "The size of a repeat is estimated from the picture, so check it.",
];

export const NOT_READ_YET: readonly string[] = [
  "Names, numbers, crests and sponsors seen in the picture are listed but not placed on the design yet.",
  "Repeating patterns are not read yet. The main colour becomes the ground.",
];

export const NOT_SAVED = "Nothing is saved to your design until you accept it.";

export const SWITCHED_OFF = "Making a design from a picture is not switched on yet. Nothing was changed.";
export const PICTURE_NOT_FOUND = "That picture could not be found. Upload it again. Nothing was changed.";
export const PICTURE_TOO_LARGE = "That picture is too large to read. Use one under 5 MB. Nothing was changed.";
export const PICTURE_NOT_OPENED = "That picture could not be opened. Upload a PNG, JPEG or WebP image. Nothing was changed.";
export const READ_FAILED = "The picture could not be read just now. Nothing was changed. Try again in a moment.";
export const IMPORT_NOT_FOUND = "That reading does not exist.";
export const IMPORT_NOT_READY = "That reading is not ready to accept.";
export const IMPORT_CLOSED = "That reading has already been accepted or discarded.";
export const DAILY_CAP_REACHED = "Your brand has read as many pictures as it can today. Try again tomorrow. Nothing was changed.";
