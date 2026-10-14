"use client";

import type { Route } from "next";
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { ArrowMark } from "@/components/ui/ArrowMark";
import { JourneySteps } from "@/components/ui/JourneySteps";
import type { EditorData } from "@/lib/projects/editor-data";
import { journeySteps, toolHref, type ToolId } from "@/lib/workspace/tools";
import { SaveStatus } from "../EditorParts";

type HeaderProps = Readonly<{
  data: EditorData;
  /** The newest version the editor knows of. It moves on as soon as a change is saved. */
  version: number;
  busy: boolean;
  status: string | null;
  tool: ToolId;
  onChoose: (tool: ToolId) => void;
  onUndo: () => void;
}>;

const CHIP =
  "chip-btn inline-flex h-10 items-center justify-center rounded-full border border-white/20 bg-transparent px-4 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-55";

/**
 * The top of the workspace: the design's name and save status, the four steps of the journey,
 * and the actions pinned beside them. A step or action that opens a panel is a real link, so it
 * also opens in a new tab, but a plain click opens the panel in place.
 */
export function WorkspaceHeader({ data, version, busy, status, tool, onChoose, onUndo }: HeaderProps) {
  const details = [data.styleNumber ? `Style ${data.styleNumber}` : null, data.season || null].filter(Boolean);
  return (
    <header className="glass flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[1.75rem] px-4 py-3 lg:flex-nowrap lg:rounded-full lg:py-2 lg:pr-2 lg:pl-6">
      <div className="min-w-0 flex-1 lg:flex-none lg:basis-64">
        <h1 className="truncate text-base font-medium tracking-[-0.01em] text-ink">{data.name}</h1>
        <p className="truncate font-mono text-xs text-chalk-muted">
          {data.typeLabel} · {data.wearerLabel} · <span data-testid="version">Version {version}</span>
          {details.length > 0 ? <span> · {details.join(", ")}</span> : null}
        </p>
        <SaveStatus busy={busy} status={status} className="min-h-4 truncate text-xs text-ink-2" />
      </div>
      <Journey projectId={data.projectId} tool={tool} />
      <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap">
        <button type="button" className={CHIP} disabled={data.undoTo === null || busy} onClick={onUndo}>
          Undo
        </button>
        <ToolLink projectId={data.projectId} tool="photoreal" current={tool === "photoreal" ? "true" : undefined} onChoose={onChoose} className={CHIP}>
          Photoreal
        </ToolLink>
        <ToolLink projectId={data.projectId} tool="share" current={tool === "share" ? "true" : undefined} onChoose={onChoose} className={CHIP}>
          Share
        </ToolLink>
        <Link
          href={`/studio/${data.projectId}/tech-pack` as Route}
          className="chip-cta thread-ring inline-flex h-11 items-center gap-3 rounded-full bg-white/5 pr-1 pl-5 text-sm font-medium whitespace-nowrap text-white"
        >
          <span className="chip-fill" aria-hidden="true" />
          <span className="chip-label">Tech pack</span>
          <span className="chip-disc size-9" aria-hidden="true">
            <ArrowMark />
          </span>
        </Link>
      </div>
    </header>
  );
}

type ToolLinkProps = Readonly<{
  projectId: string;
  tool: ToolId;
  onChoose: (tool: ToolId) => void;
  className: string;
  /** "true" for the action whose panel is open. */
  current?: "true" | undefined;
  children: ReactNode;
}>;

/** A link to a panel of this workspace. A plain click opens the panel without leaving the page. */
function ToolLink({ projectId, tool, onChoose, className, current, children }: ToolLinkProps) {
  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onChoose(tool);
  };
  return (
    <a
      href={toolHref(projectId, tool)}
      onClick={click}
      aria-current={current}
      className={className}
    >
      {children}
    </a>
  );
}

/** Design, factory file, committee, quote: where the design is on its way to being made. */
function Journey({ projectId, tool }: Readonly<{ projectId: string; tool: ToolId }>) {
  const steps = journeySteps(projectId, tool);
  return (
    <nav aria-label="Journey" className="order-last w-full min-w-0 lg:order-none lg:mx-auto lg:w-auto">
      <JourneySteps
        steps={steps.map((step) => ({ label: step.label, href: step.href as Route }))}
        current={Math.max(0, steps.findIndex((step) => step.current))}
      />
    </nav>
  );
}
