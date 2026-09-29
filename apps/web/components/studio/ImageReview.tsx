"use client";

import { useRouter } from "next/navigation";
import { useEffect, useReducer, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { applyProposalAction } from "@/lib/projects/actions";
import { uploadImageFile } from "@/lib/projects/artwork-upload";
import { canApply, imageReviewReducer, initialReview, parseImageAnswer, type ReviewState } from "@/lib/projects/image-review";

const UNREACHABLE = "We could not reach the server. Check your connection and try again.";
const STAGE_TEXT: Partial<Record<ReviewState["stage"], string>> = {
  uploading: "Uploading the picture...",
  reading: "Reading the picture...",
  applying: "Applying the design...",
};

type Props = Readonly<{ projectId: string; version: number; available: boolean; busy: boolean }>;

const postFile = (form: FormData): Promise<Response> => fetch("/api/files", { method: "POST", body: form });

/**
 * Start from a sketch or photo. The picture is uploaded, read, and shown beside the design
 * it was read as. Nothing is applied until the person ticks every confirmation and presses
 * apply. Rules and sentences live in lib/projects/image-review and lib/intent/image-input.
 */
export function ImageReview({ projectId, version, available, busy }: Props) {
  const router = useRouter();
  const [state, dispatch] = useReducer(imageReviewReducer, initialReview);
  const [kind, setKind] = useState<"sketch" | "photo">("sketch");

  useEffect(() => {
    const url = state.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [state.previewUrl]);

  const read = async (file: File | undefined) => {
    if (!file) return;
    dispatch({ type: "chosen", previewUrl: URL.createObjectURL(file) });
    const uploaded = await uploadImageFile(file, kind, postFile);
    if (!uploaded.ok) return dispatch({ type: "failed", message: uploaded.reason });
    dispatch({ type: "uploaded" });
    try {
      const response = await fetch(`/api/projects/${projectId}/read-image`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileId: uploaded.fileId, expectedVersion: version }),
      });
      dispatch({ type: "read", answer: parseImageAnswer(await response.json().catch(() => null)) });
    } catch {
      dispatch({ type: "failed", message: UNREACHABLE });
    }
  };

  const apply = async () => {
    if (!canApply(state) || !state.proposal || busy) return;
    dispatch({ type: "applying" });
    try {
      const result = await applyProposalAction({ projectId, expectedVersion: version, token: state.proposal.token });
      if (!result.success) return dispatch({ type: "failed", message: result.error.message });
      dispatch({ type: "applied" });
      router.refresh();
    } catch {
      dispatch({ type: "failed", message: UNREACHABLE });
    }
  };

  const working = state.stage === "uploading" || state.stage === "reading" || state.stage === "applying";

  return (
    <div className="flex flex-col gap-4" data-testid="image-review">
      {available ? null : <Notice>Reading pictures is not switched on yet. Describe the garment in the chat instead.</Notice>}
      <p className="text-[15px] leading-relaxed text-muted">
        Upload a sketch or a photo of a garment. It is read as a suggestion: you see it beside your picture and confirm the
        garment type and how it is made before anything changes. Writing in the picture is read as part of the garment,
        and numbers in it are never used.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          The picture is a
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value === "photo" ? "photo" : "sketch")}
            className="h-11 rounded-lg border border-hairline bg-surface px-3"
          >
            <option value="sketch">Sketch</option>
            <option value="photo">Photo</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Choose a picture
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={!available || working || busy}
            onChange={(event) => void read(event.target.files?.[0])}
            className="text-sm"
          />
        </label>
      </div>
      {STAGE_TEXT[state.stage] ? (
        <p role="status" className="text-sm text-muted">
          {STAGE_TEXT[state.stage]}
        </p>
      ) : null}
      {state.stage === "failed" && state.message ? (
        <Notice tone="warn" role="alert">
          {state.message}
        </Notice>
      ) : null}
      {state.stage === "done" ? <Notice tone="ok">The design was applied and saved as a new version.</Notice> : null}
      {state.proposal && (state.stage === "review" || state.stage === "applying") ? (
        <Review state={state} busy={busy} onTick={(id, on) => dispatch({ type: "tick", id, on })} onApply={() => void apply()} onDiscard={() => dispatch({ type: "discard" })} />
      ) : null}
    </div>
  );
}

type ReviewProps = Readonly<{
  state: ReviewState;
  busy: boolean;
  onTick: (id: string, on: boolean) => void;
  onApply: () => void;
  onDiscard: () => void;
}>;

function Review({ state, busy, onTick, onApply, onDiscard }: ReviewProps) {
  const proposal = state.proposal;
  if (!proposal) return null;
  const front = proposal.flat?.views[0];
  return (
    <div className="flex flex-col gap-4" data-testid="image-proposal">
      <div className="grid grid-cols-2 gap-4">
        <figure className="m-0 rounded-xl border border-hairline bg-white p-2">
          {/* A local picture the person chose; next/image cannot take a blob address. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {state.previewUrl ? <img src={state.previewUrl} alt="Your picture" className="mx-auto h-auto max-h-[18rem] w-full object-contain" /> : null}
          <figcaption className="mt-1 text-center text-sm text-muted">Your picture</figcaption>
        </figure>
        <figure className="m-0 rounded-xl border border-hairline bg-white p-2">
          {front ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={front.src} alt={front.alt} className="mx-auto h-auto max-h-[18rem] w-full object-contain" />
          ) : (
            <p className="p-4 text-sm text-muted">There is no drawing for this garment type.</p>
          )}
          <figcaption className="mt-1 text-center text-sm text-muted">The design as it was read (not saved)</figcaption>
        </figure>
      </div>
      <ul className="list-disc pl-5 text-[15px] text-ink">
        {[...proposal.explanations, ...proposal.notes].map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">Confirm each of these before it is applied</legend>
        {proposal.confirmations.map((entry) => (
          <label key={entry.id} className="flex items-center gap-2 text-[15px] text-ink">
            <input type="checkbox" checked={state.ticked.includes(entry.id)} onChange={(event) => onTick(entry.id, event.target.checked)} />
            {entry.label}
          </label>
        ))}
      </fieldset>
      <div className="flex gap-3">
        <Button type="button" onClick={onApply} disabled={!canApply(state) || busy} pending={state.stage === "applying"}>
          Apply this design
        </Button>
        <Button type="button" variant="secondary" onClick={onDiscard}>
          Discard
        </Button>
      </div>
    </div>
  );
}
