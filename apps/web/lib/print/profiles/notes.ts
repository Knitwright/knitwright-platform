import type { PrintRuleSet } from "@/lib/production/contract";
import type { StoredPrintProfile } from "./schemas";

/**
 * Plain sentences about what the print settings do and do not rest on, for the page and for the
 * margin of a print file. `rules` are the brand's league rule sets, none when it has set none. A default is said to be a default; a missing rule is said to be missing.
 */
export function profileNotes(profile: StoredPrintProfile, rules: readonly PrintRuleSet[]): string[] {
  const notes: string[] = [];
  if (profile.source === "knitwright-default") {
    notes.push(`Bleed ${profile.bleedMm} mm and ${profile.dpi} dpi are Knitwright defaults, not from your print house.`);
  } else {
    notes.push(`Bleed ${profile.bleedMm} mm and ${profile.dpi} dpi are the settings you saved from your print house.`);
  }
  if (!profile.iccFileId) notes.push("No colour profile is uploaded, so files carry no colour profile.");
  if (profile.maxPrintWidthMm === null) notes.push("No widest print is set, so pieces are not compared with the printer's width.");
  if (rules.every((r) => r.coloursToAvoid.length === 0)) notes.push("No colours to avoid are set, so none were checked.");
  if (rules.every((r) => r.minTextHeightMm === null)) notes.push("No smallest text height is set, so text size was not held to a limit.");
  if (rules.every((r) => r.minLineMm === null)) notes.push("No thinnest line is set, so line weight was not held to a limit.");
  if (rules.length === 0) notes.push("No league rules are set: check with the competition.");
  return notes;
}
