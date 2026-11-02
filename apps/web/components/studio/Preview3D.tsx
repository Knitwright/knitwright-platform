"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { FlatPreviewData } from "@/lib/projects/flat-preview";
import TurntableControl from "@/components/media/video/TurntableControl";
import { CLOSE_LABEL, LOADING_LABEL, OPEN_LABEL } from "@/lib/garment3d/viewer";

// The 3D code (three.js and the form builder) is fetched only when a person opens the view.
const GarmentViewer = dynamic(() => import("@/components/garment3d/GarmentViewer"), {
  ssr: false,
  loading: () => <p className="text-sm text-muted">{LOADING_LABEL}</p>,
});

/**
 * The video studio of F-L3 (L5, decision 0095): the four free deterministic videos, recorded off
 * this very canvas in the browser. It is fetched with the 3D code rather than with the page,
 * because it is no use without a 3D view to record -- it finds the canvas itself and, when there
 * is none, says so. It asks the view what it can do, so only the videos this view can really
 * record are offered.
 */
const VideoStudio = dynamic(() => import("@/components/video/VideoStudio"), { ssr: false });

/** A trial (step 9A, owner verdict A10 owed): the design as a 3D form, behind a button. */
export function Preview3D({ flat }: Readonly<{ flat: FlatPreviewData }>) {
  const [open, setOpen] = useState(false);
  const front = flat.views.find((view) => view.view === "front")?.src;
  const back = flat.views.find((view) => view.view === "back")?.src;
  const pictures = useMemo(() => (front && back ? { front, back } : null), [front, back]);
  if (!pictures) return null;
  return (
    <div className="mt-4">
      <Button type="button" variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)} data-testid="garment-3d-toggle">
        {open ? CLOSE_LABEL : OPEN_LABEL}
      </Button>
      {open ? (
        <div className="mt-3">
          <GarmentViewer shape={flat.shape} pictures={pictures} />
          <TurntableControl />
          <VideoStudio />
        </div>
      ) : null}
    </div>
  );
}
