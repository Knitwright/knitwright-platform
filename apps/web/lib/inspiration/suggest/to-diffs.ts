import { KIT_PATTERN_LABELS, availableChoices, getType, panelsFor, type GarmentSpec } from "@/lib/garment";
import type { DesignDiff } from "@/lib/design-diff/diff";
import type { TransferableElements } from "./elements";

/**
 * Turning transferable elements into design diffs (plan v5 Z1, decision 0082).
 *
 * Only three of the four diff kinds are ever built here: `set-colour`, `swap-style` and `change-option`. The fourth,
 * `move-placement`, moves a picture, and a suggestion made from an inspiration picture never touches artwork at all.
 * That is what keeps the rule provable: none of these three can name a file, an asset or an address, so no inspiration
 * image can reach a panel layer or a print file by this road.
 */

/** The diff kinds a suggestion may use. `lib/inspiration/no-pixels.ts` holds the test that proves it. */
export const SUGGESTION_DIFF_KINDS = ["set-colour", "swap-style", "change-option"] as const;
export type SuggestionDiff = Extract<DesignDiff, { kind: (typeof SUGGESTION_DIFF_KINDS)[number] }>;

/** A candidate patch and the one line that says what it changes. */
export type Candidate = Readonly<{ diff: SuggestionDiff; changes: string }>;

/** Something the card shows that this base article cannot do, said plainly. */
export type NotPossible = Readonly<{ wanted: string; sentence: string }>;

export type Mapped = Readonly<{ candidates: readonly Candidate[]; notPossible: readonly NotPossible[] }>;

const normalise = (text: string): string => text.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const words = (text: string): readonly string[] => normalise(text).split(" ").filter((part) => part !== "");

/** How close two names are: the share of the shorter one's words the other also holds. */
export function closeness(left: string, right: string): number {
  const first = words(left);
  const second = words(right);
  if (first.length === 0 || second.length === 0) return 0;
  const shared = first.filter((part) => second.includes(part)).length;
  return shared / Math.min(first.length, second.length);
}

/** The best match among a list of named things, when it shares at least one whole word. */
function bestMatch<T>(wanted: string, among: readonly T[], nameOf: (entry: T) => readonly string[]): T | null {
  const scored = among
    .map((entry) => ({ entry, score: Math.max(0, ...nameOf(entry).map((name) => closeness(wanted, name))) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
  return scored[0]?.entry ?? null;
}

/** The panel of the design whose id or label the model's word names, or null. */
function panelFor(spec: GarmentSpec, wanted: string): string | null {
  const panels = panelsFor(spec);
  const found = bestMatch(wanted, panels, (panel) => [panel.id, panel.label]);
  return found?.id ?? null;
}

/** Every colour role the card shows, as one `set-colour` per colour over the panels that take it. */
function colourDiffs(spec: GarmentSpec, elements: TransferableElements): Mapped {
  const candidates: Candidate[] = [];
  const notPossible: NotPossible[] = [];
  const byColour = new Map<string, { panels: string[]; swatch?: string }>();
  for (const role of elements.colourRoles) {
    const panel = panelFor(spec, role.panel);
    if (panel === null) {
      notPossible.push({ wanted: role.panel, sentence: `This base article has no ${role.panel.toLowerCase()} panel, so that colour has nowhere to go.` });
      continue;
    }
    const key = role.colour.trim().toLowerCase();
    const entry = byColour.get(key) ?? { panels: [], ...(role.swatch ? { swatch: role.swatch } : {}) };
    if (!entry.panels.includes(panel)) entry.panels.push(panel);
    byColour.set(key, entry);
  }
  for (const [colour, entry] of byColour) {
    candidates.push({
      diff: { kind: "set-colour", panels: entry.panels, colour, ...(entry.swatch ? { swatch: entry.swatch } : {}) },
      changes: `${colour} on the ${entry.panels.join(" and ")}`,
    });
  }
  return { candidates, notPossible };
}

/** The pattern family, as a style swap. A design with no pattern yet cannot have its style swapped. */
function patternDiff(spec: GarmentSpec, elements: TransferableElements): Mapped {
  const family = elements.patternFamily;
  if (family === null) return { candidates: [], notPossible: [] };
  if (!spec.kitPattern) {
    return {
      candidates: [],
      notPossible: [{ wanted: family, sentence: `This design has no pattern yet, so its style cannot be swapped to ${KIT_PATTERN_LABELS[family].toLowerCase()}. Add a pattern first.` }],
    };
  }
  if (spec.kitPattern.style === family) return { candidates: [], notPossible: [] };
  return { candidates: [{ diff: { kind: "swap-style", style: family }, changes: `the pattern as ${KIT_PATTERN_LABELS[family].toLowerCase()}` }], notPossible: [] };
}

/** An option the base offers, or the plain sentence that names the closest thing it does offer. */
function optionDiffs(spec: GarmentSpec, elements: TransferableElements): Mapped {
  const type = getType(spec.typeId);
  const candidates: Candidate[] = [];
  const notPossible: NotPossible[] = [];
  for (const wanted of elements.options) {
    const option = type === undefined ? null : bestMatch(wanted.group, type.options, (entry) => [entry.id, entry.label]);
    if (option === null) {
      notPossible.push({ wanted: `${wanted.choice} ${wanted.group}`, sentence: `This base article has no ${wanted.group.toLowerCase()} to change, so "${wanted.choice}" is not available on it.` });
      continue;
    }
    const offered = availableChoices(spec, option.id).filter((choice) => choice.available);
    const choice = bestMatch(wanted.choice, offered, (entry) => [entry.choiceId, entry.label]);
    if (choice === null) {
      const nearest = offered[0];
      const closest = nearest === undefined ? "Nothing on this base is close." : `The closest is ${nearest.label.toLowerCase()}.`;
      notPossible.push({ wanted: `${wanted.choice} ${wanted.group}`, sentence: `"${wanted.choice}" is not available on this base's ${option.label.toLowerCase()}. ${closest}` });
      continue;
    }
    if (spec.options[option.id]?.choiceId === choice.choiceId) continue;
    candidates.push({ diff: { kind: "change-option", optionId: option.id, choiceId: choice.choiceId }, changes: `${option.label.toLowerCase()} as ${choice.label.toLowerCase()}` });
  }
  return { candidates, notPossible };
}

/**
 * The patches a card's elements could become, and everything it shows that this base cannot do. Nothing here is shown
 * to anybody: each candidate still goes through validation (X4) first.
 */
export function diffsFor(spec: GarmentSpec, elements: TransferableElements): Mapped {
  const parts = [patternDiff(spec, elements), colourDiffs(spec, elements), optionDiffs(spec, elements)];
  const said = elements.notTransferable.map((wanted): NotPossible => ({ wanted, sentence: `${wanted} is not something this base article can do, so it was left out.` }));
  return { candidates: parts.flatMap((part) => part.candidates), notPossible: [...parts.flatMap((part) => part.notPossible), ...said] };
}
