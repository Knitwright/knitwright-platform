"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import type { CanvasView, FormValues, RailSegment } from "@/lib/editor";
import { toggled, withEditorState } from "@/lib/editor";
import { withSearchParam } from "@/lib/workspace/tools";

/**
 * The editor's own state: which toolbar is open, which views are on the canvas, which size and
 * colourway are shown, and the form the person has chosen. All of it lives in the address, as the
 * open tool already does, so a reload or a shared link opens the same design in the same state and
 * the server re-drafts it (`lib/editor/address.ts`).
 *
 * A change is shown at once and the address is rewritten in the same transition, so the sliders
 * move under the hand while the server catches up with the new draft and the new model.
 */
export interface ShellState {
  readonly segment: RailSegment;
  readonly view: CanvasView;
  readonly beside: CanvasView | null;
  readonly size: string;
  readonly form: FormValues;
}

export function useShell(initial: ShellState) {
  const router = useRouter();
  const path = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState(initial);
  const [pending, start] = useTransition();

  const go = useCallback(
    (next: ShellState) => {
      setState(next);
      start(() => {
        router.replace(`${path}${withEditorState(search.toString(), next)}` as Route, { scroll: false });
      });
    },
    [path, router, search],
  );

  const openRail = useCallback((segment: RailSegment) => go({ ...state, segment }), [go, state]);

  const showView = useCallback(
    (asked: CanvasView, alongside: boolean) => go({ ...state, ...toggled(state.view, state.beside, asked, alongside) }),
    [go, state],
  );

  const setSize = useCallback((size: string) => go({ ...state, size }), [go, state]);

  const setOption = useCallback(
    (group: string, code: string) => go({ ...state, form: { ...state.form, options: { ...state.form.options, [group]: code } } }),
    [go, state],
  );

  const setParameter = useCallback(
    (key: string, mm: number) => go({ ...state, form: { ...state.form, parameters: { ...state.form.parameters, [key]: mm } } }),
    [go, state],
  );

  /** The colourway is its own search parameter, shared with the Colours panel and the drawing. */
  const setColourway = useCallback(
    (id: string) => {
      start(() => {
        router.replace(`${path}${withSearchParam(search.toString(), "colourway", id)}` as Route, { scroll: false });
      });
    },
    [path, router, search],
  );

  /** Asks the server for the draft and the model again, for the Simulate button. */
  const resimulate = useCallback(() => start(() => router.refresh()), [router]);

  return { state, pending, openRail, showView, setSize, setOption, setParameter, setColourway, resimulate };
}

export type Shell = ReturnType<typeof useShell>;
