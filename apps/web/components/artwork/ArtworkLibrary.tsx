"use client";

import { useEffect, useState } from "react";
import { listArtwork } from "@/lib/artwork-intake/client";
import type { ArtworkSummary } from "@/lib/artwork-intake/records";
import { ArtworkItem } from "./ArtworkItem";
import { ArtworkUpload } from "./ArtworkUpload";

type State = Readonly<{ kind: "loading" } | { kind: "ready"; artworks: readonly ArtworkSummary[] } | { kind: "failed" }>;

/** The brand's own artwork: add some, see how each would print, and fix a white box or a seam. */
export function ArtworkLibrary() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    void listArtwork().then((result) => live && setState(result.ok ? { kind: "ready", artworks: result.data.artworks } : { kind: "failed" }));
    return () => {
      live = false;
    };
  }, []);

  const add = (artwork: ArtworkSummary) => setState((now) => (now.kind === "ready" ? { kind: "ready", artworks: [artwork, ...now.artworks] } : now));
  const drop = (id: string) => setState((now) => (now.kind === "ready" ? { kind: "ready", artworks: now.artworks.filter((a) => a.id !== id) } : now));

  return (
    <section aria-labelledby="artwork-heading" data-testid="artwork-library" className="flex flex-col gap-4">
      <h2 id="artwork-heading" className="text-[17px] font-medium text-ink">
        Your own artwork
      </h2>
      <ArtworkUpload onUploaded={add} />
      {state.kind === "loading" ? <p className="text-sm text-muted">Loading your artwork.</p> : null}
      {state.kind === "failed" ? <p className="text-sm text-muted">Your artwork could not be loaded. Try again in a moment.</p> : null}
      {state.kind === "ready" && state.artworks.length === 0 ? <p className="text-sm text-muted">You have not added any artwork yet.</p> : null}
      {state.kind === "ready" && state.artworks.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {state.artworks.map((artwork) => (
            <ArtworkItem key={artwork.id} artwork={artwork} onAdded={add} onRemoved={drop} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
