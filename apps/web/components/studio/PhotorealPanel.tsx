"use client";

import { useRouter } from "next/navigation";
import { useEffect, useReducer } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { IllustrationFigures } from "@/components/techpack/Illustrations";
import { pollImageJob, requestImages } from "@/lib/images/client";
import type { LoadedIllustrations } from "@/lib/images/illustrations";
import { POLL_INTERVAL_MS, canStart, initialPanel, nextPanel } from "@/lib/images/panel-state";

type PanelProps = Readonly<{
  projectId: string;
  /** False when no image model is set up. */
  available: boolean;
  colourwayId?: string;
  currentVersion: number;
  loaded: LoadedIllustrations | null;
}>;

/**
 * Photoreal images of the design, made only when the person asks. Plan step 14. The
 * pictures come from the server with the page; when a job finishes the page is read again.
 */
export function PhotorealPanel({ projectId, available, colourwayId, currentVersion, loaded }: PanelProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(nextPanel, initialPanel([]));

  useEffect(() => {
    if (state.phase !== "working" || !state.jobId) return;
    const jobId = state.jobId;
    const timer = setTimeout(async () => {
      const job = await pollImageJob(projectId, jobId);
      dispatch(job ? { type: "polled", job } : { type: "poll-failed" });
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [projectId, state.phase, state.jobId, state.polls]);

  useEffect(() => {
    if (state.phase === "done") router.refresh();
  }, [state.phase, router]);

  const start = async () => {
    dispatch({ type: "start" });
    const result = await requestImages(projectId, colourwayId);
    dispatch(result.ok ? { type: "started", jobId: result.jobId } : { type: "start-failed", message: result.reason });
  };

  const busy = !canStart(state);

  return (
    <section aria-labelledby="photoreal-heading" className="grid gap-4 rounded-xl border border-hairline bg-surface p-6">
      <div className="grid gap-1">
        <h2 id="photoreal-heading" className="text-lg font-semibold text-ink">
          Photoreal images
        </h2>
        <p className="text-sm text-muted">
          A front and a back, made by AI from the flats. Each request uses your daily image allowance.
        </p>
      </div>

      {available ? (
        <div>
          <Button type="button" variant="secondary" pending={busy} onClick={() => void start()}>
            {busy ? "Making images…" : loaded ? "Make new images" : "Make images"}
          </Button>
        </div>
      ) : (
        <Notice>Photoreal images are not set up yet.</Notice>
      )}

      {state.phase === "working" ? <p role="status" className="text-sm text-muted">This takes up to a minute.</p> : null}
      {state.phase === "failed" && state.message ? (
        <Notice tone="warn" role="alert">
          {state.message}
        </Notice>
      ) : null}

      {loaded ? <IllustrationFigures loaded={loaded} currentVersion={currentVersion} /> : null}
    </section>
  );
}
