"use client";

import { useCallback, useEffect, useState } from "react";
import { Notice } from "@/components/ui/Notice";
import { listArtwork, type UploadedArtwork } from "@/lib/artwork-intake/client";
import type { ArtworkRecord } from "@/lib/artwork-intake/records";
import { ArtworkCard } from "./ArtworkCard";
import { ArtworkUpload } from "./ArtworkUpload";

const call = (input: string, init?: RequestInit) => fetch(input, init);

/**
 * The club's own artwork: add a file, see what it is, check how sharp it prints, and tidy it up.
 *
 * It is the Logos panel's second section in the design workspace (`lib/workspace/tools.ts`,
 * section `own-artwork`), which is the upload Brand Studio's own empty state points at: "Upload
 * your crest in a design's artwork first, then choose it here" (decision 0036 and 0079).
 *
 * The heading is an `h3`: the tool panel's own title is the `h2` above it.
 */
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
      <h3 id="artwork-heading" className="text-base font-medium text-ink">
        Your artwork
      </h3>
      <p className="text-[15px] leading-relaxed text-muted">
        Your own crests, sponsor logos, badges and photographs. For each one you can see what the file is, how sharply it
        would print at the size you want, and whether a repeat of it would show a seam. A picture you add belongs to the
        brand, so any design can use it, and Brand Studio takes your crest, sponsors and label artwork from this list.
      </p>
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
