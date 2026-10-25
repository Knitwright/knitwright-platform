"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  NO_PROJECT_MESSAGE,
  NO_VIEW_MESSAGE,
  PREPARING_LABEL,
  RECORDING_LABEL,
  RECORD_FAILED_MESSAGE,
  RECORD_LABEL,
  SAVED_LABEL,
  SAVE_FAILED_MESSAGE,
  SAVING_LABEL,
  SET_TIMEOUT_MESSAGE,
  TOO_BIG_MESSAGE,
  TURN_EVENT,
  UNSUPPORTED_MESSAGE,
} from "@/lib/media/video/copy";
import { MAX_TURNTABLE_BYTES, TURNTABLE_SECONDS } from "@/lib/media/video/limits";
import { recordCanvas } from "./record";

const MIME_TYPES = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"] as const;
const BITS_PER_SECOND = 2_500_000;
const SET_POLL_MS = 1500;
const SET_POLL_LIMIT = 40;

type Phase = "idle" | "preparing" | "recording" | "saving";
type SetState = { id: string; status: string } | null;

const projectIdFromPath = (): string | null => /\/studio\/([0-9a-f-]{36})/.exec(window.location.pathname)?.[1] ?? null;
const find3dCanvas = (): HTMLCanvasElement | null => document.querySelector<HTMLCanvasElement>('[data-testid="garment-3d"] canvas, [data-testid="gltf-3d"] canvas');
const readSet = async (url: string): Promise<SetState> => ((await (await fetch(url)).json()) as { data?: { set: SetState } }).data?.set ?? null;

/** Makes sure the design has a finished media set (studio renders are free) and returns its id, or null when it takes too long. */
async function finishedSetId(projectId: string): Promise<string | null> {
  const url = `/api/projects/${projectId}/media`;
  let set = await readSet(url);
  if (!set || set.status === "failed") {
    const started = (await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).json()) as { data?: { set: SetState } };
    set = started.data?.set ?? null;
  }
  for (let i = 0; i < SET_POLL_LIMIT && set && set.status !== "succeeded"; i++) {
    if (set.status === "failed") return null;
    await new Promise((resolve) => setTimeout(resolve, SET_POLL_MS));
    set = await readSet(url);
  }
  return set?.status === "succeeded" ? set.id : null;
}

/**
 * "Record turntable" for the 3D view: the model turns once while the canvas is recorded to a video in this browser, and the
 * recording goes into the design's media set. Free, because nothing paid is called. A browser that cannot record says so and
 * saves nothing. Holds markup and wiring only; the checks are on the server (lib/media/video).
 */
export default function TurntableControl({ projectId }: Readonly<{ projectId?: string }>) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setMessage(null);
    const id = projectId ?? projectIdFromPath();
    const canvas = find3dCanvas();
    if (!id) return setMessage(NO_PROJECT_MESSAGE);
    if (!canvas) return setMessage(NO_VIEW_MESSAGE);
    if (typeof MediaRecorder === "undefined") return setMessage(UNSUPPORTED_MESSAGE);
    try {
      setPhase("preparing");
      const setId = await finishedSetId(id);
      if (!setId) return setMessage(SET_TIMEOUT_MESSAGE);
      setPhase("recording");
      const result = await recordCanvas(canvas, { seconds: TURNTABLE_SECONDS, revolutionSeconds: TURNTABLE_SECONDS, maxBytes: MAX_TURNTABLE_BYTES, mimeTypes: MIME_TYPES, bitsPerSecond: BITS_PER_SECOND, turnEvent: TURN_EVENT });
      if (!result.ok) return setMessage(result.reason === "unsupported" ? UNSUPPORTED_MESSAGE : result.reason === "too_large" ? TOO_BIG_MESSAGE : RECORD_FAILED_MESSAGE);
      setPhase("saving");
      const form = new FormData();
      form.append("video", result.recording.video, "turntable");
      form.append("poster", result.recording.poster, "poster.png");
      const response = await fetch(`/api/projects/${id}/media/${setId}/turntable`, { method: "POST", body: form });
      setMessage(response.ok ? SAVED_LABEL : SAVE_FAILED_MESSAGE);
    } catch {
      setMessage(RECORD_FAILED_MESSAGE);
    } finally {
      setPhase("idle");
    }
  }

  const label = { idle: RECORD_LABEL, preparing: PREPARING_LABEL, recording: RECORDING_LABEL, saving: SAVING_LABEL }[phase];
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="turntable-control">
      <Button type="button" variant="secondary" disabled={phase !== "idle"} onClick={run} data-testid="turntable-record">
        {label}
      </Button>
      {message ? (
        <p role="status" className="text-sm text-muted" data-testid="turntable-message">
          {message}
        </p>
      ) : null}
    </div>
  );
}
