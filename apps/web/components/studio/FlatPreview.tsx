import { Notice } from "@/components/ui/Notice";
import type { FlatPreviewData } from "@/lib/projects/flat-preview";
import { Section } from "./EditorParts";

/**
 * The drawing of the design, front and back. It is drawn on the server and handed over as
 * a picture address, so the browser treats it as an image and nothing inside it can run.
 * This holds markup only. Every sentence comes from lib/projects/flat-preview.
 */
export function FlatPreview({ flat }: Readonly<{ flat: FlatPreviewData | null }>) {
  if (!flat) return null;
  return (
    <Section id="drawing" title="Drawing">
      {flat.notice ? (
        <div className="mb-4" data-testid="flat-notice">
          <Notice tone="warn">
            <p className="font-medium">{flat.notice}</p>
            {flat.missingSentence ? <p className="mt-1">{flat.missingSentence}</p> : null}
          </Notice>
        </div>
      ) : (
        <p className="mb-4 text-sm text-muted" data-testid="flat-scale">
          Drawn to scale from your measurements.
        </p>
      )}
      <div className="grid grid-cols-2 gap-4">
        {flat.views.map((view) => (
          <figure key={view.view} className="m-0 rounded-xl border border-hairline bg-white p-2">
            {/* A data address cannot go through next/image, and this is a drawing, not a photo. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={view.src}
              alt={view.alt}
              data-testid={`flat-${view.view}`}
              className="mx-auto h-auto max-h-[22rem] w-full object-contain"
            />
            <figcaption className="mt-1 text-center text-sm text-muted">{view.label}</figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}
