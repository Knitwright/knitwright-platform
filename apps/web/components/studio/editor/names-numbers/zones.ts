import { PLACE_DEFINITIONS, type PlayerMarkPlace } from "@/lib/garment";
import type { NamesNumbersPanel } from "@/lib/projects/names-numbers-controls";
import { RULE_GAP } from "@/lib/validation/rules";

/**
 * The zones names and numbers may go in (spec F-S4 "Zones are fixed by the base (R-PER rules)",
 * plan v5 Y8, decision 0081).
 *
 * **A zone is never invented here.** The zones offered are exactly the places the garment has a
 * panel and an anchor for, which `lib/projects/names-numbers-controls.ts` works out from the
 * registry (decision 0027); this module adds only the rulebook entry behind each one, so the panel
 * can show a Why? beside it. The rule's words come from the rulebook, never from this file: a
 * height, a cap height or a drop below the back neck is read from R-PER through the popover and is
 * not restated in TypeScript.
 *
 * The rulebook of the worked article (`docs/spec/articles/JSY-SS-01/rulebook.md`) names three:
 * R-PER-001 back name, R-PER-002 back number, R-PER-003 front number. It names nothing for a
 * number on the leg, so that zone carries `R-GAP-000` and is listed on the pull request.
 */

export const ZONE_RULES: Readonly<Record<PlayerMarkPlace, string>> = {
  "back-name": "R-PER-001",
  "back-number": "R-PER-002",
  "front-number": "R-PER-003",
  // The rulebook has no entry for a number on the leg. Never R-PER-002: that rule is the back.
  "leg-number": RULE_GAP,
};

/** How names and numbers are put on: one sublimation pass, R-PER-004. The method is not a zone. */
export const METHOD_RULE = "R-PER-004";

export interface Zone {
  readonly place: PlayerMarkPlace;
  readonly label: string;
  /** Whether this zone is ticked on the design now. */
  readonly on: boolean;
  /** The height typed for it, in centimetres, or empty where nobody has typed one. */
  readonly heightCm: string;
  /** The rulebook entry behind the zone. `R-GAP-000` where the rulebook has no words for it yet. */
  readonly ruleId: string;
  /** True where the rulebook has no entry yet, so the panel can say so rather than show a dead Why?. */
  readonly ruleMissing: boolean;
  /** Which panel and anchor the base fixes it to, for the line under the zone's name. */
  readonly anchorSentence: string;
}

/** Said above the zones, so nobody reads them as something the panel chooses. */
export const ZONES_LABEL = "The base article fixes where names and numbers go. You choose which of its zones to use.";

/**
 * The zones of this design, in the registry's own order. A garment with no place for names and
 * numbers gives none, and the panel says so rather than offering a zone the garment has not got.
 */
export function zonesOf(panel: NamesNumbersPanel | null): readonly Zone[] {
  if (!panel) return [];
  return panel.form.places.map((entry): Zone => {
    const ruleId = ZONE_RULES[entry.place];
    const definition = PLACE_DEFINITIONS[entry.place];
    return {
      place: entry.place,
      label: panel.placeLabels[entry.place] ?? definition.label,
      on: entry.on,
      heightCm: entry.heightCm,
      ruleId,
      ruleMissing: ruleId === RULE_GAP,
      anchorSentence: `${definition.shows === "name" ? "Name" : "Number"} on the ${definition.anchor.replaceAll("-", " ")} of ${definition.panelId.replaceAll("-", " ")}`,
    };
  });
}

/** The zones with no rulebook entry yet, for the pull request's list of gaps. */
export const zoneGaps = (zones: readonly Zone[]): readonly PlayerMarkPlace[] => zones.filter((zone) => zone.ruleMissing).map((zone) => zone.place);
