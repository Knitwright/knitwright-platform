/**
 * WHERE A STORED FILE'S PIXELS CAME FROM (H1 of the v5 security review, decision 0116).
 *
 * The garment lock asks three questions, and two of them were always answered server-side: *is
 * this board a kind a model draws?* comes from `boards.kind`, which is immutable after insert, and
 * *is there a generated board upstream?* comes from a recursive walk of `board_edges`. The third --
 * *did this file come out of a model?* -- was answered by a string in the request body, and
 * `public.files` held nothing that could answer instead: a deterministic mockup and an AI lifestyle
 * image are both stored as `kind: "render"`.
 *
 * So the file's own row answers it now. Every path that stores a file states which of these it is,
 * and the server reads the row rather than taking the caller's word. There is no provenance in any
 * request body any more, so there is nothing to spoof
 * (`lib/launch/garment-lock-provenance.test.ts` fails if one reappears).
 *
 * The column's default is `generated`, the restrictive value, so a store site that somehow writes
 * a row without saying loses the right to use it as artwork rather than gaining it.
 */

export const FILE_PROVENANCES = ["deterministic", "uploaded", "generated"] as const;

/**
 * * `deterministic` -- the platform's own code made these bytes from the design: a studio render,
 *   a mockup, a turntable's poster frame, a drafted DXF, a repeat print. No model was called.
 * * `uploaded` -- a person supplied the bytes: artwork, a sketch, a photograph, a size chart, a
 *   strike-off photo, a pattern a cutter delivered. Also the copies our own code derives from one
 *   of those, because the picture in them is still the person's. No model was called.
 * * `generated` -- a model made them. This is the one the lock turns on, and the one a file gets
 *   when nothing says otherwise.
 */
export type FileProvenance = (typeof FILE_PROVENANCES)[number];

/** The value a file takes when nothing can say what made it. The safe default is the strict one. */
export const UNKNOWN_PROVENANCE: FileProvenance = "generated";

/** Reads a provenance out of a `files` row, which is plain text to the client library. */
export const fileProvenanceOf = (value: unknown): FileProvenance =>
  FILE_PROVENANCES.includes(value as FileProvenance) ? (value as FileProvenance) : UNKNOWN_PROVENANCE;
