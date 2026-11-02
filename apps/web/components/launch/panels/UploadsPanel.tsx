"use client";

import { useId } from "react";
import { listProps } from "@/components/mockups/a11y";
import {
  RIGHTS_GAP,
  RIGHTS_RECORDED,
  RIGHTS_WORDING_NOTE,
  UPLOAD_NOT_PLACED,
  type UploadRow,
  type UploadsView,
} from "@/lib/launch-panels";
import type { LaunchPanelProps } from "@/lib/launch";
import { CARD, PanelEmpty, PanelGap, PanelLoading, PanelProblem, PanelShell } from "./frame";
import { useJson } from "./useJson";

/**
 * THE UPLOADS PANEL OF THE RAIL (spec Launch shell, "Uploads"; plan v5, decision 0106).
 *
 * L1's contract named workstream L7 for this panel, and L7 was given `lib/brand-studio/import/**`
 * and no component path, so it never existed. It shows the brand's own files, newest first, and
 * beside each one **exactly what the row records about rights and nothing more**: that somebody
 * said they own it or may use it on garments, the day they said it, and the words that were on
 * screen when they did.
 *
 * It never says a right has been established. Nothing in the platform establishes one, and no
 * rulebook entry says what evidence a brand must keep for a picture it prints, so the panel carries
 * `RIGHTS_GAP` with `R-GAP-000` instead of a sentence that would sound settled.
 *
 * It also says plainly what it does not do: placing an upload on an artboard is the Elements
 * panel's work (L4, decision 0094), so this panel offers no button that would half-do it.
 */
export default function UploadsPanel({ context }: LaunchPanelProps) {
  const headingId = useId();
  const { state, reload } = useJson<UploadsView>("/api/launch/uploads");

  return (
    <PanelShell id="uploads" headingId={headingId} busy={context.busy}>
      {state.kind === "loading" ? <PanelLoading id="uploads" /> : null}
      {state.kind === "failed" ? <PanelProblem id="uploads" onRetry={reload} /> : null}
      {state.kind === "ready" && state.value.rows.length === 0 ? <PanelEmpty id="uploads" /> : null}
      {state.kind === "ready" && state.value.rows.length > 0 ? (
        <ul {...listProps("Your uploads")} className="grid min-w-0 gap-2">
          {state.value.rows.map((row) => (
            <li key={row.id} role="listitem" className="min-w-0">
              <UploadCard row={row} />
            </li>
          ))}
        </ul>
      ) : null}

      <footer className="flex flex-col gap-1.5 border-t border-white/10 pt-2">
        <p className="text-[12px] leading-relaxed text-ink-2">{UPLOAD_NOT_PLACED}</p>
        <PanelGap note={RIGHTS_GAP} testId="launch-uploads-rights-gap" />
      </footer>
    </PanelShell>
  );
}

export function UploadCard({ row }: Readonly<{ row: UploadRow }>) {
  return (
    <div className={CARD} data-testid={`launch-upload-${row.id}`}>
      <h3 className="text-[13px] font-medium text-ink">{row.label}</h3>
      <p className="text-[12px] leading-relaxed text-ink-2">
        {row.kindLabel} · {row.detail}
      </p>
      <p className="text-[12px] leading-relaxed text-ink-2" data-testid={`launch-upload-rights-${row.id}`}>
        {RIGHTS_RECORDED}, {row.rights.when}.
      </p>
      {row.rights.wordingText === null ? null : (
        <p className="text-[12px] leading-relaxed text-ink-2">
          “{row.rights.wordingText}” {RIGHTS_WORDING_NOTE}
        </p>
      )}
      {row.warnings.length === 0 ? null : (
        <ul {...listProps(`What ${row.label} says`)} className="flex flex-col gap-1">
          {row.warnings.map((warning) => (
            <li key={warning} role="listitem" className="text-[12px] leading-relaxed text-ink-2">
              {warning}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
