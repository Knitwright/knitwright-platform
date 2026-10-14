import { resolveColour, type ArtworkStack } from "@/lib/artwork-stack";
import type { PrintIssue } from "../scene";
import { HEX } from "../rules/colour";

/** A colour with no screen colour is printed white and said so. */
export const UNSET_COLOUR = "#ffffff";

export interface Resolved {
  readonly hex: string;
  readonly issue: PrintIssue | null;
}

/** The screen colour of a colour id in a colourway. */
export function screenColour(stack: ArtworkStack, colourwayId: string, colourId: string): Resolved {
  const screen = resolveColour(stack, colourwayId, colourId)?.screen;
  if (screen !== undefined && HEX.test(screen)) return { hex: screen.toLowerCase(), issue: null };
  return { hex: UNSET_COLOUR, issue: { severity: "warn", text: `Colour ${colourId} has no screen colour, so it was printed white. Pick the colour before you print.` } };
}

export function screenColours(stack: ArtworkStack, colourwayId: string, ids: readonly string[]): { hexes: string[]; issues: PrintIssue[] } {
  const all = ids.map((id) => screenColour(stack, colourwayId, id));
  return { hexes: all.map((entry) => entry.hex), issues: all.flatMap((entry) => (entry.issue ? [entry.issue] : [])) };
}
