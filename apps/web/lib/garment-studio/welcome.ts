/**
 * THE BETA WELCOME (plan v6 G1, decision 0150; `08` v3.6, s01): shown the first time a person opens
 * Garment Studio, until they tick "Don't show this again".
 *
 * Per viewer and per browser: it is remembered in the browser's own storage, which may be missing
 * (a private window) or throw. Storage that cannot be read counts as "seen", so the modal never
 * traps a person whose browser will not remember them closing it.
 */

export const WELCOME_KEY = "kw.garment-studio.welcome";

/** What the browser keeps: "hidden" for good, or "shown" for the rest of this visit. */
export type WelcomeMark = "hidden" | "shown";

type Store = Pick<Storage, "getItem" | "setItem">;

export const WORKS_WELL: readonly string[] = [
  "Fabrics, colours, prints & trims",
  "Factory-approved options (collar, sleeve, length)",
  "3D fit check on our size set",
  "Tech pack editing",
];

export const COMING_SOON: readonly string[] = ["Layered garments (jacket over jersey)", "Zips and buttons in 3D", "Fit on your own player measurements"];

const read = (store: Store | null): string | null => {
  try {
    return store?.getItem(WELCOME_KEY) ?? null;
  } catch {
    return "unreadable";
  }
};

/** Whether to show the welcome now. Either store having a mark means no. */
export function shouldWelcome(local: Store | null, session: Store | null): boolean {
  if (local === null) return false;
  return read(local) === null && read(session) === null;
}

/**
 * Remembers the welcome was closed: for good in `local` when the box was ticked, else only for
 * this visit in `session`. A store that refuses is ignored; the modal still closes.
 */
export function rememberWelcome(local: Store | null, session: Store | null, forGood: boolean): void {
  const store = forGood ? local : session;
  const mark: WelcomeMark = forGood ? "hidden" : "shown";
  try {
    store?.setItem(WELCOME_KEY, mark);
  } catch {
    // Nothing to do: the person still gets on with designing.
  }
}
