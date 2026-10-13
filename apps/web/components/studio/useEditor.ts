"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SpecAction } from "@/lib/garment";
import { createSettler } from "@/lib/projects/debounce";
import { anyDirty, markDirty, type DirtyFields } from "@/lib/projects/dirty-fields";
import { workingSpec } from "@/lib/projects/effective-spec";
import type { EditorData } from "@/lib/projects/editor-data";
import { isBusy, shownChoice, type Request } from "@/lib/projects/editor-state";
import type { EditIntent } from "@/lib/projects/field-text";
import { requestForIntent } from "@/lib/projects/measurement-request";
import { measurementKey, optionKey } from "./keys";
import { useColourEdits } from "./useColourEdits";
import { useEditorEngine } from "./useEditorEngine";

type Pick = Readonly<{ optionId: string; choiceId: string }>;

/** The name under which a problem with undo or restore is kept. */
export const HISTORY_KEY = "history";

const setOption = ({ optionId, choiceId }: Pick): SpecAction => ({
  type: "set-option",
  optionId,
  choiceId,
  provenance: "user-edited",
});

/**
 * Which fields hold text that was not saved, by name. `mark` never changes, and marking a
 * field as it already is draws nothing, so a field may report itself on every draw.
 */
const useDirtyFields = () => {
  const [dirty, setDirty] = useState<DirtyFields>({});
  const mark = useCallback((key: string, isDirty: boolean) => setDirty((before) => markDirty(before, key, isDirty)), []);
  return { flags: [anyDirty(dirty)], mark };
};

/** Everything the editor screen does, as plain functions for its parts to call. */
export const useEditor = (data: EditorData) => {
  const dirty = useDirtyFields();
  const { state, dispatch } = useEditorEngine(data.projectId, data.version, dirty.flags, data.spec);
  const queue = (key: string, request: Request, focus: boolean) => dispatch({ type: "enqueue", key, request, focus });
  const [settler] = useState(() =>
    createSettler<Pick>((key, pick, asked) => dispatch({ type: "enqueue", key, request: { kind: "action", action: setOption(pick) }, focus: asked })),
  );
  useEffect(() => () => settler.cancel(), [settler]);
  const problem = (key: string, message: string, focus: boolean) => dispatch({ type: "problem", key, message, focus });

  // The design as it will be once the saved and waiting changes reach the page. A colour or a
  // piece of artwork is worked out from this, so a second change does not undo the first.
  const { saved, inFlight, queue: waiting } = state;
  const working = useMemo(
    () => workingSpec(data.spec, data.version, { saved, inFlight, queue: waiting }),
    [data.spec, data.version, saved, inFlight, waiting],
  );

  const colours = useColourEdits(working, data.colourwayId, queue, problem);

  const editMeasurement = (pointId: string, intent: EditIntent, asked: boolean) => {
    const request = requestForIntent(data.spec, pointId, intent);
    if (request?.kind === "problem") problem(measurementKey(pointId), request.reason, asked);
    else if (request) queue(measurementKey(pointId), request, asked);
  };

  return {
    state,
    busy: isBusy(state),
    errorFor: (key: string): string | null => state.problems[key]?.message ?? null,
    choiceShown: (optionId: string, serverChoice: string | null) => shownChoice(state, optionKey(optionId), serverChoice),
    chooseOption: (optionId: string, choiceId: string) => {
      dispatch({ type: "choose", key: optionKey(optionId), value: choiceId });
      settler.change(optionKey(optionId), { optionId, choiceId });
    },
    settleOption: (optionId: string, asked: boolean) => settler.flush(optionKey(optionId), asked),
    editMeasurement,
    resetMeasurement: (pointId: string) => editMeasurement(pointId, { kind: "remove" }, true),
    clearProblem: (key: string) => dispatch({ type: "clearProblem", key }),
    saveSizes: (key: string, action: SpecAction) => queue(key, { kind: "action", action }, true),
    /** Any change already built and checked, saved under the name of the control it came from. */
    saveAction: (key: string, action: SpecAction) => queue(key, { kind: "action", action }, true),
    /** Sends again the save that failed on our side or never reached the server. */
    retry: () => dispatch({ type: "retry" }),
    working,
    ...colours,
    problem,
    undo: () => queue(HISTORY_KEY, { kind: "undo" }, true),
    restore: (version: number) => queue(HISTORY_KEY, { kind: "restore", version }, true),
    markDirty: dirty.mark,
  };
};

export type Editor = ReturnType<typeof useEditor>;
