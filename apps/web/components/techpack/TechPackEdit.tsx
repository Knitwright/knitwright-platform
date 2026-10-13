"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DesignProblem, DroppedNotice, SaveStatus } from "@/components/studio/EditorParts";
import { SaveRetry } from "@/components/studio/SaveRetry";
import { useEditorEngine } from "@/components/studio/useEditorEngine";
import type { SpecAction } from "@/lib/garment";
import { isBusy } from "@/lib/projects/editor-state";

/** What the forms on the tech pack page can do. They send changes through the same queue as the editor. */
export interface TechPackEditApi {
  readonly save: (key: string, action: SpecAction) => void;
  readonly errorFor: (key: string) => string | null;
  readonly clearProblem: (key: string) => void;
  readonly busy: boolean;
}

const Context = createContext<TechPackEditApi | null>(null);

export function useTechPackEdit(): TechPackEditApi {
  const api = useContext(Context);
  if (!api) throw new Error("A tech pack form must be placed inside TechPackEdit.");
  return api;
}

type TechPackEditProps = Readonly<{ projectId: string; version: number; children: ReactNode }>;

/**
 * Sends the changes made in the forms one at a time, at the newest version known, with the
 * same rules as the editor: a conflict stops everything with one message, and a lost reply is
 * checked before anything else is sent. The page shows what is happening.
 */
export function TechPackEdit({ projectId, version, children }: TechPackEditProps) {
  const { state, dispatch } = useEditorEngine(projectId, version, []);
  const api = useMemo<TechPackEditApi>(
    () => ({
      save: (key, action) => dispatch({ type: "enqueue", key, request: { kind: "action", action }, focus: true }),
      errorFor: (key) => state.problems[key]?.message ?? null,
      clearProblem: (key) => dispatch({ type: "clearProblem", key }),
      busy: isBusy(state),
    }),
    [state, dispatch],
  );
  return (
    <Context.Provider value={api}>
      <div className="sticky top-0 z-10 flex flex-col gap-2 bg-shell/90 py-2 backdrop-blur">
        <SaveStatus busy={api.busy} status={state.status} />
        <DesignProblem message={state.conflict} conflict={state.conflict !== null} />
        <SaveRetry retry={state.retry} onRetry={() => dispatch({ type: "retry" })} />
      </div>
      <DroppedNotice dropped={state.dropped ?? []} />
      {children}
    </Context.Provider>
  );
}
