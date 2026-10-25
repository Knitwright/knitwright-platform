"use client";

import { useCallback, useEffect, useReducer, useState, type RefObject } from "react";
import { MAX_TURNTABLE_BYTES, TURNTABLE_SECONDS } from "@/lib/media/video/limits";
import { TURN_EVENT } from "@/lib/media/video/copy";
import { recordCanvas } from "../video/record";
import { readCredits, readLatest, readSet, startClip, startSet, unlockSet, type CreditsNote } from "./api";
import { canShareFiles, shareFile } from "./share";
import { INITIAL, POLL_INTERVAL_MS, canMake, canUnlock, reduce, shouldPoll } from "./state";
import { SHARE_FAILED_MESSAGE } from "./copy";
import { clipPlan, progressOf, tilesOf, type Tile } from "./model";
import { recordTurntable } from "./turntable";

const MIME_TYPES = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"] as const;
const BITS_PER_SECOND = 2_500_000;
const CANVAS_SELECTOR = '[data-testid="garment-3d"] canvas, [data-testid="gltf-3d"] canvas';

/**
 * True once the element has been on screen. Every panel of the workspace is drawn at once and kept, so the media
 * screen waits until its tool is opened before it asks the server anything.
 */
function useShownOnce(ref: RefObject<HTMLElement | null>): boolean {
  // A browser with no IntersectionObserver cannot tell, so it loads at once.
  const [shown, setShown] = useState(() => typeof window !== "undefined" && typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const element = ref.current;
    if (!element || shown) return;
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && setShown(true));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, shown]);
  return shown;
}

/** The media screen's state and actions. The calls are in api.ts, the rules in state.ts and model.ts; this wires them to React. */
export function useMediaScreen(projectId: string, root: RefObject<HTMLElement | null>) {
  const [state, dispatch] = useReducer(reduce, INITIAL);
  const [credits, setCredits] = useState<CreditsNote | null>(null);
  const shown = useShownOnce(root);
  const setId = state.set?.id ?? null;

  useEffect(() => {
    if (!shown) return;
    let live = true;
    void readLatest(projectId).then((result) => live && dispatch(result.ok ? { type: "loaded", set: result.set } : { type: "problem", message: result.message }));
    void readCredits().then((note) => live && setCredits(note));
    return () => {
      live = false;
    };
  }, [projectId, shown]);

  const polling = shouldPoll(state);
  useEffect(() => {
    if (!polling || !setId) return;
    const timer = setTimeout(async () => {
      const result = await readSet(projectId, setId);
      dispatch(result.ok ? { type: "polled", set: result.set } : { type: "pollFailed" });
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [polling, projectId, setId, state.polls]);

  const make = useCallback(async () => {
    dispatch({ type: "make" });
    const result = await startSet(projectId);
    dispatch(result.ok ? { type: "made", created: result.created, set: result.set } : { type: "problem", message: result.message });
  }, [projectId]);

  const unlock = useCallback(async () => {
    if (!setId) return;
    dispatch({ type: "unlock" });
    const result = await unlockSet(projectId, setId);
    dispatch(result.ok ? { type: "unlocked", set: result.set } : { type: "problem", message: result.message });
    void readCredits().then(setCredits);
  }, [projectId, setId]);

  const view = clipPlan(state.set).view;
  const clip = useCallback(async () => {
    if (!setId || !view) return;
    dispatch({ type: "clip" });
    const result = await startClip(projectId, setId, view);
    dispatch(result.ok ? { type: "clipStarted", state: result.state } : { type: "problem", message: result.message });
    void readCredits().then(setCredits);
  }, [projectId, setId, view]);

  const turntable = useCallback(async () => {
    if (!setId) return;
    dispatch({ type: "turntable" });
    const outcome = await recordTurntable({
      findCanvas: () => document.querySelector<HTMLCanvasElement>(CANVAS_SELECTOR),
      canRecord: () => typeof MediaRecorder !== "undefined",
      record: (canvas) => recordCanvas(canvas, { seconds: TURNTABLE_SECONDS, revolutionSeconds: TURNTABLE_SECONDS, maxBytes: MAX_TURNTABLE_BYTES, mimeTypes: MIME_TYPES, bitsPerSecond: BITS_PER_SECOND, turnEvent: TURN_EVENT }),
      upload: async (video, poster) => {
        const form = new FormData();
        form.append("video", video, "turntable");
        form.append("poster", poster, "poster.png");
        return (await fetch(`/api/projects/${projectId}/media/${setId}/turntable`, { method: "POST", body: form })).ok;
      },
      reload: async () => {
        const result = await readSet(projectId, setId);
        return result.ok ? result.set : null;
      },
    });
    dispatch({ type: "turntableDone", ...outcome });
  }, [projectId, setId]);

  const share = useCallback(async (tile: Tile) => {
    if (!tile.download?.filename) return;
    const result = await shareFile(tile.download.href, tile.download.filename);
    if (!result.ok) dispatch({ type: "problem", message: SHARE_FAILED_MESSAGE });
  }, []);

  return {
    state,
    credits,
    tiles: tilesOf(state.set),
    progress: progressOf(state.set),
    clip: clipPlan(state.set),
    canShare: typeof navigator !== "undefined" && canShareFiles(navigator),
    allowMake: canMake(state),
    allowUnlock: canUnlock(state),
    make,
    unlock,
    startClip: clip,
    turntable,
    share,
  };
}
