"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { View } from "@/lib/flat/model";
import { buildGarmentMesh } from "@/lib/garment3d/mesh";
import type { ShapeSource } from "@/lib/garment3d/shape";
import { FAILED_LABEL, HELP_LABEL, PREVIEW_LABEL, motionFor } from "@/lib/garment3d/viewer";
import { mountGarment, paintFlat, type GarmentScene } from "./scene";

export interface GarmentViewerProps {
  readonly shape: { readonly front: ShapeSource; readonly back: ShapeSource };
  /** The picture address of each flat, which is painted onto its side. */
  readonly pictures: { readonly front: string; readonly back: string };
}

const SIDES: readonly { view: View; label: string }[] = [
  { view: "front", label: "Front" },
  { view: "back", label: "Back" },
];

/**
 * The 3D view. It is loaded only when a person opens it (see Preview3D), and it holds
 * markup and wiring only: the form comes from lib/garment3d and three.js from ./scene.
 */
export default function GarmentViewer({ shape, pictures }: GarmentViewerProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<GarmentScene | null>(null);
  const [failed, setFailed] = useState(false);
  const mesh = useMemo(() => buildGarmentMesh(shape), [shape]);

  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    let cancelled = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    Promise.all([paintFlat(pictures.front, shape.front.bounds), paintFlat(pictures.back, shape.back.bounds)])
      .then(([front, back]) => {
        if (cancelled) return;
        scene.current = mountGarment(target, mesh, { front, back }, motionFor(reduced));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [mesh, pictures, shape]);

  return (
    <div data-testid="garment-3d">
      <p className="mb-2 text-sm font-medium text-ink" data-testid="garment-3d-label">
        {PREVIEW_LABEL}
      </p>
      {failed ? (
        <p className="text-sm text-muted">{FAILED_LABEL}</p>
      ) : (
        <canvas
          ref={canvas}
          className="block h-[26rem] w-full touch-none rounded-xl border border-hairline bg-white"
          role="img"
          aria-label={`${PREVIEW_LABEL} ${HELP_LABEL}`}
        />
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {SIDES.map((side) => (
          <Button key={side.view} type="button" variant="secondary" onClick={() => scene.current?.showSide(side.view)}>
            {side.label}
          </Button>
        ))}
        <span className="text-sm text-muted">{HELP_LABEL}</span>
      </div>
    </div>
  );
}
