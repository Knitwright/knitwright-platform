"use client";

import { PriceNote } from "@/components/credits/PriceNote";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { DOWNLOAD_CONTROLS, busyAnnouncement, isBusyWith } from "@/lib/projects/download-controls";
import { useDownloads, type Downloads } from "./useDownloads";

type DownloadsProps = Readonly<{
  projectId: string;
  version: number;
  colourwayId?: string | undefined;
  /** True inside a page section that is already headed "Download", such as the guided flow's last step. */
  nested?: boolean;
}>;

/** What is being made, and what went wrong, read out as it changes. */
function DownloadStatus({ downloads }: Readonly<{ downloads: Downloads }>) {
  return (
    <>
      <p role="status" aria-live="polite" data-testid="download-status" className="min-h-5 text-sm text-muted empty:min-h-0">
        {busyAnnouncement(downloads.busy)}
      </p>
      {downloads.problem ? (
        <div data-testid="download-problem">
          <Notice tone="warn" role="alert">
            {downloads.problem}
          </Notice>
        </div>
      ) : null}
    </>
  );
}

type ButtonsProps = Readonly<{ downloads: Downloads; small?: boolean }>;

/** One button for each file: the PDF, the Excel file and the two drawings. */
function DownloadButtons({ downloads, small = false }: ButtonsProps) {
  const { busy, run } = downloads;
  return (
    <>
      {DOWNLOAD_CONTROLS.map((control) => (
        <Button
          key={control.id}
          id={`download-${control.id}`}
          variant="secondary"
          className={small ? "h-10! px-3.5! text-sm!" : ""}
          pending={isBusyWith(busy, control.id)}
          disabled={busy !== null}
          aria-label={control.accessibleName}
          data-testid={`download-${control.id}`}
          onClick={() => void run(control)}
        >
          {control.label}
        </Button>
      ))}
    </>
  );
}

/**
 * The four downloads: the PDF, the Excel file and the two drawings. Each is made when it is asked
 * for, from the version of the design that the page shows. Which address to call, the name of the
 * file, what a failure says and the busy state are worked out in lib/projects/download-controls.
 */
export function TechPackDownloads({ projectId, version, colourwayId, nested = false }: DownloadsProps) {
  const Heading = nested ? "h3" : "h2";
  const downloads = useDownloads(projectId, version, colourwayId);
  return (
    <section id="download" aria-labelledby="download-title" className="scroll-mt-20 rounded-2xl border border-hairline bg-surface p-6">
      <Heading id="download-title" className="text-lg font-semibold text-ink">
        {nested ? "The files" : "Download"}
      </Heading>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Each file is made when you ask for it, from version {version} of this design. Nothing is stored.
      </p>
      <div role="group" aria-label="Download this tech pack" className="mt-4 flex flex-wrap gap-3">
        <DownloadButtons downloads={downloads} />
      </div>
      <div className="mt-2">
        <PriceNote kind="techpack_pdf" />
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <DownloadStatus downloads={downloads} />
      </div>
    </section>
  );
}

type HeaderProps = Readonly<{
  projectId: string;
  version: number;
  colourwayId?: string | undefined;
  /** Where the pattern pieces are made as a DXF file. */
  dxfHref: string;
}>;

/** The downloads as a row of small buttons in the header of the factory file, with the DXF beside them. */
export function HeaderDownloads({ projectId, version, colourwayId, dxfHref }: HeaderProps) {
  const downloads = useDownloads(projectId, version, colourwayId);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div role="group" aria-label="Download this tech pack" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-muted">{`Download version ${version}`}</span>
        <DownloadButtons downloads={downloads} small />
        <a
          href={dxfHref}
          data-file-section-link="patterns"
          className="chip-btn inline-flex h-10 items-center rounded-full border border-white/20 bg-white/[0.04] px-3.5 text-sm font-medium text-ink backdrop-blur-md"
        >
          DXF
        </a>
      </div>
      <DownloadStatus downloads={downloads} />
    </div>
  );
}
