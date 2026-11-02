import type { ClubColours } from "@/lib/kit-styles/presets";
import { bundleColours, NEEDS_THIRD_COLOUR } from "@/lib/teamwear/bundles";
import type { CrestColour } from "./palette";
import { feelById, ROLE_LABELS, type FeelId, type KitRoleId } from "./settings";

/**
 * Which colour goes where (spec F-T2 step 3). The arrangement is Z5's own: `bundleColours`
 * (decision 0086) already says what a home, away and goalkeeper kit do with a club's colours, and
 * crest-to-kit calls it rather than keeping a second answer that could drift from the
 * configurator's. A kit this engine proposes therefore arranges colours exactly as the Home, Away
 * and Goalkeeper buttons in the configurator do.
 *
 * NO COLOUR IS EVER INVENTED. The colours are the crest's own, snapped to what a sublimation print
 * is estimated to reach. A crest with one colour cannot make a kit with a trim, and a two-colour
 * crest cannot make a goalkeeper kit, so both say what is missing and ask the club for it.
 */

/** The colours a kit is built from, and which part of the crest's palette each came from. */
export interface Arrangement {
  readonly role: KitRoleId;
  readonly roleLabel: string;
  readonly colours: ClubColours;
  readonly socksColour: string;
  /** One line naming where the colours came from, for the card and the design's own history. */
  readonly note: string;
}

export type ArrangeOutcome =
  | Readonly<{ ok: true; arrangements: readonly Arrangement[] }>
  | Readonly<{ ok: false; reason: string }>;

/** Said where the crest yields one colour only: a kit needs a second for its trims. */
export const NEEDS_SECOND_COLOUR =
  "Your crest reads as one colour, and a kit needs a second for its trims. Pick a second colour and Knitwright will build the kits around it.";

/** Said where there is nothing to read at all. */
export const NEEDS_ANY_COLOUR =
  "No colour could be read from that crest. It may be a drawing with nothing filled in, or wholly transparent. Pick your colours instead and Knitwright will build the kits around them.";

/**
 * The club's colours as the palette gives them: the dominant colour on the body, the next for
 * trims, and a third where the feel asks for one and the palette has one.
 *
 * Each is the colour a sublimation print is ESTIMATED to reach (`safeHex`), not the screen colour,
 * because that is the colour a club would actually receive. Where the estimate changed nothing the
 * two are the same colour, which is the usual case.
 */
export function clubColoursFor(palette: readonly CrestColour[], feel: FeelId): ClubColours | null {
  const safe = palette.map((colour) => colour.safeHex);
  if (safe.length < 2) return null;
  const third = feelById(feel).colours === 3 ? (safe[2] ?? null) : null;
  return { main: safe[0]!, second: safe[1]!, third };
}

const noteFor = (role: KitRoleId, colours: ClubColours): string => {
  const parts = [`${colours.main} on the body`, `${colours.second} on the trims`];
  if (colours.third !== null) parts.push(`${colours.third} as the accent`);
  return `${ROLE_LABELS[role]}: ${parts.join(", ")}, all read from your crest.`;
};

/**
 * One arrangement per role asked for, or the reason there is none. A role that cannot be arranged
 * from these colours — a goalkeeper kit from two — is left out and named, so a club asking for all
 * three still gets the two it can have.
 */
export function arrangementsFor(palette: readonly CrestColour[], feel: FeelId, roles: readonly KitRoleId[]): ArrangeOutcome {
  if (palette.length === 0) return { ok: false, reason: NEEDS_ANY_COLOUR };
  const club = clubColoursFor(palette, feel);
  if (club === null) return { ok: false, reason: NEEDS_SECOND_COLOUR };
  const arranged = roles.flatMap((role) => {
    const outcome = bundleColours(role, club);
    if (!outcome.ok) return [];
    return [
      {
        role,
        roleLabel: ROLE_LABELS[role],
        colours: outcome.colours.colours,
        socksColour: outcome.colours.socksColour,
        note: noteFor(role, outcome.colours.colours),
      },
    ];
  });
  if (arranged.length === 0) return { ok: false, reason: NEEDS_THIRD_COLOUR };
  return { ok: true, arrangements: arranged };
}

/** The roles that could not be arranged from these colours, with the reason, for the screen to say. */
export function unarrangedRoles(palette: readonly CrestColour[], feel: FeelId, roles: readonly KitRoleId[]): readonly string[] {
  const club = clubColoursFor(palette, feel);
  if (club === null) return roles.map((role) => `${ROLE_LABELS[role]}: ${NEEDS_SECOND_COLOUR}`);
  return roles.flatMap((role) => {
    const outcome = bundleColours(role, club);
    return outcome.ok ? [] : [`${ROLE_LABELS[role]}: ${outcome.reason}`];
  });
}
