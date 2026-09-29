"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useReducer, useRef, type Dispatch } from "react";
import {
  applyDesignActionAction,
  readVersionAction,
  restoreVersionAction,
  undoDesignAction,
} from "@/lib/projects/actions";
import {
  canStart,
  editorReducer,
  initialEditorState,
  isBusy,
  type EditorEvent,
  type EditorState,
  type InFlight,
} from "@/lib/projects/editor-state";
import { hasUnsavedWork } from "@/lib/projects/field-text";
import { focusField } from "./focus-field";

/**
 * Wires the editor's reducer to the server and the page: it sends the change that is on
 * its way, reads the design again after a lost reply, moves focus when asked, and warns
 * before the page is left with work unsaved. The rules themselves live in the reducer.
 */

const UNREACHABLE = "We could not reach the server. Check your connection and try again.";
const CANNOT_CHECK = "We could not check the design. Reload the page to see the latest version.";

const describe = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const send = (projectId: string, change: InFlight) => {
  const { expectedVersion, request } = change;
  switch (request.kind) {
    case "action":
      return applyDesignActionAction({ projectId, expectedVersion, action: request.action });
    case "restore":
      return restoreVersionAction({ projectId, expectedVersion, version: request.version });
    case "undo":
      return undoDesignAction({ projectId, expectedVersion });
  }
};

/** Sends the change that is on its way, once, and reports how it went. */
const useSending = (projectId: string, state: EditorState, dispatch: Dispatch<EditorEvent>): void => {
  const sent = useRef(new Set<number>());
  useEffect(() => {
    const change = state.inFlight;
    if (!change || sent.current.has(change.id)) return;
    sent.current.add(change.id);
    send(projectId, change).then(
      (result) =>
        startTransition(() =>
          dispatch(
            result.success
              ? { type: "succeeded", id: change.id, version: result.data.version, dropped: result.data.dropped }
              : { type: "failed", id: change.id, code: result.error.code, message: result.error.message },
          ),
        ),
      (error: unknown) => dispatch({ type: "lost", id: change.id, message: UNREACHABLE, detail: describe(error) }),
    );
  }, [projectId, state.inFlight, dispatch]);
};

/** After a lost reply the server may have saved. Read the design before sending anything else. */
const useRefreshAfterLostReply = (projectId: string, needsRefresh: boolean, dispatch: Dispatch<EditorEvent>): void => {
  const router = useRouter();
  useEffect(() => {
    if (!needsRefresh) return;
    readVersionAction({ projectId }).then(
      (result) => {
        if (!result.success) return dispatch({ type: "refreshFailed", message: CANNOT_CHECK });
        dispatch({ type: "refreshed", version: result.data.version });
        router.refresh();
      },
      () => dispatch({ type: "refreshFailed", message: CANNOT_CHECK }),
    );
  }, [projectId, needsRefresh, dispatch, router]);
};

const useFocusRequests = (state: EditorState, dispatch: Dispatch<EditorEvent>): void => {
  useEffect(() => {
    if (!state.focusKey) return;
    focusField(state.focusKey);
    dispatch({ type: "focused" });
  }, [state.focusKey, dispatch]);
};

const useLeaveWarning = (unsaved: boolean): void => {
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);
};

export const useEditorEngine = (projectId: string, version: number, dirtyFields: readonly boolean[]) => {
  const [state, dispatch] = useReducer(editorReducer, version, initialEditorState);

  // A newer version arriving from the server ends a conflict and drops choices not yet saved.
  useEffect(() => dispatch({ type: "seen", version }), [version]);
  useEffect(() => {
    if (canStart(state)) dispatch({ type: "start" });
  }, [state]);

  useSending(projectId, state, dispatch);
  useRefreshAfterLostReply(projectId, state.needsRefresh, dispatch);
  useFocusRequests(state, dispatch);
  useLeaveWarning(hasUnsavedWork(isBusy(state), dirtyFields));
  return { state, dispatch };
};
