import Link from "next/link";
import type { Route } from "next";
import type { GarmentPreview } from "@/lib/canvas";

/**
 * The top of a Garment board (decision 0145, `08` §5.2): the design's front flat at its current
 * version, drawn by the platform from the spec -- never a picture a model made -- with the version
 * and what the last validation of that version said. The editor validates; this only reports it.
 *
 * Only the flat is drawn here. The 3D view stays where it is, in the editor, behind `SHOW_3D`.
 */
export function GarmentPreviewPanel({ preview, editHref }: Readonly<{ preview: GarmentPreview | null; editHref: Route }>) {
  if (preview === null) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-xl bg-bg p-4 text-center text-caption text-muted" data-testid="garment-missing">
        This design could not be opened. It may have been removed.
      </div>
    );
  }
  return (
    <figure className="m-0 flex min-h-0 flex-1 flex-col gap-1 rounded-xl bg-bg p-2" data-testid={`garment-preview-${preview.designProjectId}`}>
      <Link href={editHref} className="flex min-h-0 flex-1 items-center justify-center" aria-label={`Open ${preview.name} in the editor`}>
        {preview.src ? (
          // A data address cannot go through next/image, and this is a drawing, not a photo.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.src} alt={preview.alt} className="h-full max-h-full w-full object-contain" draggable={false} />
        ) : (
          <span className="text-caption text-muted">{preview.alt}</span>
        )}
      </Link>
      <figcaption className="flex items-center justify-between gap-2 text-micro text-muted">
        <span>Version {preview.version}</span>
        <CheckLine checks={preview.checks} />
      </figcaption>
    </figure>
  );
}

function CheckLine({ checks }: Readonly<{ checks: GarmentPreview["checks"] }>) {
  if (checks === null) return <span data-testid="garment-checks">No checks run on this version yet</span>;
  return (
    <span data-testid="garment-checks" className={checks.passed ? "text-ok" : "text-bad"}>
      {checks.passed ? "No problems found" : `${checks.count} ${checks.count === 1 ? "check" : "checks"} to fix`}
    </span>
  );
}
