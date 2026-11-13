"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** What a server action answers (`lib/server/core/create-define-action.ts`). */
type Reply<T> = Readonly<{ success: true; data: T }> | Readonly<{ success: false; error: Readonly<{ message: string }> }>;

export type Loaded<T> =
  | Readonly<{ state: "loading" }>
  | Readonly<{ state: "error"; message: string }>
  | Readonly<{ state: "ready"; data: T }>;

const LOST = "It could not be read. Check your connection and try again.";

/**
 * Reads once when a panel opens, through a server action, and again on `retry`. A reply lost on the
 * way is an error with a sentence, never a panel that spins for ever.
 */
export function useLoaded<T>(load: () => Promise<Reply<T>>, key: string): Readonly<{ loaded: Loaded<T>; retry: () => void }> {
  const [loaded, setLoaded] = useState<Loaded<T>>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  // `load` is a fresh closure each render; `key` says when it asks for something else.
  const latest = useRef(load);
  useEffect(() => {
    latest.current = load;
  });

  useEffect(() => {
    let live = true;
    latest
      .current()
      .catch(() => null)
      .then((reply) => {
        if (!live) return;
        if (reply === null) setLoaded({ state: "error", message: LOST });
        else if (!reply.success) setLoaded({ state: "error", message: reply.error.message });
        else setLoaded({ state: "ready", data: reply.data });
      });
    return () => {
      live = false;
    };
  }, [key, attempt]);

  const retry = useCallback(() => {
    setLoaded({ state: "loading" });
    setAttempt((n) => n + 1);
  }, []);
  return { loaded, retry };
}
