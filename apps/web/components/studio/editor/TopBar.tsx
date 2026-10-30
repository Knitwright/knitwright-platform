"use client";

import type { Route } from "next";
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { ArrowMark } from "@/components/ui/ArrowMark";
import { JourneySteps } from "@/components/ui/JourneySteps";
import type { FindingLine, ValidateChip as ChipView } from "@/lib/editor";
import type { EditorData } from "@/lib/projects/editor-data";
import { journeySteps, toolHref, type ToolId } from "@/lib/workspace/tools";
import { SaveStatus } from "../EditorParts";
import { FileMenu } from "./FileMenu";
import { ValidateChip } from "./ValidateChip";

const CHIP =
  "chip-btn inline-flex h-10 items-center justify-center rounded-full border border-white/20 bg-transparent px-4 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-55";

type Props = Readonly<{
  data: EditorData;
  /** The newest version the editor knows of. It moves on as soon as a change is saved. */
  version: number;
  busy: boolean;
  status: string | null;
  /** The line the design's form reads, or null for a design with no base article. */
  autoName: string | null;
  chip: ChipView;
  findings: readonly FindingLine[];
  tool: ToolId;
  canUndo: boolean;
  onUndo: () => void;
  onTool: (tool: ToolId) => void;
  onExport: () => void;
  exportOpen: boolean;
}>;

/**
 * The top of the editor (spec F-S4): the design's name with the line its form reads, the File
 * menu, undo, the Validate chip with its findings and a Why? on each, and the actions pinned
 * beside them — Share, Export and the journey the existing workspace already pins here.
 *
 * The credits counter the spec puts in this bar is the one the studio header already shows, one
 * row above the editor; it is not repeated (decision 0075).
 */
export function TopBar(props: Props) {
  const { data, version, busy, status, autoName, chip, findings, tool, canUndo, onUndo, onTool, onExport, exportOpen } = props;
  return (
    <header className="glass flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[1.75rem] px-4 py-2.5 lg:pl-5">
      <div className="min-w-0 flex-1 lg:flex-none lg:basis-60">
        <h1 className="truncate text-base font-medium tracking-[-0.01em] text-ink">{data.name}</h1>
        <p className="truncate font-mono text-xs text-chalk-muted">
          {autoName ? <span data-testid="auto-name">{autoName}</span> : <span>{data.typeLabel}</span>}
          {" · "}
          <span data-testid="version">Version {version}</span>
        </p>
        <SaveStatus busy={busy} status={status} className="min-h-4 truncate text-xs text-ink-2" />
      </div>
      <FileMenu projectId={data.projectId} onTool={onTool} />
      <button type="button" className={CHIP} disabled={!canUndo || busy} onClick={onUndo}>
        Undo
      </button>
      <Journey projectId={data.projectId} tool={tool} />
      <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap">
        <ValidateChip chip={chip} findings={findings} />
        <ToolLink projectId={data.projectId} tool="photoreal" current={tool === "photoreal"} onTool={onTool}>
          Photoreal
        </ToolLink>
        <ToolLink projectId={data.projectId} tool="production" current={tool === "production"} onTool={onTool}>
          Make it
        </ToolLink>
        <ToolLink projectId={data.projectId} tool="share" current={tool === "share"} onTool={onTool}>
          Share
        </ToolLink>
        <Link href={`/studio/${data.projectId}/tech-pack` as Route} className={CHIP}>
          Tech pack
        </Link>
        <button
          type="button"
          onClick={onExport}
          aria-expanded={exportOpen}
          data-testid="export-button"
          className="chip-cta thread-ring inline-flex h-11 items-center gap-3 rounded-full bg-white/5 pr-1 pl-5 text-sm font-medium whitespace-nowrap text-white"
        >
          <span className="chip-fill" aria-hidden="true" />
          <span className="chip-label">Export</span>
          <span className="chip-disc size-9" aria-hidden="true">
            <ArrowMark />
          </span>
        </button>
      </div>
    </header>
  );
}

type ToolLinkProps = Readonly<{ projectId: string; tool: ToolId; current: boolean; onTool: (tool: ToolId) => void; children: ReactNode }>;

/** A link to a panel of this shell. A plain click opens the panel without leaving the page. */
function ToolLink({ projectId, tool, current, onTool, children }: ToolLinkProps) {
  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onTool(tool);
  };
  return (
    <a href={toolHref(projectId, tool)} onClick={click} aria-current={current ? "true" : undefined} className={CHIP}>
      {children}
    </a>
  );
}

/** Design, factory file, committee, quote: where the design is on its way to being made. */
function Journey({ projectId, tool }: Readonly<{ projectId: string; tool: ToolId }>) {
  const steps = journeySteps(projectId, tool);
  return (
    <nav aria-label="Journey" className="order-last w-full min-w-0 lg:order-none lg:mx-auto lg:w-auto">
      <JourneySteps steps={steps.map((step) => ({ label: step.label, href: step.href as Route }))} current={Math.max(0, steps.findIndex((step) => step.current))} />
    </nav>
  );
}
