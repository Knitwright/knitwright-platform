"use client";

import type { VersionView } from "@/lib/projects/editor-data";

type HistoryProps = Readonly<{
  versions: readonly VersionView[];
  onRestore: (version: number) => void;
}>;

/** Every saved version, newest first. Restoring one saves it again as the newest. */
export function History({ versions, onRestore }: HistoryProps) {
  return (
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
              onClick={() => onRestore(entry.version)}
              aria-label={`Restore version ${entry.version}`}
              className="shrink-0 rounded-md border border-hairline px-3 py-1.5 text-sm font-medium text-ink hover:bg-shell"
            >
              Restore
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}
