"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { Dropped } from "@/lib/garment";
import type { Result } from "@/lib/server/core/errors";

/**
 * Sends the editor's changes to the server one after another. Each change carries the
 * version the design is at when it is sent, so changes made in quick succession never
 * clash with each other. A change that fails is reported beside the control that made it.
 */

export type Saved = Readonly<{ version: number; dropped: readonly Dropped[] }>;

export type Problem = Readonly<{
  /** The control the problem belongs to, or null when it belongs to the whole design. */
  key: string | null;
  message: string;
  conflict: boolean;
}>;

type Work = (expectedVersion: number) => Promise<Result<Saved>>;

const UNREACHABLE = "We could not reach the server. Check your connection and try again.";

export const useDesignChanges = (version: number) => {
  const latest = useRef(version);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [busy, setBusy] = useState(0);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [dropped, setDropped] = useState<readonly Dropped[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // A newer version arriving from the server, for example after a reload, wins.
  useEffect(() => {
    latest.current = version;
  }, [version]);

  const settle = useCallback((key: string | null, result: Result<Saved>) => {
    if (result.success) {
      const changed = result.data.version !== latest.current;
      latest.current = result.data.version;
      setProblem(null);
      setDropped(result.data.dropped);
      setStatus(changed ? `Saved as version ${result.data.version}.` : "Nothing changed.");
      return;
    }
    setStatus(null);
    setProblem({ key, message: result.error.message, conflict: result.error.code === "conflict" });
  }, []);

  const run = useCallback(
    (key: string | null, work: Work) => {
      setBusy((count) => count + 1);
      queue.current = queue.current.then(async () => {
        try {
          const result = await work(latest.current);
          startTransition(() => settle(key, result));
        } catch {
          startTransition(() => setProblem({ key, message: UNREACHABLE, conflict: false }));
        } finally {
          setBusy((count) => count - 1);
        }
      });
    },
    [settle],
  );

  /** Reports a problem found in the browser, before anything is sent. */
  const fail = useCallback((key: string, message: string) => {
    setStatus(null);
    setProblem({ key, message, conflict: false });
  }, []);

  return { run, fail, busy: busy > 0, problem, dropped, status };
};
