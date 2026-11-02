"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CLOSE_LABEL, LOADING_LABEL, OPEN_LABEL } from "@/lib/garment3d/viewer";
import type { FlatPreviewData } from "@/lib/projects/flat-preview";

// The 3D code (three.js and the form builder) is fetched only when a person opens the view, which
// matters most here: a committee member on a phone should not pay for it until they ask.
const GarmentViewer = dynamic(() => import("@/components/garment3d/GarmentViewer"), {
  ssr: false,
  loading: () => <p className="text-sm text-muted">{LOADING_LABEL}</p>,
});

/**
 * The read-only 3D view of one option (spec F-T3 "a read-only 3D view"). It is the same viewer the
 * editor uses, behind the same button, and it has no control that changes anything: a committee
 * looks and turns it, nothing more.
 */
export function Committee3D({ preview, label }: Readonly<{ preview: FlatPreviewData; label: string }>) {
  const [open, setOpen] = useState(false);
  const front = preview.views.find((view) => view.view === "front")?.src;
  const back = preview.views.find((view) => view.view === "back")?.src;
  const pictures = useMemo(() => (front && back ? { front, back } : null), [front, back]);
  if (!pictures) return null;
  return (
    <div className="mt-3">
      <Button
        type="button"
        variant="secondary"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        data-testid="committee-3d-toggle"
      >
        {open ? CLOSE_LABEL : `${OPEN_LABEL}: ${label}`}
      </Button>
      {open ? (
        <div className="mt-3">
          <GarmentViewer shape={preview.shape} pictures={pictures} />
        </div>
      ) : null}
    </div>
  );
}
