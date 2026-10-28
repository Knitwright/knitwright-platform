"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DesignProblem, DroppedNotice, SaveStatus } from "@/components/studio/EditorParts";
import { SaveRetry } from "@/components/studio/SaveRetry";
import { useEditorEngine } from "@/components/studio/useEditorEngine";
import type { GarmentSpec, SpecAction } from "@/lib/garment";
import { workingSpec } from "@/lib/projects/effective-spec";
import { isBusy } from "@/lib/projects/editor-state";
import { isSaving } from "@/lib/projects/saving-key";

/** The tech pack page keeps no typed text of its own in the queue's warning. */
const NO_DIRTY_FIELDS: readonly boolean[] = [];

/** What the forms on the tech pack page can do. They send changes through the same queue as the editor. */
interface TechPackEditApi {
  readonly save: (key: string, action: SpecAction) => void;
  /** Saves several changes as one version, so one undo takes them all back. Nothing is sent for none. */
  readonly saveMany: (key: string, actions: readonly SpecAction[]) => void;
  /** Keeps a mistake found before anything was sent with the control it belongs to, and moves focus to it. */
  readonly problem: (key: string, message: string) => void;
  readonly errorFor: (key: string) => string | null;
  readonly clearProblem: (key: string) => void;
  readonly busy: boolean;
  /** True while the change this control asked for is on its way or waiting its turn. */
  readonly saving: (key: string) => boolean;
  /**
   * The design as it will be once the waiting changes are saved. A change that rebuilds a whole
   * colourway, or confirms a seam, is worked out from this, so it does not undo one on its way.
   */
  readonly working: GarmentSpec;
}

const Context = createContext<TechPackEditApi | null>(null);

export function useTechPackEdit(): TechPackEditApi {
  const api = useContext(Context);
  if (!api) throw new Error("A tech pack form must be placed inside TechPackEdit.");
  return api;
}

type TechPackEditProps = Readonly<{ projectId: string; version: number; spec: GarmentSpec; children: ReactNode }>;

/**
 * Sends the changes made in the forms one at a time, at the newest version known, with the
 * same rules as the editor: a conflict stops everything with one message, and a lost reply is
 * checked before anything else is sent. The page shows what is happening.
 */
export function TechPackEdit({ projectId, version, spec, children }: TechPackEditProps) {
  const { state, dispatch } = useEditorEngine(projectId, version, NO_DIRTY_FIELDS, spec);
  const { saved, inFlight, queue } = state;
  const working = useMemo(
    () => workingSpec(spec, version, { saved, inFlight, queue }),
    [spec, version, saved, inFlight, queue],
  );
  const api = useMemo<TechPackEditApi>(
    () => ({
      save: (key, action) => dispatch({ type: "enqueue", key, request: { kind: "action", action }, focus: true }),
      saveMany: (key, actions) => {
        const [only, ...rest] = actions;
        if (!only) return;
        const request = rest.length === 0 ? { kind: "action" as const, action: only } : { kind: "actions" as const, actions };
        dispatch({ type: "enqueue", key, request, focus: true });
      },
      problem: (key, message) => dispatch({ type: "problem", key, message, focus: true }),
      errorFor: (key) => state.problems[key]?.message ?? null,
      clearProblem: (key) => dispatch({ type: "clearProblem", key }),
      busy: isBusy(state),
      saving: (key) => isSaving(state, key),
      working,
    }),
    [state, dispatch, working],
  );
  return (
    <Context.Provider value={api}>
      <div className="sticky top-24 z-30 flex flex-col gap-2 rounded-2xl px-4 py-2 [&:has(>:not(:empty))]:bg-surface-solid/90 [&:has(>:not(:empty))]:backdrop-blur">
        <SaveStatus busy={api.busy} status={state.status} />
        <DesignProblem message={state.conflict} conflict={state.conflict !== null} />
        <SaveRetry retry={state.retry} onRetry={() => dispatch({ type: "retry" })} />
      </div>
      <DroppedNotice dropped={state.dropped ?? []} />
      {children}
    </Context.Provider>
  );
}
