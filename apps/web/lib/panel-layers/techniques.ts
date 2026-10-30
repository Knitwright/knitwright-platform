import { TECHNIQUES } from "@/lib/garment/parts";
import { GAP_RULE_ID } from "@/lib/rulebook/constants";

/**
 * Which decoration methods the Edit Graphic panel offers (spec F-S4: "Type: Sublimation (default) /
 * Heat transfer / Embroidery (only if the factory profile supports it)"), from plan v5 Y3,
 * decision 0076.
 *
 * The factory model (X6, decision 0071) records a factory's articles, fabrics, lead times, file
 * formats and colour tolerance, but **not** which decoration methods it runs. So the panel does not
 * guess: a method the profile does not list is offered locked, with the reason and a Why? link, in
 * exactly the way the Form toolbar locks an option no sample has approved. Sublimation is the one
 * method a base article states for itself (`article.json` `print.method`, R-SUB-001), so it is the
 * default and is never locked for a sublimated article.
 */

export type Technique = (typeof TECHNIQUES)[number];

export const TECHNIQUE_LABELS: Readonly<Record<Technique, string>> = {
  sublimation: "Sublimation",
  transfer: "Heat transfer",
  "screen-print": "Screen print",
  embroidery: "Embroidery",
};

/** What a factory says it can do. `methods` empty means the profile does not say, never "none". */
export interface DecorationProfile {
  /** The methods the profile lists, by their `TECHNIQUES` ids. */
  readonly methods: readonly Technique[];
  /** Who agreed this profile, shown with any lock. */
  readonly label: string;
}

export interface TechniqueChoice {
  readonly technique: Technique;
  readonly label: string
  readonly chosen: boolean;
  /** Null when the method can be chosen; otherwise why it cannot, in plain words. */
  readonly lockNote: string | null;
  readonly ruleId: string;
}

export const NO_PROFILE_LABEL = "No factory profile is on file, so no decoration method has been agreed.";
/** The rule that states a sublimated article's print method. */
export const SUBLIMATION_RULE_ID = "R-SUB-001";

/** The profile used until the shell passes a real one: it lists nothing and says so. */
export const unknownDecorationProfile = (): DecorationProfile => ({ methods: [], label: NO_PROFILE_LABEL });

/**
 * The method tiles, in the spec's order. Sublimation is offered for an article whose own print
 * method is sublimation; every other method needs the profile to list it.
 */
export function techniqueChoices(profile: DecorationProfile, chosen: Technique, sublimated = true): readonly TechniqueChoice[] {
  return TECHNIQUES.map((technique): TechniqueChoice => {
    const listed = profile.methods.includes(technique);
    const byArticle = technique === "sublimation" && sublimated;
    return {
      technique,
      label: TECHNIQUE_LABELS[technique],
      chosen: technique === chosen,
      lockNote: listed || byArticle ? null : `${profile.label} does not say it can do ${TECHNIQUE_LABELS[technique].toLowerCase()}`,
      ruleId: byArticle ? SUBLIMATION_RULE_ID : GAP_RULE_ID,
    };
  });
}

/** True when the panel may set this method. A locked method is shown, never silently dropped. */
export const techniqueAllowed = (profile: DecorationProfile, technique: Technique, sublimated = true): boolean =>
  techniqueChoices(profile, technique, sublimated).some((choice) => choice.technique === technique && choice.lockNote === null);
