"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { PrintFormat } from "@/lib/print/formats";
import type { PrintSummary } from "@/lib/print/server/summary";
import { FORMAT_WORDS, downloadAddress } from "@/lib/print/ui";
import { ZoneOverlay } from "./ZoneOverlay";

type State = Readonly<{ kind: "loading" } | { kind: "ready"; summary: PrintSummary } | { kind: "failed"; message: string }>;

const FAILED = "The print files could not be prepared. Try again in a moment.";

async function readSummary(projectId: string): Promise<PrintSummary> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/print-files/summary`);
  const body: unknown = await response.json();
  const parsed = body as { success?: boolean; data?: PrintSummary; error?: { message?: string } };
  if (!response.ok || parsed.data === undefined) throw new Error(parsed.error?.message ?? FAILED);
  return parsed.data;
}

const FORMATS: readonly PrintFormat[] = ["pdf", "svg", "tiff"];

/** The print files of this design: what they are built with, where the zones are, and one link that builds the zip. */
export function PrintPanel() {
  const params = useParams<{ projectId?: string }>();
  const projectId = typeof params?.projectId === "string" ? params.projectId : null;
  const [state, setState] = useState<State>({ kind: "loading" });
  const [formats, setFormats] = useState<readonly PrintFormat[]>(["pdf"]);
  const [sizes, setSizes] = useState<readonly string[] | null>(null);
  const [piece, setPiece] = useState(0);

  useEffect(() => {
    if (projectId === null) return;
    let live = true;
    readSummary(projectId).then(
      (summary) => live && setState({ kind: "ready", summary }),
      (error: unknown) => live && setState({ kind: "failed", message: error instanceof Error ? error.message : FAILED }),
    );
    return () => {
      live = false;
    };
  }, [projectId]);

  const toggle = <T extends string>(list: readonly T[], item: T): readonly T[] => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  return (
    <section aria-labelledby="print-files-heading" data-testid="print-files-panel" className="flex flex-col gap-2">
      <h3 id="print-files-heading" className="text-[15px] font-medium text-ink">Print files</h3>
      {projectId === null ? <p className="text-[13px] leading-relaxed text-chalk-muted">Open a design to make its print files.</p> : null}
      {projectId !== null && state.kind === "loading" ? <p className="text-[13px] text-chalk-muted">Getting the pattern pieces.</p> : null}
      {state.kind === "failed" ? <p className="text-[13px] text-chalk-muted" role="status">{state.message}</p> : null}
      {projectId !== null && state.kind === "ready" ? (
        <Ready
          summary={state.summary}
          projectId={projectId}
          formats={formats}
          sizes={sizes ?? state.summary.sizes}
          piece={piece}
          onFormat={(f) => setFormats(toggle(formats, f))}
          onSize={(s) => setSizes(toggle(sizes ?? state.summary.sizes, s))}
          onPiece={setPiece}
        />
      ) : null}
    </section>
  );
}

interface ReadyProps {
  readonly summary: PrintSummary;
  readonly projectId: string;
  readonly formats: readonly PrintFormat[];
  readonly sizes: readonly string[];
  readonly piece: number;
  readonly onFormat: (f: PrintFormat) => void;
  readonly onSize: (s: string) => void;
  readonly onPiece: (at: number) => void;
}

function Facts({ summary }: { summary: PrintSummary }) {
  return (
    <>
      <p>{summary.patternDescription}.{summary.patternReviewed ? "" : " Draft pattern, not reviewed."}</p>
      <ul className="flex flex-col gap-1">
        <li>Bleed {summary.settings.bleedMm} mm and {summary.settings.dpi} dpi ({summary.settings.label}).</li>
        <li>{summary.scale}</li>
        <li>{summary.settings.colourProfile}</li>
        <li>{summary.rules}</li>
      </ul>
      <p>{summary.artwork}</p>
    </>
  );
}

function Choices({ summary, sizes, formats, onFormat, onSize }: Pick<ReadyProps, "summary" | "sizes" | "formats" | "onFormat" | "onSize">) {
  return (
    <>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-ink">Sizes</legend>
        {summary.sizes.map((size) => (
          <label key={size} className="flex items-center gap-2">
            <input type="checkbox" checked={sizes.includes(size)} onChange={() => onSize(size)} /> Size {size}
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-ink">File types</legend>
        {FORMATS.map((format) => (
          <label key={format} className="flex items-center gap-2">
            <input type="checkbox" checked={formats.includes(format)} onChange={() => onFormat(format)} /> {FORMAT_WORDS[format]}
          </label>
        ))}
      </fieldset>
    </>
  );
}

function PieceZones({ summary, piece, onPiece }: Pick<ReadyProps, "summary" | "piece" | "onPiece">) {
  const shown = summary.pieces[Math.min(piece, summary.pieces.length - 1)];
  if (!shown) return null;
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-ink">
        Piece
        <select value={piece} onChange={(e) => onPiece(Number(e.target.value))} className="rounded border border-hairline bg-surface px-2 py-1 text-[13px]">
          {summary.pieces.map((p, at) => (
            <option key={p.view} value={at}>{p.name} ({p.view.replace("-", " ")})</option>
          ))}
        </select>
      </label>
      <ZoneOverlay piece={shown} />
    </div>
  );
}

function Ready(props: ReadyProps) {
  const { summary, projectId, formats, sizes } = props;
  const nothingChosen = sizes.length === 0 || formats.length === 0;
  return (
    <div className="flex flex-col gap-3 text-[13px] leading-relaxed text-chalk-muted">
      <Facts summary={summary} />
      <Choices {...props} />
      {nothingChosen ? (
        <p>Choose a size and a file type to get the files.</p>
      ) : (
        <a href={downloadAddress(projectId, { sizes, formats })} download className="w-fit rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-canvas" data-testid="print-download">
          Download print files
        </a>
      )}
      <PieceZones {...props} />
    </div>
  );
}
