"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useReducer, useRef, type Dispatch } from "react";
import type { GarmentSpec } from "@/lib/garment";
import {
  applyDesignActionAction,
  applyDesignActionsAction,
  readVersionAction,
  restoreVersionAction,
  undoDesignAction,
} from "@/lib/projects/actions";
import {
  canStart,
  editorReducer,
  initialEditorState,
  isBusy,
  waitingForPage,
  type Check,
  type EditorEvent,
  type EditorState,
  type InFlight,
} from "@/lib/projects/editor-state";
import { hasUnsavedWork } from "@/lib/projects/field-text";
import { PAGE_TIME_LIMIT_MS, SAVE_TIME_LIMIT_MS, withTimeLimit } from "@/lib/projects/time-limit";
import { focusField } from "./focus-field";

/**
 * Wires the editor's reducer to the server and the page: it sends the change that is on
 * its way, reads the design again after a lost reply or a conflict, waits for the page to
 * show a version it was told about, moves focus when asked, and warns before the page is
 * left with work unsaved. The rules themselves live in the reducer.
 */

const UNREACHABLE = "We could not reach the server. Check your connection and try again.";
const CANNOT_CHECK = "We could not check the design. Reload the page to see the latest version.";

const describe = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const send = (projectId: string, change: InFlight) => {
  const { expectedVersion, request } = change;
  switch (request.kind) {
    case "action":
      return applyDesignActionAction({ projectId, expectedVersion, action: request.action });
    case "actions":
      return applyDesignActionsAction({ projectId, expectedVersion, actions: request.actions });
    case "restore":
      return restoreVersionAction({ projectId, expectedVersion, version: request.version });
    case "undo":
      return undoDesignAction({ projectId, expectedVersion });
    case "colour":
      // The reducer works a colour out before it is sent, so this never happens.
      return Promise.reject(new Error("A colour change was sent before it was worked out."));
  }
};

/** Sends the change that is on its way, once, and reports how it went. A save that takes too long counts as lost. */
const useSending = (projectId: string, inFlight: InFlight | null, dispatch: Dispatch<EditorEvent>): void => {
  const sent = useRef(new Set<number>());
  useEffect(() => {
    const change = inFlight;
    if (!change || sent.current.has(change.id)) return;
    sent.current.add(change.id);
    withTimeLimit(send(projectId, change), SAVE_TIME_LIMIT_MS).then(
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
  }, [projectId, inFlight, dispatch]);
};

/**
 * After a lost reply the server may have saved, and after a conflict the newer versions may
 * be the person's own. Read the design before sending anything else.
 */
const useCheck = (projectId: string, check: Check | null, dispatch: Dispatch<EditorEvent>): void => {
  useEffect(() => {
    if (!check) return;
    withTimeLimit(readVersionAction({ projectId, since: check.since }), SAVE_TIME_LIMIT_MS).then(
      (result) =>
        dispatch(
          result.success
            ? { type: "verified", version: result.data.version, others: result.data.others }
            : { type: "verifyFailed", message: CANNOT_CHECK },
        ),
      () => dispatch({ type: "verifyFailed", message: CANNOT_CHECK }),
    );
  }, [projectId, check, dispatch]);
};

/** A change waits for the page to show a version this screen cannot work out. Ask for it, and give up after a while. */
const useCatchUp = (waiting: boolean, dispatch: Dispatch<EditorEvent>): void => {
  const router = useRouter();
  useEffect(() => {
    if (!waiting) return;
    router.refresh();
    const timer = setTimeout(() => dispatch({ type: "verifyFailed", message: CANNOT_CHECK }), PAGE_TIME_LIMIT_MS);
    return () => clearTimeout(timer);
  }, [waiting, dispatch, router]);
};

const useFocusRequests = (focusKey: string | null, dispatch: Dispatch<EditorEvent>): void => {
  useEffect(() => {
    if (!focusKey) return;
    focusField(focusKey);
    dispatch({ type: "focused" });
  }, [focusKey, dispatch]);
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

/**
 * `version` and `spec` are the design the page holds. Without `spec` (the tech pack page)
 * only ready-made changes can be sent, not colour changes.
 */
export const useEditorEngine = (
  projectId: string,
  version: number,
  dirtyFields: readonly boolean[],
  spec?: GarmentSpec,
): { state: EditorState; dispatch: Dispatch<EditorEvent> } => {
  const [state, dispatch] = useReducer(editorReducer, version, initialEditorState);

  // The page shows a version: a newer one ends a conflict, and saved changes it holds are forgotten.
  useEffect(() => dispatch({ type: "seen", version }), [version]);
  useEffect(() => {
    if (canStart(state)) dispatch({ type: "start", spec });
  }, [state, spec]);

  useSending(projectId, state.inFlight, dispatch);
  useCheck(projectId, state.check, dispatch);
  useCatchUp(waitingForPage(state), dispatch);
  useFocusRequests(state.focusKey, dispatch);
  useLeaveWarning(hasUnsavedWork(isBusy(state), dirtyFields));
  return { state, dispatch };
};
