"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { convertArtwork, factsFor, removeArtworkRequest, screenLink } from "@/lib/artwork-intake/client";
import type { ArtworkSummary } from "@/lib/artwork-intake/records";
import { ResolutionReadout } from "./ResolutionReadout";
import { TileChecker } from "./TileChecker";

type Props = Readonly<{ artwork: ArtworkSummary; onAdded: (artwork: ArtworkSummary) => void; onRemoved: (id: string) => void }>;

/** One uploaded artwork: its small copy, what we found in the file, what was changed, and what can be done next. */
export function ArtworkItem({ artwork, onAdded, onRemoved }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void screenLink(artwork.id).then((result) => live && result.ok && setSrc(result.data.url));
    return () => {
      live = false;
    };
  }, [artwork.id]);

  const removeWhite = async () => {
    setProblem(null);
    const result = await convertArtwork<{ artwork: ArtworkSummary }>(artwork.id, { action: "remove-white", rights: true });
    if (result.ok) onAdded(result.data.artwork);
    else setProblem(result.message);
  };

  const remove = async () => {
    const result = await removeArtworkRequest(artwork.id);
    if (result.ok) onRemoved(artwork.id);
    else setProblem(result.message);
  };

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-hairline p-4" data-testid="artwork-item">
      <h3 className="text-[15px] font-medium text-ink">{artwork.name}</h3>
      {src ? (
        // A short-lived link to the small copy: next/image cannot optimise it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Preview of ${artwork.name}`} className="max-h-48 max-w-full self-start rounded-lg border border-hairline bg-white" />
      ) : null}
      <ul className="flex flex-col gap-1 text-sm text-ink-2">
        {[...factsFor(artwork), ...artwork.warnings].map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <ResolutionReadout artworkId={artwork.id} kind={artwork.kind} />
      {artwork.whiteBackground ? (
        <div>
          <Button type="button" variant="secondary" onClick={() => void removeWhite()}>
            Remove the white background
          </Button>
        </div>
      ) : null}
      <TileChecker artwork={artwork} onMade={onAdded} />
      <div>
        <Button type="button" variant="quiet" onClick={() => void remove()}>
          Remove this artwork
        </Button>
      </div>
      <p role="alert" className="min-h-5 text-sm text-ink-2">
        {problem ?? ""}
      </p>
    </li>
  );
}
