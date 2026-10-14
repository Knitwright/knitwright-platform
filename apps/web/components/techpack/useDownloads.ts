"use client";

import { useEffect, useRef, useState } from "react";
import { downloadFile, finishDownload, startDownload, type Busy, type DownloadControl } from "@/lib/projects/download-controls";

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

export interface Downloads {
  readonly busy: Busy;
  readonly problem: string | null;
  readonly run: (control: DownloadControl) => Promise<void>;
}

/**
 * Makes one file at a time, when it is asked for, from the version of the design that the page
 * shows. A button that is disabled while it works loses focus, so focus is given back to the
 * button of the last download once the buttons are enabled again.
 */
export function useDownloads(projectId: string, version: number, colourwayId: string | undefined): Downloads {
  const [busy, setBusy] = useState<Busy>(null);
  const [problem, setProblem] = useState<string | null>(null);
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

  return { busy, problem, run };
}
