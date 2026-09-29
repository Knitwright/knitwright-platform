/**
 * Limits on the pictures put into an export. They are PROVISIONAL ENGINEERING LIMITS, chosen to
 * keep one export inside the memory and time of a small function. They are not garment data and
 * no factory has asked for them. Whether they suit print is a question for the owner: see
 * OWNER-QUESTIONS.md, "Exports".
 *
 * The count of pictures and the number read at once are the same as for the screen (decision 0009):
 * see MAX_PICTURES_DRAWN and MAX_READS_AT_ONCE in lib/projects/artwork-images.ts.
 */

/** The longest side, in pixels, of a picture in an export. The screen uses 320. */
export const PRINT_EDGE = 1600;

/** The most bytes of pictures in one export, counted after they are shrunk. The screen allows 600 KB. */
export const PRINT_MAX_EMBEDDED_BYTES = 4 * 1024 * 1024;

/**
 * What a file says when a picture is left out because it is too big or there are too many. It has
 * no digit and no double hyphen, so it can sit in an XML comment and adds no number to the file.
 */
export const PICTURE_LEFT_OUT =
  "Some pictures are left out of this file because they are too big or there are too many. A dashed box marks where each one goes.";
