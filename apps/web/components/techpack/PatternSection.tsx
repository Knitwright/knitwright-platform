"use client";

import { useEffect, useState } from "react";
import { PriceNote } from "@/components/credits/PriceNote";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SelectField } from "@/components/ui/SelectField";
import { PATTERN_POLL_MS, askForPattern, fileLink, readLatestPattern } from "@/lib/patterns/client";
import type { PatternJobView } from "@/lib/patterns/job-view";

type PatternSectionProps = Readonly<{
  projectId: string;
  /** The sizes a pattern can be asked for, the design's base size first. */
  sizes: readonly string[];
  /** The design's version now, so a pattern of an older version says so. */
  currentVersion: number;
}>;

const STATUS_WORDS: Readonly<Record<"waiting" | "drafting", string>> = {
  waiting: "Asked for. Drafting starts in a moment.",
  drafting: "Drafting the pattern. This takes from a few seconds to a few minutes.",
};

/** Opens a stored file through a link that works for about a minute. */
async function openFile(fileId: string): Promise<boolean> {
  const url = await fileLink(fileId);
  if (!url) return false;
  window.location.assign(url);
  return true;
}

function Preview({ fileId }: Readonly<{ fileId: string }>) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void fileLink(fileId).then((url) => {
      if (live) setSrc(url);
    });
    return () => {
      live = false;
    };
  }, [fileId]);
  if (!src) return <p className="text-sm text-muted">Loading the picture of the pieces…</p>;
  // A signed link to a private file: Next's image loader cannot fetch it.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="The pattern pieces, laid out flat" className="max-h-[480px] w-auto rounded-lg border border-hairline bg-white p-2" />;
}

function Ready({ job, currentVersion }: Readonly<{ job: PatternJobView; currentVersion: number }>) {
  const [problem, setProblem] = useState<string | null>(null);
  const download = async () => {
    if (!job.dxfFileId) return;
    setProblem((await openFile(job.dxfFileId)) ? null : "The file could not be fetched. Try again.");
  };
  return (
    <div className="grid gap-4">
      <p className="text-[15px] text-ink-2">
        {job.kind === "size-set" ? "Every size" : `Size ${job.size}`}
        {job.pieces ? `, ${job.pieces} pieces` : ""}. Drafted from the {job.draft ?? "pattern"} block.
        {job.kind === "size-set" ? " The sizes are stored in the pattern library, with the measurements read from each one." : ""}
        {job.version < currentVersion ? " The design has changed since: ask again for a pattern of the newest version." : ""}
      </p>
      {job.previewFileId ? <Preview fileId={job.previewFileId} /> : null}
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => void download()}>
          Download the DXF
        </Button>
      </div>
      {problem ? (
        <Notice tone="warn" role="alert">
          {problem}
        </Notice>
      ) : null}
      {job.notes.length > 0 ? (
        <details className="rounded-xl border border-hairline p-4">
          <summary className="min-h-10 cursor-pointer text-[15px] font-medium text-ink">How it was drafted ({job.notes.length} notes)</summary>
          <ul className="mt-3 grid list-disc gap-2 pl-5 text-sm text-ink-2">
            {job.notes.map((note, index) => (
              <li key={`note-${index}`}>{note}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/**
 * Sewing patterns of the design: a DXF of the pieces for a cutting room or CAD, and a picture
 * of them. Asked for one size at a time. A pattern is a draft from a standard block until a
 * pattern maker has looked at it, and the section says so.
 */
export function PatternSection({ projectId, sizes, currentVersion }: PatternSectionProps) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [job, setJob] = useState<PatternJobView | null>(null);
  const [size, setSize] = useState(sizes[0] ?? "M");
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);

  const working = job?.status === "waiting" || job?.status === "drafting";

  useEffect(() => {
    let live = true;
    const read = async () => {
      const latest = await readLatestPattern(projectId);
      if (!live) return;
      if (latest) {
        setAvailable(latest.available);
        setJob(latest.job);
      }
      // Keep asking while the pattern is being drafted, and when the answer could not be read.
      const unfinished = latest?.job?.status === "waiting" || latest?.job?.status === "drafting";
      if (unfinished || !latest) setPolls((count) => count + 1);
    };
    // Read at once, then keep asking only while a pattern is being drafted.
    const timer = setTimeout(() => void read(), polls === 0 ? 0 : PATTERN_POLL_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [projectId, polls]);

  const ask = async (kind: "single" | "size-set" = "single") => {
    setAsking(true);
    setProblem(null);
    const result = await askForPattern(projectId, size, fetch, kind);
    setAsking(false);
    if (result.ok) {
      setJob(result.job);
      setPolls((count) => count + 1);
    } else {
      setProblem(result.reason);
    }
  };

  return (
    <section id="patterns" aria-labelledby="patterns-heading" className="grid gap-4 rounded-xl border border-hairline bg-surface p-6">
      <div className="grid gap-1">
        <h2 id="patterns-heading" className="text-lg font-semibold text-ink">
          Patterns
        </h2>
        <p className="text-sm text-muted">
          The pieces to cut, as a DXF file for a cutting room or pattern software. Each pattern is drafted from a standard block for the
          size you choose, or for every size at once. It is a draft pattern, not reviewed, until a named person has reviewed it in the pattern library.
        </p>
      </div>

      {available === false ? <Notice>Patterns are not set up yet.</Notice> : null}

      {available ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[8rem]">
            <SelectField
              name="pattern-size"
              label="Size"
              value={size}
              onChange={(event) => setSize(event.target.value)}
              options={sizes.map((label) => ({ id: label, label }))}
              disabled={working || asking}
            />
          </div>
          <Button type="button" pending={asking || working} onClick={() => void ask()}>
            {working ? "Drafting…" : job?.status === "ready" ? "Make another pattern" : "Make the pattern"}
          </Button>
          <Button type="button" variant="secondary" disabled={asking || working} onClick={() => void ask("size-set")}>
            Make every size
          </Button>
          <PriceNote kind="pattern_file" />
        </div>
      ) : null}

      {working && job ? (
        <p role="status" className="text-sm text-muted">
          {job.kind === "size-set" ? "Every size" : `Size ${job.size}`}: {STATUS_WORDS[job.status as "waiting" | "drafting"]}
        </p>
      ) : null}
      {problem ? (
        <Notice tone="warn" role="alert">
          {problem}
        </Notice>
      ) : null}
      {job?.status === "failed" && job.message ? (
        <Notice tone="warn" role="alert">
          {job.message}
        </Notice>
      ) : null}
      {job?.status === "ready" ? <Ready job={job} currentVersion={currentVersion} /> : null}
    </section>
  );
}
