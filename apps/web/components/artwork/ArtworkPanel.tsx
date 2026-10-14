"use client";

import { useCallback, useEffect, useState } from "react";
import { Notice } from "@/components/ui/Notice";
import { listArtwork, type UploadedArtwork } from "@/lib/artwork-intake/client";
import type { ArtworkRecord } from "@/lib/artwork-intake/records";
import { ArtworkCard } from "./ArtworkCard";
import { ArtworkUpload } from "./ArtworkUpload";

const call = (input: string, init?: RequestInit) => fetch(input, init);

/** The club's own artwork: add a file, see what it is, check how sharp it prints, and tidy it up. */
export function ArtworkPanel() {
  const [artworks, setArtworks] = useState<readonly ArtworkRecord[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  // Bumped to read the list again after a change.
  const [round, setRound] = useState(0);
  const refresh = useCallback(() => setRound((value) => value + 1), []);

  useEffect(() => {
    let live = true;
    void listArtwork(call).then((answer) => {
      if (!live) return;
      if (answer.ok) setArtworks(answer.data.artworks);
      else setProblem(answer.reason);
    });
    return () => {
      live = false;
    };
  }, [round]);

  const added = (artwork: UploadedArtwork) => setArtworks((current) => [artwork, ...current]);

  return (
    <section aria-labelledby="artwork-heading" className="flex flex-col gap-6">
      <h2 id="artwork-heading" className="text-xl font-medium text-ink">
        Your artwork
      </h2>
      <ArtworkUpload onUploaded={added} />
      {problem ? <Notice tone="warn" role="alert">{problem}</Notice> : null}
      <div className="grid gap-4 @xl:grid-cols-2">
        {artworks.map((artwork) => (
          <ArtworkCard key={artwork.id} artwork={artwork} onChanged={refresh} />
        ))}
      </div>
    </section>
  );
}
