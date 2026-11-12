import { pinterestOn, pinterestProvider, type PinterestAccess } from "./sources/external";
import type { Fetch, MaybeProvider } from "./sources/source";
import { noKeySentence } from "./vocabulary";

/**
 * The inspiration board's settings (plan v6 D4, decision 0135). They live here, in one place, so a later settings
 * console can pass others in; nothing that builds the board writes a literal in their place.
 *
 * **Pinterest is off.** Reading a person's own boards needs a Pinterest application of Knitwright's own, an OAuth
 * sign-in that stores their token, and Pinterest's Standard access for production. None of the three exists, so the
 * setting is `off` and the board says so. Turning it on is owner question 1 of decision 0135. The "Search on
 * Pinterest" button needs none of this and is shown either way.
 */

export const PINTEREST_STATES = ["off", "on"] as const;
export type PinterestState = (typeof PINTEREST_STATES)[number];

export type InspirationSettings = Readonly<{ pinterest: PinterestState }>;

/** What the board shows when nothing else is said. Labelled: a Knitwright default, not an owner's choice. */
export const INSPIRATION_SETTINGS_LABEL = "Knitwright default: Pinterest stays off until Knitwright has a Pinterest app";
export const DEFAULT_INSPIRATION_SETTINGS: InspirationSettings = { pinterest: "off" };

/** Said in the Pinterest row of the board while the setting is off. */
export const PINTEREST_OFF =
  "Your Pinterest boards are switched off here until Knitwright has its own Pinterest app. The Search on Pinterest button still works.";

/** Said when Pinterest is on but this person has not signed in to it. */
export const PINTEREST_NO_LOGIN = "Your Pinterest boards show nothing until you sign in to Pinterest from Knitwright.";

type Who = Readonly<{ brandId: string; userId: string }>;

/** One person's Pinterest login: their token and the boards they chose, or null when they have not signed in. */
export interface PinterestAccessReader {
  readonly accessFor: (who: Who) => Promise<PinterestAccess | null>;
}

/** No sign-in exists yet, so no person has a login to read. Production uses this until the OAuth app is built. */
export const NO_PINTEREST_LOGINS: PinterestAccessReader = { accessFor: async () => null };

type Env = Readonly<Record<string, string | undefined>>;

/**
 * The Pinterest row of the board. The setting is asked first, so while it is off nobody's login is even looked up;
 * then the key and the flag; then the person's own login.
 */
export async function pinterestEntry(settings: InspirationSettings, env: Env, logins: PinterestAccessReader, who: Who, fetchJson: Fetch): Promise<MaybeProvider> {
  if (settings.pinterest === "off") return { source: "pinterest-board", unavailable: PINTEREST_OFF };
  if (!pinterestOn(env)) return { source: "pinterest-board", unavailable: noKeySentence("Your Pinterest boards", "PINTEREST_APP_ID") };
  const access = await logins.accessFor(who);
  return access === null ? { source: "pinterest-board", unavailable: PINTEREST_NO_LOGIN } : pinterestProvider(access, fetchJson);
}
