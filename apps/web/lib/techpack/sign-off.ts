import { TBC } from "./cell";
import type { SignOffSection } from "./types";
import { SECTION_TITLES } from "./types";

export const NOBODY_HAS_CHECKED = "Nobody has checked this specification yet.";

/**
 * A place for a named person and a date. It is always empty in this version. Nothing in the
 * document can fill it, and no value in the document is marked as checked.
 */
export function buildSignOff(): SignOffSection {
  return { id: "sign-off", title: SECTION_TITLES["sign-off"], note: null, statement: NOBODY_HAS_CHECKED, name: TBC, date: TBC };
}
