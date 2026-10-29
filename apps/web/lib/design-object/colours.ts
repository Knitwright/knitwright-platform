import { resolveColour, type ArtworkStack } from "@/lib/artwork-stack";
import type { DoColour } from "./types";

const DIGIT_LETTERS = "abcdefghij";

/** The spec's roles are lower case letters and underscores. A stack colour id becomes one: dashes to underscores, digits to letters. */
const roleShape = (id: string): string => id.replace(/-/g, "_").replace(/[0-9]/g, (d) => DIGIT_LETTERS[Number(d)] ?? "_");

/** One role per colour id, unique: a clash gains `_x` until it is free. Deterministic for a given stack. */
export function rolesOf(stack: ArtworkStack): ReadonlyMap<string, string> {
  const taken = new Set<string>();
  const roles = new Map<string, string>();
  for (const colour of stack.colours) {
    let role = roleShape(colour.id);
    while (taken.has(role)) role = `${role}_x`;
    taken.add(role);
    roles.set(colour.id, role);
  }
  return roles;
}

/** The colours of the first colourway that have a screen colour. A colour with none has no hex to export. */
export function colourwayColours(stack: ArtworkStack, roles: ReadonlyMap<string, string>): readonly DoColour[] {
  const colourwayId = stack.colourways[0]?.id;
  return stack.colours.flatMap((colour) => {
    const value = resolveColour(stack, colourwayId, colour.id);
    if (value?.screen === undefined) return [];
    const pantone = value.codes.find((code) => code.system === "pantone-tcx" || code.system === "pantone-tpg")?.value;
    return [{ role: roles.get(colour.id) ?? roleShape(colour.id), hex: value.screen, ...(pantone === undefined ? {} : { pantone }) }];
  });
}
