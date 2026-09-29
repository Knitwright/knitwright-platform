"use client";

import type { VersionView } from "@/lib/projects/editor-data";
import { VERSIONS_LISTED } from "@/lib/projects/limits";

type HistoryProps = Readonly<{
  versions: readonly VersionView[];
  olderHidden: boolean;
  /** Restoring waits while a change is still on its way. */
  busy: boolean;
  onRestore: (version: number) => void;
}>;

/** Every saved version, newest first. Restoring one saves it again as the newest. */
export function History({ versions, olderHidden, busy, onRestore }: HistoryProps) {
  return (
    <>
      <ol className="flex flex-col divide-y divide-hairline">
        {versions.map((entry) => (
          <li key={entry.version} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-ink">
                Version {entry.version}
                {entry.isCurrent ? <span className="ml-2 text-sm font-normal text-muted">Current</span> : null}
              </p>
              <p className="mt-0.5 text-sm text-ink-2">{entry.note}</p>
              <p className="mt-0.5 text-sm text-muted">{entry.when}</p>
            </div>
            {entry.isCurrent ? null : (
              <button
                type="button"
                disabled={busy}
                onClick={() => onRestore(entry.version)}
                aria-label={`Restore version ${entry.version}`}
                className="shrink-0 rounded-md border border-hairline px-3 py-1.5 text-sm font-medium text-ink hover:bg-shell disabled:cursor-not-allowed disabled:opacity-60"
              >
                Restore
              </button>
            )}
          </li>
        ))}
      </ol>
      {olderHidden ? (
        <p className="mt-3 text-sm text-muted">
          This list shows the newest {VERSIONS_LISTED} versions. Older versions are kept but are not listed here.
        </p>
      ) : null}
    </>
  );
}
