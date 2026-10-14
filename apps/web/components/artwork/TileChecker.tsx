"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { convertArtwork } from "@/lib/artwork-intake/client";
import type { ArtworkSummary } from "@/lib/artwork-intake/records";

type SeamReport = Readonly<{ mismatch: number; verdict: string }>;
type Check = Readonly<{ seam: SeamReport; repeat: Readonly<{ periodX: number | null; periodY: number | null }>; previewPng: string }>;
type Preview = Readonly<{ before: SeamReport; after: SeamReport; limit: string; previewPng: string }>;
type Method = "blend" | "mirror";

type Props = Readonly<{ artwork: ArtworkSummary; onMade: (artwork: ArtworkSummary) => void }>;

const picture = (png: string) => `data:image/png;base64,${png}`;

/** For an all-over tile: does the repeat show a seam, and what would making it seamless do. Nothing is saved until the person accepts. */
export function TileChecker({ artwork, onMade }: Props) {
  const [check, setCheck] = useState<Check | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [method, setMethod] = useState<Method>("blend");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async <T,>(body: Readonly<Record<string, unknown>>, done: (data: T) => void) => {
    setBusy(true);
    setProblem(null);
    const result = await convertArtwork<T>(artwork.id, body);
    setBusy(false);
    if (result.ok) done(result.data);
    else setProblem(result.message);
  };

  if (artwork.kind === "vector") return null;
  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="secondary" disabled={busy} onClick={() => void run<{ tile: Check }>({ action: "check-tile" }, (d) => (setCheck(d.tile), setPreview(null)))}>
        Check the repeat
      </Button>
      {check ? (
        <div className="flex flex-col gap-2 text-sm text-ink-2">
          <p>
            {check.seam.verdict} The step across the edge is {check.seam.mismatch} points more than the picture&apos;s own steps.
          </p>
          {check.repeat.periodX || check.repeat.periodY ? (
            <p>The picture seems to repeat every {check.repeat.periodX ?? "?"} by {check.repeat.periodY ?? "?"} pixels.</p>
          ) : null}
          {/* A data address made on the server: next/image cannot optimise it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={picture(check.previewPng)} alt="The picture laid out three by three" className="max-w-full rounded-lg border border-hairline" />
          <fieldset className="flex gap-4">
            <legend className="sr-only">How to make it seamless</legend>
            {(["blend", "mirror"] as const).map((value) => (
              <label key={value} className="flex items-center gap-2">
                <input type="radio" name={`method-${artwork.id}`} checked={method === value} onChange={() => setMethod(value)} />
                {value === "blend" ? "Blend the edges" : "Mirror it 2 x 2"}
              </label>
            ))}
          </fieldset>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void run<{ seamless: Preview }>({ action: "preview-seamless", method }, (d) => setPreview(d.seamless))}>
            Make it seamless: show me first
          </Button>
        </div>
      ) : null}
      {preview ? (
        <div className="flex flex-col gap-2 text-sm text-ink-2">
          <p>
            The step across the edge goes from {preview.before.mismatch} to {preview.after.mismatch}. {preview.after.verdict}
          </p>
          <p>{preview.limit}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={picture(preview.previewPng)} alt="The seamless picture laid out three by three" className="max-w-full rounded-lg border border-hairline" />
          <Button type="button" variant="primary" disabled={busy} onClick={() => void run<{ artwork: ArtworkSummary }>({ action: "save-seamless", method, rights: true }, (d) => onMade(d.artwork))}>
            Save as a new artwork
          </Button>
        </div>
      ) : null}
      <p role={problem ? "alert" : "status"} className="min-h-5 text-sm text-ink-2">
        {busy ? "Working on it." : (problem ?? "")}
      </p>
    </div>
  );
}
