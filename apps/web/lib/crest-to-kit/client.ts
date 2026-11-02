import { REFUSALS } from "./words";
import type { KitsView } from "./view";

/**
 * What the crest-to-kit screen does with its route. The fetcher is passed in, so the code can be
 * tested without a browser, exactly as artwork intake's own client module is.
 *
 * It imports nothing but words and types: the screen never holds the garment rules, and the kits
 * come back as the view model the server built.
 */

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export type Outcome<T> = Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; reason: string }>;

export const KITS_PATH = "/api/crest-to-kit";

export interface AskForKits {
  readonly crest: File | null;
  readonly sportId: string;
  readonly roles: string;
  readonly feel: string;
  readonly clubName: string;
  readonly colours: readonly string[];
}

/** The form the route reads. A field nobody filled in is simply not sent. */
export function kitsForm(ask: AskForKits): FormData {
  const form = new FormData();
  if (ask.crest !== null) form.set("file", ask.crest);
  form.set("sportId", ask.sportId);
  form.set("roles", ask.roles);
  form.set("feel", ask.feel);
  if (ask.clubName.trim() !== "") form.set("clubName", ask.clubName.trim());
  for (const colour of ask.colours) form.append("colour", colour);
  return form;
}

/** The kits for one crest, or the reason there are none, in words the club can act on. */
export async function askForKits(fetcher: Fetcher, ask: AskForKits): Promise<Outcome<KitsView>> {
  if (ask.crest === null && ask.colours.length === 0) return { ok: false, reason: REFUSALS.noFile };
  try {
    const response = await fetcher(KITS_PATH, { method: "POST", body: kitsForm(ask) });
    const body = (await response.json()) as { success?: boolean; data?: KitsView; error?: { message?: string } };
    if (body.success === true && body.data !== undefined) return { ok: true, data: body.data };
    return { ok: false, reason: body.error?.message ?? REFUSALS.generic };
  } catch {
    return { ok: false, reason: REFUSALS.generic };
  }
}
