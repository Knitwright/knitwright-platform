"use client";

import { useCallback, useEffect, useState } from "react";
import { Notice } from "@/components/ui/Notice";
import { listArtwork, type UploadedArtwork } from "@/lib/artwork-intake/client";
import type { ArtworkRecord } from "@/lib/artwork-intake/records";
import { ArtworkCard } from "./ArtworkCard";
import { ArtworkUpload } from "./ArtworkUpload";

const call = (input: string, init?: RequestInit) => fetch(input, init);

/**
 * The brand's own artwork: add a file, see what it is, see how sharply it prints, and tidy it up.
 *
 * ITS SCREEN IS BRAND STUDIO (decision 0124). The panel is brand-scoped -- `/api/artwork` answers
 * for the brand, not for one design -- and Brand Studio's Logos, Graphics and Sportswear tabs all
 * *choose* from these very rows (`listUploads` reads `user_artworks`), so the page that needs it is
 * the page it sits on. It was tried in the design workspace's Logos tool first and taken out again:
 * that tool already has the older per-design logo upload, and two uploads with two rights
 * consents in one panel is a worse screen than no door at all was (the browser tests found it).
 *
 * It draws no heading of its own: the section it sits in names it, so it can sit in any of them.
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
    <div className="flex flex-col gap-6">
      <ArtworkUpload onUploaded={added} />
      {problem ? <Notice tone="warn" role="alert">{problem}</Notice> : null}
      {/* A plain breakpoint, not a container query: the section it sits in is not a `@container`. */}
      <div className="grid gap-4 sm:grid-cols-2">
        {artworks.map((artwork) => (
          <ArtworkCard key={artwork.id} artwork={artwork} onChanged={refresh} />
        ))}
      </div>
    </div>
  );
}
