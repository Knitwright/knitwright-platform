import { PLACE_DEFINITIONS, PLAYER_MARK_PLACES, type PlayerMarkPlace } from "@/lib/garment/names-numbers";

/**
 * How long a name or a number may be in each place it is printed (spec F-T4 "names are checked
 * against the safe zone and character limits (maximum length per article and zone)", plan v5 Z7,
 * decision 0087).
 *
 * The zones are the places `lib/garment/names-numbers.ts` already names, so there is one list of
 * places in the platform and not two. The lengths are rows of `shirt_zone_limits`, read by
 * `service.ts` and passed in. The back name's row quotes R-PER-001 word for word; the others carry
 * `R-GAP-000`, because the rulebook gives the numbers' heights and not their lengths.
 */

export interface ZoneLimit {
  readonly zone: PlayerMarkPlace;
  readonly label: string;
  readonly maxCharacters: number;
  readonly ruleId: string;
  readonly note: string;
}

export type ZoneCheck =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; message: string; ruleId: string; zone: PlayerMarkPlace }>;

export const isZone = (value: unknown): value is PlayerMarkPlace => PLAYER_MARK_PLACES.some((place) => place === value);

/** The zone that decides how long a shirt name may be: the name across the upper back. */
export const NAME_ZONE: PlayerMarkPlace = "back-name";

/** The limit of one zone, or null when no row covers it. Nothing is guessed. */
export const limitOf = (limits: readonly ZoneLimit[], zone: PlayerMarkPlace): ZoneLimit | null =>
  limits.find((limit) => limit.zone === zone) ?? null;

/** The sentence the form shows under the name field, in the words of the row that sets it. */
export const zoneHint = (limit: ZoneLimit): string =>
  `Up to ${limit.maxCharacters} characters, because of the space on the ${PLACE_DEFINITIONS[limit.zone].label.toLowerCase()}.`;

/**
 * Whether a name fits every zone it will be printed in. A name is checked against each zone that
 * shows a name, so a design that prints the name twice cannot take a name only one of them fits.
 */
export function checkAgainstZones(limits: readonly ZoneLimit[], name: string): ZoneCheck {
  const text = name.trim();
  const nameZones = limits.filter((limit) => PLACE_DEFINITIONS[limit.zone].shows === "name");
  if (nameZones.length === 0) {
    return { ok: false, message: "This club has not set how long a shirt name may be. Ask them to set it.", ruleId: "R-GAP-000", zone: NAME_ZONE };
  }
  const tightest = nameZones.reduce((smallest, limit) => (limit.maxCharacters < smallest.maxCharacters ? limit : smallest), nameZones[0] as ZoneLimit);
  if (text.length === 0) return { ok: false, message: "Enter the name you want on your shirt.", ruleId: tightest.ruleId, zone: tightest.zone };
  if (text.length > tightest.maxCharacters) {
    return {
      ok: false,
      message: `A name on the ${PLACE_DEFINITIONS[tightest.zone].label.toLowerCase()} fits ${tightest.maxCharacters} characters. Yours has ${text.length}.`,
      ruleId: tightest.ruleId,
      zone: tightest.zone,
    };
  }
  return { ok: true };
}
