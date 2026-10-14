"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { ReadingPayload } from "@/lib/design-import/payload";
import { sideBySideOf } from "@/lib/design-import/side-by-side";
import { SideBySideView, type HandleMove } from "./SideBySideView";

type Props = Readonly<{
  projectId: string;
  /** A picture already uploaded through /api/files. */
  fileId: string;
  /** Called with the accepted stack and layer ids, for the editor to write into a version. */
  onAccepted?: (accepted: { stack: unknown; layerIds: readonly string[] }) => void;
}>;

type State =
  | Readonly<{ step: "start" }>
  | Readonly<{ step: "working" }>
  | Readonly<{ step: "review"; reading: ReadingPayload; busy: boolean }>
  | Readonly<{ step: "done"; message: string }>
  | Readonly<{ step: "problem"; message: string }>;

const PROBLEM = "That did not work just now. Nothing was changed. Try again in a moment.";

async function call(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> | null; message: string | null }> {
  try {
    const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = (await response.json()) as { success?: boolean; data?: Record<string, unknown>; error?: { message?: string } };
    return { ok: response.ok && json.success === true, data: json.data ?? null, message: json.error?.message ?? null };
  } catch {
    return { ok: false, data: null, message: null };
  }
}

/** Make a design from a picture: read it, look at the reading beside the picture, then accept, adjust or discard. */
export function DesignFromPicture({ projectId, fileId, onAccepted }: Props) {
  const [state, setState] = useState<State>({ step: "start" });

  const start = async (): Promise<void> => {
    setState({ step: "working" });
    const result = await call("/api/design-import", "POST", { projectId, fileId });
    const reading = result.data?.reading as ReadingPayload | undefined;
    if (result.ok && result.data?.kind === "ready" && reading) setState({ step: "review", reading, busy: false });
    else setState({ step: "problem", message: (result.data?.reason as string | undefined) ?? result.message ?? PROBLEM });
  };

  const send = async (reading: ReadingPayload, url: string, method: string, body?: unknown) => {
    setState({ step: "review", reading, busy: true });
    return call(url, method, body);
  };

  const move = async (reading: ReadingPayload, change: HandleMove): Promise<void> => {
    const result = await send(reading, `/api/design-import/${reading.id}/refit`, "POST", {
      view: change.view,
      edits: [{ id: change.id, side: change.side, x: change.x, y: change.y }],
    });
    const next = result.data?.reading as ReadingPayload | undefined;
    setState(result.ok && next ? { step: "review", reading: next, busy: false } : { step: "review", reading, busy: false });
  };

  const accept = async (reading: ReadingPayload, layerIds: readonly string[]): Promise<void> => {
    const result = await send(reading, `/api/design-import/${reading.id}/accept`, "POST", { layerIds });
    if (result.ok && result.data?.kind === "accepted") {
      onAccepted?.({ stack: result.data.stack, layerIds });
      setState({ step: "done", message: "Accepted. The layers you ticked are ready to add to your design." });
    } else setState({ step: "problem", message: (result.data?.reason as string | undefined) ?? result.message ?? PROBLEM });
  };

  const discard = async (reading: ReadingPayload): Promise<void> => {
    const result = await send(reading, `/api/design-import/${reading.id}`, "DELETE");
    setState(result.ok ? { step: "done", message: "Discarded. Your design was not changed." } : { step: "problem", message: result.message ?? PROBLEM });
  };

  if (state.step === "start" || state.step === "working") {
    return (
      <section aria-labelledby="from-picture-heading" className="flex flex-col gap-2" data-testid="design-from-picture">
        <h3 id="from-picture-heading" className="text-[15px] font-medium text-ink">Make a design from a picture</h3>
        <p className="text-[13px] text-chalk-muted">
          We read your picture into a design you can edit. It is a close reading, not a copy. Your picture is sent to an AI service to be read.
        </p>
        <div>
          <Button variant="primary" pending={state.step === "working"} onClick={start}>
            Read my picture
          </Button>
        </div>
      </section>
    );
  }
  if (state.step === "problem") return <Notice tone="warn" role="alert">{state.message}</Notice>;
  if (state.step === "done") return <Notice tone="ok">{state.message}</Notice>;
  const model = sideBySideOf(state.reading);
  if (model === null) return <Notice tone="warn" role="alert">This reading has nothing to show. Nothing was changed.</Notice>;
  const reading = state.reading;
  return (
    <SideBySideView
      model={model}
      pictureUrl={`/api/files/${reading.sourceFileId}`}
      busy={state.busy}
      onMove={(change) => void move(reading, change)}
      onAccept={(ids) => void accept(reading, ids)}
      onDiscard={() => void discard(reading)}
    />
  );
}
