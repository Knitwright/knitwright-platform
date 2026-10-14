"use client";

import { useParams } from "next/navigation";
import { ZoneOverlay } from "./ZoneOverlay";

const projectIdFrom = (params: ReturnType<typeof useParams>): string | null => {
  const value = params?.projectId;
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
};

/** Print files: one file for every piece in every size, as a zip made when you ask for it. */
export function PrintPanel() {
  const projectId = projectIdFrom(useParams());
  return (
    <section aria-labelledby="print-files-heading" data-testid="print-files-panel" className="flex flex-col gap-2">
      <h3 id="print-files-heading" className="text-[15px] font-medium text-ink">Print files</h3>
      <p className="text-[13px] leading-relaxed text-chalk-muted">
        One file for every piece in every size, at full size with extra print past the cut line. The zip is made when you ask and is not kept.
        Each file says in its margin what to look at before it goes to the printer.
      </p>
      <ZoneOverlay />
      <p className="text-[12px] leading-relaxed text-chalk-muted">
        Places for marks: crest, sponsor, number on the front, name, number on the back, sleeve badge and sleeve band.
      </p>
      {projectId ? (
        <a
          href={`/api/projects/${projectId}/print-files?formats=pdf,svg`}
          className="text-[13px] font-medium text-ink underline"
          download
        >
          Download print files (PDF and SVG)
        </a>
      ) : null}
    </section>
  );
}
