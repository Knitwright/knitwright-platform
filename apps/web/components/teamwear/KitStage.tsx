"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { paintFlat } from "@/components/garment3d/scene";
import { buildGarmentMesh } from "@/lib/garment3d/mesh";
import { motionFor } from "@/lib/garment3d/viewer";
import type { FlatPreviewData } from "@/lib/projects/flat-preview";
import { backdropFor, STAGE_FAILED, STAGE_NOTE, turntableSecondsFor, type StageViewId } from "@/lib/teamwear";
import { mountKit, type KitStageScene } from "./stage-scene";

/**
 * The full-bleed 3D stage of spec F-T1, with its sport backdrop. The 3D itself is this component's
 * own scene (`stage-scene.ts`), loaded with the rest of the configurator; the kit's drawing comes
 * from `lib/teamwear/preview.ts`, which is the same drawing code the editor and the tech pack use.
 *
 * `onReady` is given the milliseconds from the moment the page was asked for to the first drawn
 * frame. The browser test reads it off the stage and holds it to the spec's three seconds.
 */

export type KitStageProps = Readonly<{
  flat: FlatPreviewData;
  sportId: string;
  view: StageViewId;
  turning: boolean;
  /** Set when the person presses the snapshot button; the stage hands back a PNG. */
  snapshotAt: number;
  onSnapshot: (dataUrl: string) => void;
  onReady: (milliseconds: number) => void;
}>;

/** The backdrops, drawn in CSS so nothing is fetched and no third-party picture is stored. */
const BACKDROPS: Readonly<Record<string, string>> = {
  pitch: "bg-[radial-gradient(120%_90%_at_50%_15%,#1d4f2b_0%,#123a1f_45%,#0a2414_100%)]",
  court: "bg-[radial-gradient(120%_90%_at_50%_15%,#8a5a2b_0%,#5d3a1a_45%,#2a1a0c_100%)]",
  gym: "bg-[radial-gradient(120%_90%_at_50%_15%,#3b4252_0%,#262b36_45%,#14171d_100%)]",
};

export default function KitStage({ flat, sportId, view, turning, snapshotAt, onSnapshot, onReady }: KitStageProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<KitStageScene | null>(null);
  const [failed, setFailed] = useState(false);
  const [readyMs, setReadyMs] = useState<number | null>(null);
  const mesh = useMemo(() => buildGarmentMesh(flat.shape), [flat.shape]);
  const backdrop = backdropFor(sportId);
  const front = flat.views.find((entry) => entry.view === "front")?.src;
  const back = flat.views.find((entry) => entry.view === "back")?.src;

  useEffect(() => {
    const target = canvas.current;
    if (!target || front === undefined || back === undefined) return;
    let cancelled = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    Promise.all([paintFlat(front, flat.shape.front.bounds), paintFlat(back, flat.shape.back.bounds)])
      .then(([frontPicture, backPicture]) => {
        if (cancelled) return;
        scene.current = mountKit(target, mesh, { front: frontPicture, back: backPicture }, motionFor(reduced), (ms) => {
          setReadyMs((already) => already ?? ms);
          onReady(ms);
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
    // `onReady` is a report, not a dependency: re-mounting the scene on a new callback would redraw the kit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesh, front, back, flat.shape]);

  useEffect(() => {
    scene.current?.showView(view);
  }, [view]);

  useEffect(() => {
    const reduced = typeof window === "undefined" ? false : window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scene.current?.turn(turning ? turntableSecondsFor(reduced) : null);
  }, [turning]);

  useEffect(() => {
    if (snapshotAt === 0) return;
    const picture = scene.current?.snapshot();
    if (picture) onSnapshot(picture);
    // The press is the trigger; the handler is read as it is at the time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotAt]);

  return (
    <div
      className={`relative h-full min-h-[22rem] w-full overflow-hidden rounded-2xl ${BACKDROPS[backdrop.id] ?? BACKDROPS.pitch}`}
      data-testid="teamwear-stage"
      data-ready-ms={readyMs === null ? undefined : Math.round(readyMs)}
      data-backdrop={backdrop.id}
    >
      <span className="sr-only">{backdrop.label}</span>
      {failed ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center" data-testid="teamwear-stage-failed">
          <p className="max-w-sm text-sm text-white/80">{STAGE_FAILED}</p>
          {front === undefined ? null : (
            // eslint-disable-next-line @next/next/no-img-element -- A drawing made on the server, already a data address.
            <img src={front} alt={flat.views[0]?.alt ?? ""} className="max-h-72 w-auto" />
          )}
        </div>
      ) : (
        <canvas
          ref={canvas}
          className="block h-full w-full touch-none"
          data-testid="teamwear-canvas"
          role="img"
          aria-label={`The kit on ${backdrop.label.toLowerCase()}. ${STAGE_NOTE} Drag to turn it. Scroll or pinch to come closer.`}
        />
      )}
      <p className="pointer-events-none absolute bottom-2 right-3 max-w-[18rem] text-right text-[11px] leading-snug text-white/70">{STAGE_NOTE}</p>
    </div>
  );
}
