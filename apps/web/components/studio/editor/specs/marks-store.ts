"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { SpecMark } from "@/lib/techpack/view";

/**
 * Where the marks the Specs toolbar draws are kept while a person works.
 *
 * The Specs toolbar and the tech pack view are **two different slots** of the editor shell
 * (`lib/editor/slots.ts`), and the slot contract gives a panel the design and the commands and
 * nothing else — no shared store. The toolbar must nevertheless write to the tech pack, which spec
 * F-S6 asks for, so the two share this one, keyed by the design and its version.
 *
 * **Nothing here is saved.** `EditorCommands.save` takes a `SpecAction`, and
 * `lib/garment/action-schema.ts` has no action that stores a founder's own point of measure or a
 * callout: `set-measurement` takes a `pointId` the garment registry must already know, so a mark
 * drawn on a panel has no id it could be stored under. A reload therefore loses the marks, and the
 * toolbar says so where a person can read it. This is a gap, not a design; the owner question is on
 * the pull request, and decision 0077 records it.
 */

const marksByDesign = new Map<string, readonly SpecMark[]>();
const listeners = new Set<() => void>();

/** One stable empty list, so a design with no marks gives the same reference every read. */
const NONE: readonly SpecMark[] = Object.freeze([]);

/** Names one design version's marks. A new version starts with none, as a new drawing does. */
export const marksKey = (projectId: string, version: number): string => `${projectId}@${version}`;

const announce = (): void => {
  for (const listener of [...listeners]) listener();
};

export const readMarks = (key: string): readonly SpecMark[] => marksByDesign.get(key) ?? NONE;

export function writeMarks(key: string, marks: readonly SpecMark[]): void {
  if (marks.length === 0) marksByDesign.delete(key);
  else marksByDesign.set(key, Object.freeze([...marks]));
  announce();
}

/** TEST SUPPORT. Empties every design's marks, so one test cannot see another's. */
export const resetMarks = (): void => {
  marksByDesign.clear();
  announce();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export type MarksHandle = Readonly<{
  marks: readonly SpecMark[];
  add: (mark: SpecMark) => void;
  remove: (id: string) => void;
  clear: () => void;
}>;

/** The marks of one design version, and the three things a panel does to them. */
export function useMarks(key: string): MarksHandle {
  // The same read on the server as on the client. On a real server render the store is empty, so
  // this is `NONE` anyway; reading it the same way both times keeps one rule for one question.
  const marks = useSyncExternalStore(
    subscribe,
    () => readMarks(key),
    () => readMarks(key),
  );
  const add = useCallback((mark: SpecMark) => writeMarks(key, [...readMarks(key), mark]), [key]);
  const remove = useCallback((id: string) => writeMarks(key, readMarks(key).filter((entry) => entry.id !== id)), [key]);
  const clear = useCallback(() => writeMarks(key, []), [key]);
  return { marks, add, remove, clear };
}
