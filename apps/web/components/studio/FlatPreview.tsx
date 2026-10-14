import type { FlatPreviewData } from "@/lib/projects/flat-preview";
import { Preview3D } from "./Preview3D";

type FlatPreviewProps = Readonly<{ flat: FlatPreviewData | null; show3d?: boolean }>;

/**
 * The drawing of the design, front and back, for the centre of the workspace and the guided flow.
 * It is drawn on the server and handed over as a picture address, so the browser treats it as an
 * image and nothing inside it can run. This holds markup only. Every sentence comes from
 * lib/projects/flat-preview. The 3D trial shows only when the server switch SHOW_3D is on
 * (decision 0027). The caller draws the panel around it.
 */
export function FlatPreview({ flat, show3d = false }: FlatPreviewProps) {
  if (!flat) return <p className="text-sm text-muted">This garment has no drawing yet.</p>;
  return (
    <div className="my-auto flex flex-col gap-4">
      <ScaleNote flat={flat} />
      <div className="grid grid-cols-2 items-end gap-3 sm:gap-6">
        {flat.views.map((view) => (
          <figure key={view.view} className="flat-in m-0 flex min-w-0 flex-col items-center gap-2">
            <div className="w-full rounded-2xl bg-white p-2 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.8)]">
              {/* A data address cannot go through next/image, and this is a drawing, not a photo. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={view.src}
                alt={view.alt}
                data-testid={`flat-${view.view}`}
                className="mx-auto h-auto max-h-[38vh] w-full object-contain lg:max-h-[calc(100dvh-25rem)]"
              />
            </div>
            <figcaption className="font-mono text-xs text-chalk-muted">{view.label}</figcaption>
          </figure>
        ))}
      </div>
      {show3d ? <Preview3D flat={flat} /> : null}
    </div>
  );
}

/** Whether the drawing is to scale, and what keeps it from being so. */
function ScaleNote({ flat }: Readonly<{ flat: FlatPreviewData }>) {
  return (
    <div className="flex flex-col items-start gap-2">
      {flat.notice ? (
        <div role="status" className="rounded-2xl border border-warn/30 bg-warn-wash px-4 py-2.5 text-sm leading-relaxed text-warn" data-testid="flat-notice">
          <p className="font-medium">{flat.notice}</p>
          {flat.missingSentence ? <p className="mt-1">{flat.missingSentence}</p> : null}
        </div>
      ) : (
        <p className="rounded-full border border-white/10 bg-tile-2/80 px-3 py-1.5 text-xs text-ink-2" data-testid="flat-scale">
          Drawn to scale from your measurements.
        </p>
      )}
      {flat.picturesNote ? (
        <p className="text-sm text-muted" data-testid="flat-pictures-note">
          {flat.picturesNote}
        </p>
      ) : null}
    </div>
  );
}
