"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import {
  DOWNLOAD_CONTROLS,
  busyAnnouncement,
  downloadFile,
  finishDownload,
  isBusyWith,
  startDownload,
  type Busy,
  type DownloadControl,
} from "@/lib/projects/download-controls";

type DownloadsProps = Readonly<{
  projectId: string;
  version: number;
  colourwayId?: string | undefined;
  /** True inside a page section that is already headed "Download", such as the guided flow's last step. */
  nested?: boolean;
}>;

const REVOKE_AFTER_MS = 30_000;

/** Hands a file to the browser to save under its own name. */
function saveBlob(name: string, blob: Blob): void {
  const address = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = address;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(address), REVOKE_AFTER_MS);
}

/**
 * The four downloads: the PDF, the Excel file and the two drawings. Each is made when it is asked
 * for, from the version of the design that the page shows. Which address to call, the name of the
 * file, what a failure says and the busy state are worked out in lib/projects/download-controls.
 */
export function TechPackDownloads({ projectId, version, colourwayId, nested = false }: DownloadsProps) {
  const Heading = nested ? "h3" : "h2";
  const [busy, setBusy] = useState<Busy>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // The button of the last download. A button that is disabled while it works loses focus, so it is
  // given back once the buttons are enabled again, after the render that enables them.
  const returnFocusTo = useRef<string | null>(null);

  useEffect(() => {
    if (busy !== null || returnFocusTo.current === null) return;
    document.getElementById(returnFocusTo.current)?.focus();
    returnFocusTo.current = null;
  }, [busy]);

  const run = async (control: DownloadControl) => {
    if (busy !== null) return;
    setBusy(startDownload(busy, control.id));
    setProblem(null);
    const result = await downloadFile(projectId, control, { version, colourwayId }, (address) =>
      fetch(address, { credentials: "same-origin" }),
    );
    if (result.ok) saveBlob(result.name, result.blob);
    else setProblem(result.sentence);
    returnFocusTo.current = `download-${control.id}`;
    setBusy((current) => finishDownload(current, control.id));
  };

  return (
    <section id="download" aria-labelledby="download-title" className="scroll-mt-20 rounded-2xl border border-hairline bg-surface p-6">
      <Heading id="download-title" className="text-lg font-semibold text-ink">
        {nested ? "The files" : "Download"}
      </Heading>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Each file is made when you ask for it, from version {version} of this design. Nothing is stored.
      </p>
      <div role="group" aria-label="Download this tech pack" className="mt-4 flex flex-wrap gap-3">
        {DOWNLOAD_CONTROLS.map((control) => (
          <Button
            key={control.id}
            id={`download-${control.id}`}
            variant="secondary"
            pending={isBusyWith(busy, control.id)}
            disabled={busy !== null}
            aria-label={control.accessibleName}
            data-testid={`download-${control.id}`}
            onClick={() => void run(control)}
          >
            {control.label}
          </Button>
        ))}
      </div>
      <p role="status" aria-live="polite" data-testid="download-status" className="mt-3 min-h-5 text-sm text-muted">
        {busyAnnouncement(busy)}
      </p>
      {problem ? (
        <div className="mt-2" data-testid="download-problem">
          <Notice tone="warn" role="alert">
            {problem}
          </Notice>
        </div>
      ) : null}
    </section>
  );
}
