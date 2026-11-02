import type { Kit, Sponsor } from "@/lib/clubs/kit";
import { gap, held, type Known } from "./gap";
import type { NumberRule, StorePersonalisation } from "./personalisation";

/**
 * A team store's configuration, from a club design (plan v5 O2; Z5's configurator, decision 0086,
 * and the club kit, decision 0062).
 *
 * This is a configuration and nothing else. There is no link here, no shop front, no takings and no
 * way to pay: a team store is the separate Store's own product, and what this platform can tell it
 * is what the club settled — the design, the colours, the crest, the sponsors, the fonts for names
 * and numbers, the season, the sizes the article grades to and the numbers the sport allows.
 *
 * Every one of those can be unset, because a club that has not chosen a colour has no colour, and
 * `EMPTY_KIT` says so with nulls. Each becomes a `Gap` on the way out: a Store handed `null` for a
 * primary colour can render black, and black is a decision nobody made.
 */

export const TEAM_STORE_HANDOVER =
  "A configuration, not a shop. Knitwright holds no shop front and no way to take money for a team store: this record is what the club settled, and the Store builds its own around it.";

export const COLOUR_SLOTS = ["primary", "secondary", "accent"] as const;
export type ColourSlot = (typeof COLOUR_SLOTS)[number];

export interface TeamStoreColour {
  readonly slot: ColourSlot;
  readonly colour: Known<{ hex: string }>;
}

export interface TeamStoreSeason {
  readonly seasonId: string;
  readonly name: string;
  readonly startsOn: Known<{ date: string }>;
  readonly endsOn: Known<{ date: string }>;
}

export interface TeamStoreInput {
  readonly brandId: string;
  readonly clubName: string;
  readonly kit: Kit;
  /** The saved design the kit was settled on. Null: the club has a kit but no design behind it. */
  readonly design: Readonly<{ projectId: string; version: number; name: string }> | null;
  readonly seasons: readonly Readonly<{ seasonId: string; name: string; startsOn: string | null; endsOn: string | null }>[];
  /** The sport's number rule, where the club's sport has a row. */
  readonly numbers: NumberRule | null;
  readonly sizes: readonly string[];
  readonly personalisation: StorePersonalisation;
}

export interface StoreTeamStore {
  readonly brandId: string;
  readonly clubName: string;
  readonly design: Known<{ projectId: string; version: number; name: string }>;
  readonly colours: readonly TeamStoreColour[];
  readonly crest: Known<{ fileId: string }>;
  readonly sponsors: readonly Sponsor[];
  readonly nameFont: string;
  readonly numberFont: string;
  readonly seasons: readonly TeamStoreSeason[];
  readonly numbers: Known<NumberRule>;
  readonly sizes: Known<{ run: readonly string[] }>;
  readonly personalisation: StorePersonalisation;
  /** Says plainly what this record is not, so nobody reads it as a shop. */
  readonly handover: typeof TEAM_STORE_HANDOVER;
}

const missing = (what: string, consequence: string): ReturnType<typeof gap> =>
  gap([what], `Knitwright holds no figure for ${what}, so ${consequence}`);

const colourOf = (slot: ColourSlot, hex: string | null): TeamStoreColour => ({
  slot,
  colour:
    hex === null
      ? missing(`the club's ${slot} colour`, "the Store must ask the club rather than choose one.")
      : held({ hex }),
});

const dateOf = (what: string, date: string | null): Known<{ date: string }> =>
  date === null ? missing(what, "the Store has no date for it.") : held({ date });

const seasonOf = (row: TeamStoreInput["seasons"][number]): TeamStoreSeason => ({
  seasonId: row.seasonId,
  name: row.name,
  startsOn: dateOf("the day this season starts", row.startsOn),
  endsOn: dateOf("the day this season ends", row.endsOn),
});

/** One club's configuration. Pure: every row it reads has already been read. */
export function storeTeamStore(input: TeamStoreInput): StoreTeamStore {
  const { kit } = input;
  return {
    brandId: input.brandId,
    clubName: input.clubName,
    design:
      input.design === null
        ? missing("the design this team store is built on", "the Store has nothing to show and must offer nothing.")
        : held({ ...input.design }),
    colours: [
      colourOf("primary", kit.primaryColour),
      colourOf("secondary", kit.secondaryColour),
      colourOf("accent", kit.accentColour),
    ],
    crest: kit.crestFileId === null ? missing("the club's crest", "the Store shows the kit without one.") : held({ fileId: kit.crestFileId }),
    sponsors: [...kit.sponsors],
    nameFont: kit.nameFont,
    numberFont: kit.numberFont,
    seasons: input.seasons.map(seasonOf),
    numbers:
      input.numbers === null
        ? missing("the numbers this club's sport allows", "the Store must take no number until a rule for the sport is on file.")
        : held({ ...input.numbers }),
    sizes:
      input.sizes.length === 0
        ? missing("the size run of this kit's article", "the Store has no size to offer.")
        : held({ run: [...input.sizes] }),
    personalisation: input.personalisation,
    handover: TEAM_STORE_HANDOVER,
  };
}
