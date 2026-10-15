import type { StoredPrintProfile } from "../profiles";

/** Said in the margin when the print settings are Knitwright's own and not the print house's. Null when they are the print house's. */
export const defaultsNoteFor = (profile: StoredPrintProfile): string | null =>
  profile.source === "knitwright-default" ? "Bleed and resolution are Knitwright defaults, not from your print house." : null;

/** Said in every file's margin until fabric shrink is read from a fabric test. */
export const SHRINK_NOT_APPLIED = "Not scaled for shrink: this fabric has no shrink test.";
