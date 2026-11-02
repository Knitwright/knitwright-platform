"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * One read of one route handler, with the three states a panel must be able to draw: reading it,
 * holding it, and unable to read it (plan v5, decision 0108).
 *
 * The panel contract hands a panel the project and the commands and says plainly that "a panel
 * never fetches" -- meaning the shell never hands it something unsaved. The panels of this
 * directory show the brand's own rows and the platform's template library, and neither is on the
 * canvas, so they read them the way every other panel of this app reads rows it does not own:
 * through a route handler (`components/production/fabrics/FabricPanel.tsx`,
 * `components/credits/PriceNote.tsx`). Nothing here writes, and nothing here is a command.
 *
 * The answer is kept against the address it came from rather than reset when the address changes,
 * so no state is set while the effect runs (`react-hooks/set-state-in-effect`) and a slow answer
 * can never overwrite a newer one -- which is what makes a search box that asks the server safe to
 * type into.
 */

export type Loaded<T> = Readonly<{ kind: "loading" } | { kind: "ready"; value: T } | { kind: "failed" }>;

/** An answer, and which read it was the answer to. */
type Held<T> = Readonly<{ url: string; nonce: number; state: Loaded<T> }>;

const READING: Loaded<never> = { kind: "loading" };

const readJson = async <T,>(url: string, signal: AbortSignal): Promise<T> => {
  const response = await fetch(url, { cache: "no-store", signal });
  const body = (await response.json()) as Readonly<{ success?: boolean; data?: T }>;
  if (!response.ok || body.success !== true || body.data === undefined) throw new Error("That could not be read.");
  return body.data;
};

type Read<T> = Readonly<{
  state: Loaded<T>;
  /** The last answer that arrived, whatever the current state is, so a panel never empties. */
  last: T | null;
  reload: () => void;
}>;

/** Reads `url` once, again whenever it changes, and again when `reload` is called. */
export function useJson<T>(url: string): Read<T> {
  const [held, setHeld] = useState<Held<T> | null>(null);
  const [last, setLast] = useState<T | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    readJson<T>(url, controller.signal).then(
      (value) => {
        if (controller.signal.aborted) return;
        setHeld({ url, nonce, state: { kind: "ready", value } });
        setLast(value);
      },
      () => {
        if (!controller.signal.aborted) setHeld({ url, nonce, state: { kind: "failed" } });
      },
    );
    return () => controller.abort();
  }, [url, nonce]);

  const answered = held !== null && held.url === url && held.nonce === nonce;
  return { state: answered ? held.state : READING, last, reload: useCallback(() => setNonce((was) => was + 1), []) };
}
