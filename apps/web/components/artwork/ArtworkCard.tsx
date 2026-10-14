"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { artworkDetail, changeArtwork, deleteArtwork, screenLink, tileReport } from "@/lib/artwork-intake/client";
import type { ArtworkRecord } from "@/lib/artwork-intake/records";
import type { ArtworkDetail, ChangeSummary } from "@/lib/artwork-intake/service";
import type { SeamReport } from "@/lib/artwork-intake/tile";
import { describeArtwork, dpiReadout, seamChangeSentence, seamSentence } from "@/lib/artwork-intake/wording";

const call = (input: string, init?: RequestInit) => fetch(input, init);

type CardProps = Readonly<{
  artwork: ArtworkRecord;
  /** Shown when the picture was just uploaded and sits on a white box. */
  onChanged: () => void;
}>;

/** One artwork: its screen picture, what it is, how sharp it prints at a width, and the changes that can be made. */
export function ArtworkCard({ artwork, onChanged }: CardProps) {
  const [picture, setPicture] = useState<string | null>(null);
  const [detail, setDetail] = useState<ArtworkDetail | null>(null);
  const [widthMm, setWidthMm] = useState("");
  const [seam, setSeam] = useState<SeamReport | null>(null);
  const [shown, setShown] = useState<ChangeSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const widthId = useId();

  useEffect(() => {
    let live = true;
    void screenLink(call, artwork.screenFileId).then((link) => live && link.ok && setPicture(link.data));
    void artworkDetail(call, artwork.id).then((answer) => live && answer.ok && setDetail(answer.data));
    return () => {
      live = false;
    };
  }, [artwork.id, artwork.screenFileId]);

  const askWidth = async () => {
    const width = Number(widthMm);
    if (!Number.isFinite(width) || width <= 0) return setMessage("Type the printed width in millimetres.");
    const answer = await artworkDetail(call, artwork.id, width);
    if (answer.ok) setDetail(answer.data);
    else setMessage(answer.reason);
  };

  const checkTile = async () => {
    const answer = await tileReport(call, artwork.id);
    if (answer.ok) setSeam(answer.data);
    else setMessage(answer.reason);
  };

  const show = async (change: Parameters<typeof changeArtwork>[2]) => {
    const answer = await changeArtwork(call, artwork.id, change, false);
    if (answer.ok && !answer.data.accepted) setShown(answer.data.summary);
    else if (!answer.ok) setMessage(answer.reason);
  };

  const accept = async (change: Parameters<typeof changeArtwork>[2]) => {
    const answer = await changeArtwork(call, artwork.id, change, true);
    if (answer.ok) {
      setShown(null);
      onChanged();
    } else setMessage(answer.reason);
  };

  const remove = async () => {
    const answer = await deleteArtwork(call, artwork.id);
    if (answer.ok) onChanged();
    else setMessage(answer.reason);
  };

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-hairline p-4">
      <h3 className="text-base font-medium text-ink">{artwork.label}</h3>
      {picture ? (
        // eslint-disable-next-line @next/next/no-img-element -- A short-lived storage link, drawn as it is.
        <img src={picture} alt={`Screen copy of ${artwork.label}`} className="max-h-56 w-auto self-start rounded-lg border border-hairline bg-[repeating-conic-gradient(#8881_0_25%,transparent_0_50%)] bg-[length:16px_16px]" />
      ) : null}
      <p className="text-sm text-ink-2">{describeArtwork(artwork)}</p>
      {artwork.warnings.map((warning) => (
        <p key={warning} className="text-sm text-muted">
          {warning}
        </p>
      ))}

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={widthId} className="text-sm font-medium text-ink">
            Printed width (mm)
          </label>
          <input id={widthId} inputMode="decimal" value={widthMm} onChange={(event) => setWidthMm(event.target.value)} className="h-11 w-32 rounded-lg border border-hairline bg-surface px-3 text-[15px] text-ink" />
        </div>
        <Button variant="secondary" type="button" onClick={() => void askWidth()}>
          Check sharpness
        </Button>
      </div>
      {detail?.dpiWarning ? <Notice tone="warn">{detail.dpiWarning}</Notice> : null}
      {detail && !detail.dpiWarning && Number(widthMm) > 0 ? <p className="text-sm text-ink-2">{dpiReadout(detail.effectiveDpi, Number(widthMm))}</p> : null}

      {artwork.kind === "raster" ? (
        <div className="flex flex-wrap gap-2">
          {detail?.canRemoveWhiteBackground ? (
            <Button variant="secondary" type="button" onClick={() => void show({ action: "remove-white-background" })}>
              Remove the white background
            </Button>
          ) : null}
          <Button variant="secondary" type="button" onClick={() => void checkTile()}>
            Check as a repeating tile
          </Button>
        </div>
      ) : null}
      {seam ? <Notice tone={seam.seamless ? "ok" : "warn"}>{seamSentence(seam)}</Notice> : null}
      {seam && !seam.seamless ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" type="button" onClick={() => void show({ action: "make-seamless", method: "blend" })}>
            Make it seamless (blend)
          </Button>
          <Button variant="secondary" type="button" onClick={() => void show({ action: "make-seamless", method: "mirror" })}>
            Make it seamless (mirror)
          </Button>
        </div>
      ) : null}

      {shown ? (
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- A picture made on the server, drawn as it is. */}
          <img src={shown.previewPng} alt="Preview of the change" className="max-h-72 w-auto self-start rounded-lg border border-hairline" />
          {shown.before && shown.after ? <p className="text-sm text-ink-2">{seamChangeSentence(shown.before, shown.after)}</p> : null}
          {shown.limit ? <p className="text-sm text-muted">{shown.limit}</p> : null}
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() =>
                void accept(
                  shown.action === "remove-white-background"
                    ? { action: "remove-white-background" }
                    : { action: "make-seamless", method: shown.after && shown.after.mismatch === 0 ? "mirror" : "blend" },
                )
              }
            >
              Keep this as new artwork
            </Button>
            <Button variant="quiet" type="button" onClick={() => setShown(null)}>
              Not now
            </Button>
          </div>
        </div>
      ) : null}

      {message ? <Notice tone="warn" role="alert">{message}</Notice> : null}
      <div>
        <Button variant="quiet" type="button" onClick={() => void remove()}>
          Delete this artwork
        </Button>
      </div>
    </article>
  );
}
